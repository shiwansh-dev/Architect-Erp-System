import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise, { databaseName } from "@/lib/mongodb-fms-template";
import {
  getCachedTemplateBundle,
  syncTemplateBundleCache,
} from "@/lib/fms-template-cache";

export const runtime = "nodejs";

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
    const allTasks = Array.isArray(bundle.tasks) ? bundle.tasks : [];
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
            assigneeName: task.assigneeName,
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

    return NextResponse.json({
      template: bundle.template,
      tasks: taskRows,
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
