import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise, { databaseName } from "@/lib/mongodb-fms-template";
import { serializeTask } from "@/lib/fms-template";
import {
  getCachedProjectTaskBundle,
  setCachedProjectTasks,
  deleteCachedProjectTasks,
  normalizeUpdatedAt,
} from "@/lib/project-task-cache";
import {
  buildActiveTaskSnapshot,
  recalculateProjectTaskState,
  shouldActivateProject,
} from "@/lib/project-task-state";

export const runtime = "nodejs";

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

function projectTaskProjection(task) {
  return {
    _id: task._id,
    projectId: task.projectId?.toString ? task.projectId.toString() : String(task.projectId || ""),
    templateId: task.templateId?.toString ? task.templateId.toString() : String(task.templateId || ""),
    rowNumber: task.rowNumber,
    taskNumber: task.taskNumber,
    taskForDelegation: task.taskForDelegation,
    mainHeading: task.mainHeading,
    subHeading: task.subHeading,
    title: task.title,
    processes: task.processes,
    parallelSteps: task.parallelSteps,
    taskDescription: task.taskDescription,
    ownerCode: task.ownerCode,
    howWillItBeDone: task.howWillItBeDone,
    spacesName: task.spacesName,
    delegationDate: task.delegationDate,
    changedDelegationDate: task.changedDelegationDate,
    secondaryDelegationDate: task.secondaryDelegationDate,
    drawingNumber: task.drawingNumber,
    status: task.status,
    assigneeName: task.assigneeName,
    allottedDays: task.allottedDays,
    relationshipType: task.relationshipType,
    dependsOnTaskIds: task.dependsOnTaskIds,
    position: task.position,
    dueRule: task.dueRule,
    taskLink: task.taskLink,
    rawCells: task.rawCells,
    isActive: Boolean(task.isActive),
    isDone: Boolean(task.isDone),
  };
}

