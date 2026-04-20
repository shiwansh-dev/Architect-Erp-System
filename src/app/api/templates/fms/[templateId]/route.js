import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise, { databaseName } from "@/lib/mongodb-fms-template";
import masterClientPromise, { databaseName as masterDatabaseName } from "@/lib/mongodb";
import { serializeTask, serializeTemplate } from "@/lib/fms-template";
import {
  getCachedTemplateBundle,
  invalidateTemplateBundleCache,
  syncTemplateBundleCache,
  syncTemplateListCache,
} from "@/lib/fms-template-cache";

export const runtime = "nodejs";
const TEMPLATE_ARCHIVE_COLLECTION = "fms_template_archive";

async function getActiveOwnerCodes() {
  const masterClient = await masterClientPromise;
  const masterDb = masterClient.db(masterDatabaseName);
  const roles = await masterDb
    .collection("master_roles")
    .find({ isActive: { $ne: false } }, { projection: { roleCode: 1 } })
    .sort({ roleCode: 1 })
    .toArray();

  return roles
    .map((role) => String(role.roleCode || "").trim().toUpperCase())
    .filter(Boolean);
}

function buildValidationMeta(allTasks, taskRows, ownerCodes, limit) {
  const ownerCodeSet = new Set(ownerCodes);
  const shouldValidateOwnerCodes = ownerCodeSet.size > 0;
  const invalidTasks = shouldValidateOwnerCodes
    ? allTasks.filter((task) => {
        const ownerCode = String(task.ownerCode || "").trim().toUpperCase();
        return Boolean(ownerCode) && !ownerCodeSet.has(ownerCode);
      })
    : [];

  const invalidTaskIds = new Set(invalidTasks.map((task) => task._id));
  const currentPageInvalidTaskIds = taskRows
    .filter((task) => invalidTaskIds.has(task._id))
    .map((task) => task._id);
  const firstInvalidTask = invalidTasks[0] || null;

  return {
    invalidOwnerCodeCount: invalidTasks.length,
    currentPageInvalidTaskIds,
    firstInvalidTaskId: firstInvalidTask?._id || "",
    firstInvalidPage: firstInvalidTask ? Math.floor(allTasks.findIndex((task) => task._id === firstInvalidTask._id) / limit) + 1 : null,
    ownerCodes,
  };
}

function attachOwnerCodeErrors(tasks, invalidTaskIds) {
  const invalidSet = new Set(invalidTaskIds);
  return tasks.map((task) => ({
    ...task,
    hasOwnerCodeError: invalidSet.has(task._id),
  }));
}

