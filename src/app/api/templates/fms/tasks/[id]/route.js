import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise, { databaseName } from "@/lib/mongodb-fms-template";
import { sanitizeTaskPatch, serializeTask } from "@/lib/fms-template";
import {
  updateCachedTemplateTask,
} from "@/lib/fms-template-cache";

export const runtime = "nodejs";

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid task id" }, { status: 400 });
    }

    const body = await request.json();
    const update = sanitizeTaskPatch(body);

    const client = await clientPromise;
    const db = client.db(databaseName);
    const _id = new ObjectId(id);

    const result = await db.collection("fms_template_tasks").updateOne(
      { _id },
      { $set: update }
    );

    if (!result.matchedCount) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const updatedTask = await db.collection("fms_template_tasks").findOne({ _id });
    if (!updatedTask) {
      return NextResponse.json({ error: "Task not found after update" }, { status: 404 });
    }

    void updateCachedTemplateTask(updatedTask.templateId.toString(), updatedTask);

    return NextResponse.json({
      message: "Task updated successfully",
      task: serializeTask(updatedTask),
    });
  } catch (error) {
    console.error("Error updating FMS task:", error);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}