async function loadProjectTasks(db, project) {
  const projectId = project?._id;
  const projectStarted = shouldActivateProject(project?.startDate, project?.startDateUndecided);
  const projectUpdatedAt = normalizeUpdatedAt(project?.updatedAt);
  const cachedBundle = await getCachedProjectTaskBundle(projectId.toString());
  if (Array.isArray(cachedBundle?.tasks) && cachedBundle.updatedAt === projectUpdatedAt) {
    const normalizedTasks = recalculateProjectTaskState(cachedBundle.tasks.map(serializeTask), {
      projectStarted,
    }).map(serializeTask);
    await setCachedProjectTasks(projectId.toString(), normalizedTasks, projectUpdatedAt);
    return normalizedTasks;
  }

  const bundle = await db.collection("fms_project_task_bundles").findOne({ projectId });
  if (bundle && Array.isArray(bundle.tasks)) {
    const serializedTasks = recalculateProjectTaskState(bundle.tasks, {
      projectStarted,
    }).map(serializeTask);
    await setCachedProjectTasks(projectId.toString(), serializedTasks, projectUpdatedAt || bundle.updatedAt);
    return serializedTasks;
  }
  return [];
}

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view") || "full";
    const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1);
    const limitParam = Number.parseInt(searchParams.get("limit") || "100", 10) || 100;
    const limit = Math.min(Math.max(limitParam, 1), 500);

    const client = await clientPromise;
    const db = client.db(databaseName);
    const _id = new ObjectId(id);

    const [project] = await Promise.all([
      db.collection("fms_projects").findOne({ _id }),
    ]);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const template = project.templateId
      ? await db.collection("fms_templates").findOne(
          { _id: project.templateId },
          { projection: { name: 1, headerRow1: 1, headerRow2: 1, totalTasks: 1 } }
        )
      : null;

    const serializedTasks = await loadProjectTasks(db, project);
    const projectedTasks =
      view === "flow"
        ? serializedTasks.map(projectTaskProjection)
        : serializedTasks;

    const shouldPaginate = view === "table" || view === "flow";
    const taskRows = shouldPaginate
      ? projectedTasks.slice((page - 1) * limit, page * limit)
      : projectedTasks;
    const totalTasks = projectedTasks.length;
    const totalPages = Math.max(1, Math.ceil(totalTasks / limit));

    return NextResponse.json({
      project: {
        ...serializeProject(project),
        active_task: buildActiveTaskSnapshot(serializedTasks),
        totalTasks,
      },
      template: template
        ? {
            _id: template._id.toString(),
            name: template.name || "",
            headerRow1: Array.isArray(template.headerRow1) ? template.headerRow1 : [],
            headerRow2: Array.isArray(template.headerRow2) ? template.headerRow2 : [],
            totalTasks: template.totalTasks || 0,
          }
        : null,
      tasks: taskRows,
      pagination: shouldPaginate
        ? {
            currentPage: page,
            limit,
            totalTasks,
            totalPages,
            hasPrevPage: page > 1,
            hasNextPage: page < totalPages,
          }
        : null,
    });
  } catch (error) {
    console.error("Error fetching project:", error);
    return NextResponse.json({ error: "Failed to load project" }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const name = String(body.name || "").trim();
    const description = String(body.description || "").trim();
    const address = String(body.address || "").trim();
    const startDateUndecided = Boolean(body.startDateUndecided);
    const startDateValue = body.startDate;

    if (!name) {
      return NextResponse.json({ error: "Project name is required" }, { status: 400 });
    }

    let parsedStartDate = null;
    if (!startDateUndecided && startDateValue) {
      parsedStartDate = new Date(startDateValue);
      if (Number.isNaN(parsedStartDate.getTime())) {
        return NextResponse.json({ error: "Invalid project start date" }, { status: 400 });
      }
    }

    const client = await clientPromise;
    const db = client.db(databaseName);
    const _id = new ObjectId(id);

    const existingProject = await db.collection("fms_projects").findOne({ _id });
    if (!existingProject) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const projectStarted = shouldActivateProject(parsedStartDate, startDateUndecided);
    const bundle = await db.collection("fms_project_task_bundles").findOne({ projectId: _id });
    const nextTasks = Array.isArray(bundle?.tasks)
      ? recalculateProjectTaskState(bundle.tasks, { projectStarted })
      : [];

    const result = await db.collection("fms_projects").findOneAndUpdate(
      { _id },
      {
        $set: {
          name,
          description,
          address,
          startDate: startDateUndecided ? null : parsedStartDate,
          startDateUndecided,
          active_task: buildActiveTaskSnapshot(nextTasks),
          updatedAt: new Date(),
        },
      },
      { returnDocument: "after" }
    );

    if (Array.isArray(bundle?.tasks)) {
      const serializedTasks = nextTasks.map(serializeTask);
      await db.collection("fms_project_task_bundles").updateOne(
        { projectId: _id },
        {
          $set: {
            tasks: serializedTasks,
            totalTasks: serializedTasks.length,
            updatedAt: new Date(),
          },
        }
      );
      await setCachedProjectTasks(id, serializedTasks, result?.updatedAt || new Date());
    }

    return NextResponse.json({
      message: "Project updated successfully",
      project: serializeProject(result),
    });
  } catch (error) {
    console.error("Error updating project:", error);
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(databaseName);
    const _id = new ObjectId(id);

    const result = await db.collection("fms_projects").findOneAndUpdate(
      { _id, deleteApprovalStatus: { $ne: "pending" } },
      {
        $set: {
          deleteApprovalStatus: "pending",
          deleteApprovalRequestedAt: new Date(),
          updatedAt: new Date(),
        },
      },
      { returnDocument: "after" }
    );

    if (!result) {
      return NextResponse.json({ error: "Project not found or already pending deletion" }, { status: 404 });
    }

    void deleteCachedProjectTasks(id);

    return NextResponse.json({
      message: "Project moved to delete approval",
      project: serializeProject(result),
    });
  } catch (error) {
    console.error("Error requesting project deletion:", error);
    return NextResponse.json({ error: "Failed to request project deletion" }, { status: 500 });
  }
}
