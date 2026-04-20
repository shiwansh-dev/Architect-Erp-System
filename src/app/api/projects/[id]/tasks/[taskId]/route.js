import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise, { databaseName } from "@/lib/mongodb-fms-template";
import { serializeTask } from "@/lib/fms-template";
import { setCachedProjectTasks } from "@/lib/project-task-cache";
import {
  buildActiveTaskSnapshot,
  recalculateProjectTaskState,
  shouldActivateProject,
} from "@/lib/project-task-state";

export const runtime = "nodejs";

const DEFAULT_NODE_WIDTH = 280;
const DEFAULT_NODE_HEIGHT = 132;

function normalizeAllottedDays(value) {
  const normalized = String(value ?? "").trim();
  return normalized || "1";
}

function sanitizeTaskPatch(body) {
  const editableFields = [
    "title",
    "taskForDelegation",
    "mainHeading",
    "subHeading",
    "taskNumber",
    "processes",
    "parallelSteps",
    "taskDescription",
    "ownerCode",
    "methodCode",
    "howWillItBeDone",
    "dueRule",
    "processNotes",
    "spacesName",
    "plannedFmsDate",
    "delegationDate",
    "changedDelegationDate",
    "secondaryDelegationDate",
    "drawingNumber",
    "status",
    "assigneeName",
    "allottedDays",
    "reasonComment",
    "taskLink",
    "reviewCode",
    "reviewName",
    "supportCode",
    "supportName",
    "relationshipType",
  ];

  const update = {};
  editableFields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      const nextValue = typeof body[field] === "string" ? body[field].trim() : body[field];
      update[field] =
        field === "ownerCode" && typeof nextValue === "string"
          ? nextValue.toUpperCase()
          : field === "allottedDays"
            ? normalizeAllottedDays(nextValue)
            : nextValue;
    }
  });

  if (Array.isArray(body.dependsOnTaskIds)) {
    update.dependsOnTaskIds = body.dependsOnTaskIds.filter(Boolean).map((value) => String(value));
  }

  if (body.position && typeof body.position === "object") {
    update.position = {
      x: Number(body.position.x) || 0,
      y: Number(body.position.y) || 0,
      width: Number(body.position.width) || DEFAULT_NODE_WIDTH,
      height: Number(body.position.height) || DEFAULT_NODE_HEIGHT,
    };
  }

  return update;
}

function resolveDependencyIds(dependsOnTaskIds, keptTaskIds, taskMap, currentTaskId) {
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

    const dependencyTask = taskMap.get(normalizedId);
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

export async function PATCH(request, { params }) {
  try {
    const { id, taskId } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const client = await clientPromise;
    const db = client.db(databaseName);
    const projectObjectId = new ObjectId(id);
    const taskIdString = String(taskId || "").trim();

    const bundle = await db.collection("fms_project_task_bundles").findOne({ projectId: projectObjectId });
    const project = await db.collection("fms_projects").findOne({ _id: projectObjectId });
    if (!bundle || !Array.isArray(bundle.tasks)) {
      return NextResponse.json({ error: "Project task bundle not found" }, { status: 404 });
    }

    const taskIndex = bundle.tasks.findIndex((task) => String(task?._id || "") === taskIdString);
    if (taskIndex === -1) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const patch = sanitizeTaskPatch(body);
    const now = new Date();
    const currentTask = bundle.tasks[taskIndex];
    const updatedTask = {
      ...currentTask,
      ...patch,
      updatedAt: now,
    };

    const nextTasks = [...bundle.tasks];
    nextTasks[taskIndex] = updatedTask;
    const statefulTasks = recalculateProjectTaskState(nextTasks, {
      projectStarted: shouldActivateProject(project?.startDate, project?.startDateUndecided),
    });

    await Promise.all([
      db.collection("fms_project_task_bundles").updateOne(
        { projectId: projectObjectId },
        {
          $set: {
            tasks: statefulTasks,
            totalTasks: statefulTasks.length,
            updatedAt: now,
          },
        }
      ),
      db.collection("fms_projects").updateOne(
        { _id: projectObjectId },
        {
          $set: {
            active_task: buildActiveTaskSnapshot(statefulTasks),
            updatedAt: now,
          },
        }
      ),
    ]);

    const serializedUpdatedTask = serializeTask(statefulTasks[taskIndex]);
    void setCachedProjectTasks(id, statefulTasks.map(serializeTask));

    return NextResponse.json({
      message: "Task updated successfully",
      task: serializedUpdatedTask,
    });
  } catch (error) {
    console.error("Error updating project task:", error);
    return NextResponse.json({ error: "Failed to update project task" }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  try {
    const { id, taskId } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(databaseName);
    const projectObjectId = new ObjectId(id);
    const taskIdString = String(taskId || "").trim();

    const bundle = await db.collection("fms_project_task_bundles").findOne({ projectId: projectObjectId });
    const project = await db.collection("fms_projects").findOne({ _id: projectObjectId });
    if (!bundle || !Array.isArray(bundle.tasks)) {
      return NextResponse.json({ error: "Project task bundle not found" }, { status: 404 });
    }

    const existingTask = bundle.tasks.find((task) => String(task?._id || "") === taskIdString);
    if (!existingTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const remainingTasks = bundle.tasks.filter((task) => String(task?._id || "") !== taskIdString);
    const taskMap = new Map(bundle.tasks.map((task) => [String(task?._id || ""), task]));
    const keptTaskIds = new Set(remainingTasks.map((task) => String(task?._id || "")));
    const now = new Date();

    const nextTasks = remainingTasks.map((task) => {
      const nextDependencyIds = resolveDependencyIds(
        task.dependsOnTaskIds,
        keptTaskIds,
        taskMap,
        String(task?._id || "")
      ).filter((dependencyId) => dependencyId !== String(task?._id || ""));

      return {
        ...task,
        dependsOnTaskIds: nextDependencyIds,
        relationshipType: nextDependencyIds.length ? task.relationshipType || "sequential" : "root",
        updatedAt: now,
      };
    });
    const statefulTasks = recalculateProjectTaskState(nextTasks, {
      projectStarted: shouldActivateProject(project?.startDate, project?.startDateUndecided),
    });

    await Promise.all([
      db.collection("fms_project_task_bundles").updateOne(
        { projectId: projectObjectId },
        {
          $set: {
            tasks: statefulTasks,
            totalTasks: statefulTasks.length,
            updatedAt: now,
          },
        }
      ),
      db.collection("fms_projects").updateOne(
        { _id: projectObjectId },
        {
          $set: {
            active_task: buildActiveTaskSnapshot(statefulTasks),
            totalTasks: statefulTasks.length,
            updatedAt: now,
          },
        }
      ),
    ]);

    void setCachedProjectTasks(id, statefulTasks.map(serializeTask));

    return NextResponse.json({
      message: "Task deleted successfully",
      deletedTaskId: taskIdString,
      totalTasks: statefulTasks.length,
    });
  } catch (error) {
    console.error("Error deleting project task:", error);
    return NextResponse.json({ error: "Failed to delete project task" }, { status: 500 });
  }
}