export async function GET(_request, { params }) {
  try {
    const { templateId } = await params;
    const requestUrl = _request?.url ? new URL(_request.url) : null;
    const view = requestUrl?.searchParams.get("view") || "full";
    const page = Math.max(1, Number.parseInt(requestUrl?.searchParams.get("page") || "1", 10) || 1);
    const limitParam = Number.parseInt(requestUrl?.searchParams.get("limit") || "100", 10) || 100;
    const limit = Math.min(Math.max(limitParam, 1), 500);

    if (!ObjectId.isValid(templateId)) {
      return NextResponse.json({ error: "Invalid template id" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(databaseName);
    const _id = new ObjectId(templateId);
    const cachedBundle = await getCachedTemplateBundle(templateId);
    const bundle = cachedBundle || (await syncTemplateBundleCache(db, _id));

    if (!bundle?.template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    const normalizedTemplate = serializeTemplate(bundle.template);
    const ownerCodes = await getActiveOwnerCodes();
    const allTasks = Array.isArray(bundle.tasks) ? bundle.tasks.map(serializeTask) : [];
    const totalTasks = allTasks.length;
    const projectedTasks =
      view === "flow"
        ? allTasks.map((task) => ({
            _id: task._id,
            templateId: task.templateId,
            rowNumber: task.rowNumber,
            taskNumber: task.taskNumber,
            title: task.title,
            processes: task.processes,
            parallelSteps: task.parallelSteps,
            taskDescription: task.taskDescription,
            ownerCode: task.ownerCode,
            howWillItBeDone: task.howWillItBeDone,
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
            mainHeading: task.mainHeading,
            subHeading: task.subHeading,
            dueRule: task.dueRule,
            taskLink: task.taskLink,
          }))
        : allTasks;

    const shouldPaginate = view === "table" || view === "flow";
    const taskRows = shouldPaginate
      ? projectedTasks.slice((page - 1) * limit, page * limit)
      : projectedTasks;
    const totalPages = Math.max(1, Math.ceil(totalTasks / limit));
    const validation = buildValidationMeta(allTasks, taskRows, ownerCodes, limit);

    return NextResponse.json({
      template: normalizedTemplate,
      tasks: attachOwnerCodeErrors(taskRows, validation.currentPageInvalidTaskIds),
      ownerCodes,
      validation,
      pagination:
        shouldPaginate
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
    console.error("Error fetching template details:", error);
    return NextResponse.json(
      { error: "Failed to load template details" },
      { status: 500 }
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    const { templateId } = await params;

    if (!ObjectId.isValid(templateId)) {
      return NextResponse.json({ error: "Invalid template id" }, { status: 400 });
    }

    const requestUrl = request?.url ? new URL(request.url) : null;
    const page = Math.max(1, Number.parseInt(requestUrl?.searchParams.get("page") || "1", 10) || 1);
    const limitParam = Number.parseInt(requestUrl?.searchParams.get("limit") || "100", 10) || 100;
    const limit = Math.min(Math.max(limitParam, 1), 500);
    const body = await request.json().catch(() => ({}));

    if (!body?.action) {
      return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(databaseName);
    const _id = new ObjectId(templateId);
    const now = new Date();

    const template = await db.collection("fms_templates").findOne({ _id });
    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    if (body.action === "reset-layout") {
      await db.collection("fms_template_tasks").updateMany(
        { templateId: _id },
        {
          $unset: { position: "" },
          $set: { updatedAt: now },
        }
      );

      await db.collection("fms_templates").updateOne(
        { _id },
        { $set: { updatedAt: now } }
      );
    } else if (body.action === "save-layout") {
      const tasks = Array.isArray(body.tasks) ? body.tasks : [];
      if (!tasks.length) {
        return NextResponse.json({ error: "No task positions provided" }, { status: 400 });
      }

      const operations = tasks
        .filter(
          (task) =>
            ObjectId.isValid(task?._id) &&
            task?.position &&
            typeof task.position === "object"
        )
        .map((task) => ({
          updateOne: {
            filter: {
              _id: new ObjectId(task._id),
              templateId: _id,
            },
            update: {
              $set: {
                position: {
                  x: Number(task.position.x) || 0,
                  y: Number(task.position.y) || 0,
                  width: Number(task.position.width) || 280,
                  height: Number(task.position.height) || 132,
                },
                updatedAt: now,
              },
            },
          },
        }));

      if (!operations.length) {
        return NextResponse.json({ error: "No valid task positions provided" }, { status: 400 });
      }

      await db.collection("fms_template_tasks").bulkWrite(operations, { ordered: false });
      await db.collection("fms_templates").updateOne(
        { _id },
        { $set: { updatedAt: now } }
      );
    } else if (body.action === "update-metadata") {
      const name = String(body.name || "").trim();
      if (!name) {
        return NextResponse.json({ error: "Template name is required" }, { status: 400 });
      }

      await db.collection("fms_templates").updateOne(
        { _id },
        {
          $set: {
            name,
            updatedAt: now,
          },
        }
      );
    } else {
      return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
    }

    const bundle = await syncTemplateBundleCache(db, _id);
    const normalizedTemplate = bundle?.template ? serializeTemplate(bundle.template) : null;
    const ownerCodes = await getActiveOwnerCodes();
    const allTasks = Array.isArray(bundle?.tasks) ? bundle.tasks.map(serializeTask) : [];
    const projectedTasks = allTasks.map((task) => ({
      _id: task._id,
      templateId: task.templateId,
      rowNumber: task.rowNumber,
      taskNumber: task.taskNumber,
      title: task.title,
      processes: task.processes,
      parallelSteps: task.parallelSteps,
      taskDescription: task.taskDescription,
      ownerCode: task.ownerCode,
      howWillItBeDone: task.howWillItBeDone,
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
      mainHeading: task.mainHeading,
      subHeading: task.subHeading,
      dueRule: task.dueRule,
      taskLink: task.taskLink,
    }));
    const totalTasks = projectedTasks.length;
    const totalPages = Math.max(1, Math.ceil(totalTasks / limit));
    const taskRows = projectedTasks.slice((page - 1) * limit, page * limit);
    const validation = buildValidationMeta(allTasks, taskRows, ownerCodes, limit);

    return NextResponse.json({
      message:
        body.action === "save-layout"
          ? "Layout saved successfully"
          : body.action === "update-metadata"
            ? "Template updated successfully"
            : "Layout reset successfully",
      template: normalizedTemplate,
      tasks: attachOwnerCodeErrors(taskRows, validation.currentPageInvalidTaskIds),
      ownerCodes,
      validation,
      pagination: {
        currentPage: page,
        limit,
        totalTasks,
        totalPages,
        hasPrevPage: page > 1,
        hasNextPage: page < totalPages,
      },
    });
  } catch (error) {
    console.error("Error resetting FMS template layout:", error);
    return NextResponse.json(
      { error: "Failed to reset template layout" },
      { status: 500 }
    );
  }
}

export async function DELETE(_request, { params }) {
  try {
    const { templateId } = await params;

    if (!ObjectId.isValid(templateId)) {
      return NextResponse.json({ error: "Invalid template id" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(databaseName);
    const _id = new ObjectId(templateId);

    const [template, tasks] = await Promise.all([
      db.collection("fms_templates").findOne({ _id }),
      db.collection("fms_template_tasks").find({ templateId: _id }).sort({ rowNumber: 1 }).toArray(),
    ]);

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const now = new Date();
    await db.collection(TEMPLATE_ARCHIVE_COLLECTION).insertOne({
      templateId: _id,
      archivedAt: now,
      template: {
        ...template,
        archivedAt: now,
      },
      tasks,
      totalTasks: tasks.length,
    });

    await Promise.all([
      db.collection("fms_template_tasks").deleteMany({ templateId: _id }),
      db.collection("fms_templates").deleteOne({ _id }),
    ]);

    await Promise.all([
      invalidateTemplateBundleCache(templateId),
      syncTemplateListCache(db),
    ]);

    return NextResponse.json({
      message: "Template archived successfully",
      archivedTemplateId: templateId,
    });
  } catch (error) {
    console.error("Error archiving template:", error);
    return NextResponse.json(
      { error: "Failed to archive template" },
      { status: 500 }
    );
  }
}
