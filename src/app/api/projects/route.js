import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise, { databaseName } from "@/lib/mongodb-fms-template";
import masterClientPromise, { databaseName as masterDatabaseName } from "@/lib/mongodb";
import { USER_COLLECTION } from "@/lib/user-collection";
import { serializeTask } from "@/lib/fms-template";
import { setCachedProjectTasks } from "@/lib/project-task-cache";
import {
  buildActiveTaskSnapshot,
  recalculateProjectTaskState,
  shouldActivateProject,
} from "@/lib/project-task-state";

export const runtime = "nodejs";

const EMPTY_SPACE_KEY = "__EMPTY_SPACE__";

function serializeProject(project) {
  if (!project) {
    return null;
  }

  return {
    ...project,
    _id: project._id?.toString ? project._id.toString() : String(project._id || ""),
    templateId: project.templateId?.toString ? project.templateId.toString() : String(project.templateId || ""),
    createdAt: project.createdAt instanceof Date ? project.createdAt.toISOString() : project.createdAt,
    updatedAt: project.updatedAt instanceof Date ? project.updatedAt.toISOString() : project.updatedAt,
    startDate: project.startDate instanceof Date ? project.startDate.toISOString() : project.startDate || null,
    deleteApprovalRequestedAt:
      project.deleteApprovalRequestedAt instanceof Date
        ? project.deleteApprovalRequestedAt.toISOString()
        : project.deleteApprovalRequestedAt || null,
    active_task: Array.isArray(project.active_task) ? project.active_task : [],
  };
}

function normalizeSpaceKey(value) {
  const normalized = String(value || "").trim();
  return normalized || EMPTY_SPACE_KEY;
}

function buildDisplayName(user) {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return fullName || user.username || user.email || "Unknown User";
}

