import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise, { databaseName } from "@/lib/mongodb";

function normalizeRolePayload(body = {}) {
  const update = {};

  if (Object.prototype.hasOwnProperty.call(body, "roleCode")) {
    update.roleCode = String(body.roleCode || "")
      .trim()
      .toUpperCase();
  }

  if (Object.prototype.hasOwnProperty.call(body, "roleName")) {
    update.roleName = String(body.roleName || "").trim();
  }

  if (Object.prototype.hasOwnProperty.call(body, "isActive")) {
    update.isActive = body.isActive !== false;
  }

  update.updatedAt = new Date();
  return update;
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid role id" }, { status: 400 });
    }

    const payload = normalizeRolePayload(await request.json());
    if (Object.prototype.hasOwnProperty.call(payload, "roleCode") && !payload.roleCode) {
      return NextResponse.json({ error: "Role code is required" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(databaseName);
    const _id = new ObjectId(id);

    if (payload.roleCode) {
      const existingRole = await db.collection("master_roles").findOne({
        roleCode: payload.roleCode,
        _id: { $ne: _id },
      });

      if (existingRole) {
        return NextResponse.json({ error: "Role code already exists" }, { status: 400 });
      }
    }

    const result = await db.collection("master_roles").findOneAndUpdate(
      { _id },
      { $set: payload },
      { returnDocument: "after" }
    );

    if (!result) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Role updated successfully", role: result }, { status: 200 });
  } catch (error) {
    console.error("Error updating role:", error);
    return NextResponse.json({ error: "Failed to update role" }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  try {
    const { id } = await params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid role id" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(databaseName);
    const result = await db.collection("master_roles").deleteOne({ _id: new ObjectId(id) });

    if (!result.deletedCount) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Role deleted successfully" }, { status: 200 });
  } catch (error) {
    console.error("Error deleting role:", error);
    return NextResponse.json({ error: "Failed to delete role" }, { status: 500 });
  }
}
