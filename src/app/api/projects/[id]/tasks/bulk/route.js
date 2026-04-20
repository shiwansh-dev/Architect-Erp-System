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
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const taskIds = Array.isArray(body.taskIds) ? body.taskIds.filter(Boolean).map((value) => String(value)) : [];
    if (!taskIds.length) {
      return NextResponse.json({ error: "No tasks selected" }, { status: 400 });
    }

    const action = String(body.action || "").trim().toLowerCase();
    const patch = sanitizeTaskPatch(body.patch || {});
    if (!Object.keys(patch).length && !["mark_done", "mark_undone"].includes(action)) {
      return NextResponse.json({ error: "No fields provided to update" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(databaseName);
    const projectObjectId = new ObjectId(id);
    const bundle = await db.collection("fms_project_task_bundles").findOne({ projectId: projectObjectId });
    const project = await db.collection("fms_projects").findOne({ _id: projectObjectId });
    if (!bundle || !Array.isArray(bundle.tasks)) {
      return NextResponse.json({ error: "Project task bundle not found" }, { status: 404 });
    }

    const taskIdSet = new Set(taskIds);
    const now = new Date();
    let updatedCount = 0;
    let nextTasks = bundle.tasks.map((task) => {
      const taskId = String(task?._id || "");
      if (!taskIdSet.has(taskId)) {
        return task;
      }
      updatedCount += 1;
      return {
        ...task,
        ...patch,
        updatedAt: now,
      };
    });
    if (action === "mark_done" || action === "mark_undone") {
      const nextDoneValue = action === "mark_done";
      nextTasks = nextTasks.map((task) => {
        const taskId = String(task?._id || "");
        if (!taskIdSet.has(taskId)) {
          return task;
        }
        return {
          ...task,
          isDone: nextDoneValue,
          updatedAt: now,
        };
      });
    }
    nextTasks = recalculateProjectTaskState(nextTasks, {
      projectStarted: shouldActivateProject(project?.startDate, project?.startDateUndecided),
    });

    await Promise.all([
      db.collection("fms_project_task_bundles").updateOne(
        { projectId: projectObjectId },
        {
          $set: {
            tasks: nextTasks,
            totalTasks: nextTasks.length,
            updatedAt: now,
          },
        }
      ),
      db.collection("fms_projects").updateOne(
        { _id: projectObjectId },
        {
          $set: {
            active_task: buildActiveTaskSnapshot(nextTasks),
            totalTasks: nextTasks.length,
            updatedAt: now,
          },
        }
      ),
    ]);

    const serializedTasks = nextTasks.map(serializeTask);
    await setCachedProjectTasks(id, serializedTasks, now);

    return NextResponse.json({
      message:
        action === "mark_done"
          ? "Tasks marked done successfully"
          : action === "mark_undone"
            ? "Tasks marked undone successfully"
            : "Tasks updated successfully",
      updatedCount,
      tasks: serializedTasks,
      totalTasks: serializedTasks.length,
    });
  } catch (error) {
    console.error("Error bulk updating project tasks:", error);
    return NextResponse.json({ error: "Failed to update project tasks" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const taskIds = Array.isArray(body.taskIds) ? body.taskIds.filter(Boolean).map((value) => String(value)) : [];
    if (!taskIds.length) {
      return NextResponse.json({ error: "No tasks selected" }, { status: 400 });
    }

    const taskIdSet = new Set(taskIds);
    const client = await clientPromise;
    const db = client.db(databaseName);
    const projectObjectId = new ObjectId(id);
    const bundle = await db.collection("fms_project_task_bundles").findOne({ projectId: projectObjectId });
    const project = await db.collection("fms_projects").findOne({ _id: projectObjectId });
    if (!bundle || !Array.isArray(bundle.tasks)) {
      return NextResponse.json({ error: "Project task bundle not found" }, { status: 404 });
    }

    const remainingTasks = bundle.tasks.filter((task) => !taskIdSet.has(String(task?._id || "")));
    if (remainingTasks.length === bundle.tasks.length) {
      return NextResponse.json({ error: "Selected tasks not found" }, { status: 404 });
    }

    const taskMap = new Map(bundle.tasks.map((task) => [String(task?._id || ""), task]));
    const keptTaskIds = new Set(remainingTasks.map((task) => String(task?._id || "")));
    const now = new Date();

    let nextTasks = remainingTasks.map((task) => {
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
    nextTasks = recalculateProjectTaskState(nextTasks, {
      projectStarted: shouldActivateProject(project?.startDate, project?.startDateUndecided),
    });

    await Promise.all([
      db.collection("fms_project_task_bundles").updateOne(
        { projectId: projectObjectId },
        {
          $set: {
            tasks: nextTasks,
            totalTasks: nextTasks.length,
            updatedAt: now,
          },
        }
      ),
      db.collection("fms_projects").updateOne(
        { _id: projectObjectId },
        {
          $set: {
            active_task: buildActiveTaskSnapshot(nextTasks),
            totalTasks: nextTasks.length,
            updatedAt: now,
          },
        }
      ),
    ]);

    const serializedTasks = nextTasks.map(serializeTask);
    await setCachedProjectTasks(id, serializedTasks, now);

    return NextResponse.json({
      message: "Tasks deleted successfully",
      deletedTaskIds: taskIds,
      tasks: serializedTasks,
      totalTasks: serializedTasks.length,
    });
  } catch (error) {
    console.error("Error bulk deleting project tasks:", error);
    return NextResponse.json({ error: "Failed to delete project tasks" }, { status: 500 });
  }
}
