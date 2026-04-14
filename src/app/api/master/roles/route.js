import { NextResponse } from "next/server";
import clientPromise, { databaseName } from "@/lib/mongodb";

function normalizeRolePayload(body = {}) {
  const roleCode = String(body.roleCode || "")
    .trim()
    .toUpperCase();
  const roleName = String(body.roleName || "").trim();

  return {
    roleCode,
    roleName,
    isActive: body.isActive !== false,
  };
}

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db(databaseName);
    const roles = await db.collection("master_roles").find({}).sort({ roleCode: 1 }).toArray();

    return NextResponse.json({ roles }, { status: 200 });
  } catch (error) {
    console.error("Error fetching roles:", error);
    return NextResponse.json({ error: "Failed to fetch roles" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const payload = normalizeRolePayload(await request.json());
    if (!payload.roleCode) {
      return NextResponse.json({ error: "Role code is required" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(databaseName);
    const existingRole = await db.collection("master_roles").findOne({ roleCode: payload.roleCode });

    if (existingRole) {
      return NextResponse.json({ error: "Role code already exists" }, { status: 400 });
    }

    const role = {
      ...payload,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection("master_roles").insertOne(role);

    return NextResponse.json(
      { message: "Role created successfully", role: { ...role, _id: result.insertedId } },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating role:", error);
    return NextResponse.json({ error: "Failed to create role" }, { status: 500 });
  }
}