function resolveDependencyIds(dependsOnTaskIds, keptTaskIds, templateTaskMap, currentTaskId) {
  const resolved = new Set();
  const visited = new Set([String(currentTaskId)]);

  const walk = (dependencyId) => {
    const normalizedId = String(dependencyId || "").trim();
    if (!normalizedId || visited.has(normalizedId)) {
      return;
    }

    visited.add(normalizedId);

    if (keptTaskIds.has(normalizedId)) {
      resolved.add(normalizedId);
      return;
    }

    const dependencyTask = templateTaskMap.get(normalizedId);
    if (!dependencyTask || !Array.isArray(dependencyTask.dependsOnTaskIds)) {
      return;
    }

    dependencyTask.dependsOnTaskIds.forEach((nestedDependencyId) => {
      walk(nestedDependencyId);
    });
  };

  (dependsOnTaskIds || []).forEach((dependencyId) => {
    walk(dependencyId);
  });

  return Array.from(resolved);
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "active";
    const search = String(searchParams.get("search") || "").trim();

    const client = await clientPromise;
    const db = client.db(databaseName);

    const query = {};
    if (status === "pending-delete") {
      query.deleteApprovalStatus = "pending";
    } else {
      query.deleteApprovalStatus = { $ne: "pending" };
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { address: { $regex: search, $options: "i" } },
        { templateName: { $regex: search, $options: "i" } },
      ];
    }

    const projects = await db
      .collection("fms_projects")
      .find(query)
      .sort({ updatedAt: -1, createdAt: -1 })
      .toArray();

    return NextResponse.json({ projects: projects.map(serializeProject) });
  } catch (error) {
    console.error("Error fetching projects:", error);
    return NextResponse.json({ error: "Failed to load projects" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      name,
      description = "",
      address = "",
      templateId,
      roleAssignments = [],
      selectedSpaces = [],
      startDate,
      startDateUndecided = false,
    } = body;

    if (!String(name || "").trim()) {
      return NextResponse.json({ error: "Project name is required" }, { status: 400 });
    }

    if (!ObjectId.isValid(templateId)) {
      return NextResponse.json({ error: "Valid template is required" }, { status: 400 });
    }

    const normalizedRoleAssignments = Array.isArray(roleAssignments)
      ? roleAssignments
          .map((assignment) => ({
            ownerCode: String(assignment?.ownerCode || "").trim().toUpperCase(),
            userId: String(assignment?.userId || "").trim(),
          }))
          .filter((assignment) => assignment.ownerCode && ObjectId.isValid(assignment.userId))
      : [];

    const selectedSpaceKeys = Array.isArray(selectedSpaces)
      ? selectedSpaces.map((space) => normalizeSpaceKey(space))
      : [];

    if (!selectedSpaceKeys.length) {
      return NextResponse.json({ error: "Select at least one space" }, { status: 400 });
    }

    let parsedStartDate = null;
    if (!startDateUndecided && startDate) {
      parsedStartDate = new Date(startDate);
      if (Number.isNaN(parsedStartDate.getTime())) {
        return NextResponse.json({ error: "Invalid project start date" }, { status: 400 });
      }
    }

    const client = await clientPromise;
    const db = client.db(databaseName);
    const templateObjectId = new ObjectId(templateId);

    const [template, templateTasks] = await Promise.all([
      db.collection("fms_templates").findOne({ _id: templateObjectId }),
      db.collection("fms_template_tasks").find({ templateId: templateObjectId }).sort({ rowNumber: 1 }).toArray(),
    ]);

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    if (!templateTasks.length) {
      return NextResponse.json({ error: "Template has no tasks" }, { status: 400 });
    }

    const serializedTemplateTasks = templateTasks.map(serializeTask);
    const templateRoles = Array.from(
      new Set(
        serializedTemplateTasks
          .map((task) => String(task.ownerCode || "").trim().toUpperCase())
          .filter(Boolean)
      )
    ).sort();

    const roleAssignmentMap = new Map(
      normalizedRoleAssignments.map((assignment) => [assignment.ownerCode, assignment.userId])
    );

    const missingRoles = templateRoles.filter((ownerCode) => !roleAssignmentMap.has(ownerCode));
    if (missingRoles.length) {
      return NextResponse.json(
        { error: `Assign a user for every template role. Missing: ${missingRoles.join(", ")}` },
        { status: 400 }
      );
    }

    const masterClient = await masterClientPromise;
    const masterDb = masterClient.db(masterDatabaseName);
    const assignedUserIds = Array.from(new Set(normalizedRoleAssignments.map((assignment) => assignment.userId)));
    const assignedUsers = await masterDb
      .collection(USER_COLLECTION)
      .find(
        { _id: { $in: assignedUserIds.map((id) => new ObjectId(id)) }, isActive: { $ne: false } },
        { projection: { password: 0 } }
      )
      .toArray();

    const userById = new Map(assignedUsers.map((user) => [user._id.toString(), user]));
    const unresolvedAssignments = assignedUserIds.filter((userId) => !userById.has(userId));
    if (unresolvedAssignments.length) {
      return NextResponse.json({ error: "One or more assigned users are missing or inactive" }, { status: 400 });
    }

    const filteredTemplateTasks = serializedTemplateTasks.filter((task) =>
      selectedSpaceKeys.includes(normalizeSpaceKey(task.spacesName))
    );

    if (!filteredTemplateTasks.length) {
      return NextResponse.json({ error: "No tasks remain after applying selected spaces" }, { status: 400 });
    }

    const templateTaskMap = new Map(serializedTemplateTasks.map((task) => [task._id, task]));
    const keptTaskIds = new Set(filteredTemplateTasks.map((task) => task._id));

    const projectId = new ObjectId();
    const taskIdMap = new Map(filteredTemplateTasks.map((task) => [task._id, new ObjectId()]));
    const now = new Date();

    const roleAssignmentSnapshots = normalizedRoleAssignments.map((assignment) => {
      const user = userById.get(assignment.userId);
      return {
        ownerCode: assignment.ownerCode,
        userId: assignment.userId,
        username: user?.username || "",
        displayName: user ? buildDisplayName(user) : "",
        email: user?.email || "",
      };
    });
    const roleSnapshotMap = new Map(roleAssignmentSnapshots.map((assignment) => [assignment.ownerCode, assignment]));

    const projectTasks = filteredTemplateTasks.map((task) => {
      const normalizedOwnerCode = String(task.ownerCode || "").trim().toUpperCase();
      const roleAssignment = normalizedOwnerCode ? roleSnapshotMap.get(normalizedOwnerCode) || null : null;
      const resolvedDependencyTemplateTaskIds = resolveDependencyIds(
        task.dependsOnTaskIds,
        keptTaskIds,
        templateTaskMap,
        task._id
      );

      return {
        ...task,
        _id: taskIdMap.get(task._id),
        projectId,
        templateTaskId: new ObjectId(task._id),
        templateId: templateObjectId,
        dependsOnTaskIds: resolvedDependencyTemplateTaskIds
          .map((dependencyId) => taskIdMap.get(dependencyId))
          .filter(Boolean),
        templateDependsOnTaskIds: task.dependsOnTaskIds || [],
        resolvedTemplateDependencyIds: resolvedDependencyTemplateTaskIds,
        relationshipType: resolvedDependencyTemplateTaskIds.length
          ? task.relationshipType || "sequential"
          : "root",
        ownerCode: normalizedOwnerCode,
        assigneeUserId: roleAssignment?.userId || "",
        assigneeName: roleAssignment?.displayName || task.assigneeName || "",
        assignedUsername: roleAssignment?.username || "",
        assignedUserEmail: roleAssignment?.email || "",
        isDone: false,
        isActive: false,
        createdAt: now,
        updatedAt: now,
      };
    });
    const projectStarted = shouldActivateProject(parsedStartDate, startDateUndecided);
    const statefulProjectTasks = recalculateProjectTaskState(projectTasks, { projectStarted });
    const activeTaskSnapshot = buildActiveTaskSnapshot(statefulProjectTasks);

    const availableSpaces = Array.from(
      new Map(
        serializedTemplateTasks.map((task) => {
          const key = normalizeSpaceKey(task.spacesName);
          return [
            key,
            {
              key,
              label: String(task.spacesName || "").trim() || "Unassigned Space",
            },
          ];
        })
      ).values()
    );

    const selectedSpaceDetails = availableSpaces.filter((space) => selectedSpaceKeys.includes(space.key));
    const projectDocument = {
      _id: projectId,
      name: String(name).trim(),
      description: String(description || "").trim(),
      address: String(address || "").trim(),
      templateId: templateObjectId,
      templateName: String(template.name || "").trim(),
      templateSourceFileName: String(template.sourceFileName || "").trim(),
      startDate: startDateUndecided ? null : parsedStartDate,
      startDateUndecided: Boolean(startDateUndecided),
      selectedSpaces: selectedSpaceDetails,
      roleAssignments: roleAssignmentSnapshots,
      totalTasks: statefulProjectTasks.length,
      active_task: activeTaskSnapshot,
      deleteApprovalStatus: "active",
      deleteApprovalRequestedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    const projectTaskBundle = {
      projectId,
      totalTasks: statefulProjectTasks.length,
      tasks: statefulProjectTasks.map((task) => serializeTask(task)),
      createdAt: now,
      updatedAt: now,
    };

    await db.collection("fms_projects").insertOne(projectDocument);
    await db.collection("fms_project_task_bundles").insertOne(projectTaskBundle);
    void setCachedProjectTasks(projectId.toString(), projectTaskBundle.tasks);

    return NextResponse.json(
      {
        message: "Project created successfully",
        project: serializeProject(projectDocument),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating project:", error);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}
