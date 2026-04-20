import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise, { databaseName } from "@/lib/mongodb-fms-template";
import { deleteCachedProjectTasks } from "@/lib/project-task-cache";

export const runtime = "nodejs";

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "").trim();
    if (!["restore", "approve-delete"].includes(action)) {
      return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(databaseName);
    const _id = new ObjectId(id);

    if (action === "restore") {
      const result = await db.collection("fms_projects").findOneAndUpdate(
        { _id, deleteApprovalStatus: "pending" },
        {
          $set: {
            deleteApprovalStatus: "active",
            deleteApprovalRequestedAt: null,
            updatedAt: new Date(),
          },
        },
        { returnDocument: "after" }
      );

      if (!result) {
        return NextResponse.json({ error: "Project not found in delete approval" }, { status: 404 });
      }

      void deleteCachedProjectTasks(id);

      return NextResponse.json({ message: "Project restored successfully" });
    }

    const projectDeletion = await db.collection("fms_projects").deleteOne({ _id, deleteApprovalStatus: "pending" });

    if (!projectDeletion.deletedCount) {
      return NextResponse.json({ error: "Project not found in delete approval" }, { status: 404 });
    }

    const bundleDeletion = await db.collection("fms_project_task_bundles").deleteOne({ projectId: _id });
    void deleteCachedProjectTasks(id);

    return NextResponse.json({
      message: "Project deleted permanently",
      deletedBundleCount: bundleDeletion.deletedCount,
    });
  } catch (error) {
    console.error("Error handling project approval action:", error);
    return NextResponse.json({ error: "Failed to process approval action" }, { status: 500 });
  }
}
