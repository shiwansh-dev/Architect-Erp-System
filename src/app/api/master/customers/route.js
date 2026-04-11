import { NextResponse } from "next/server";
import clientPromise, { databaseName } from "@/lib/mongodb";

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db(databaseName);
    const customers = await db.collection("customers").find({}).sort({ createdAt: -1 }).toArray();
    return NextResponse.json({ customers }, { status: 200 });
  } catch (error) {
    console.error("Error fetching customers:", error);
    return NextResponse.json({ error: "Failed to fetch customers" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const payload = await request.json();
    const required = ["name"];
    for (const k of required) {
      if (!payload[k] || String(payload[k]).trim() === "") {
        return NextResponse.json({ error: `${k} is required` }, { status: 400 });
      }
    }

    const customer = {
      name: String(payload.name).trim(),
      email: payload.email ? String(payload.email).trim() : "",
      phone: payload.phone ? String(payload.phone).trim() : "",
      gstin: payload.gstin ? String(payload.gstin).trim() : "",
      billingAddress: {
        line1: payload.billingAddress?.line1 || "",
        line2: payload.billingAddress?.line2 || "",
        city: payload.billingAddress?.city || "",
        state: payload.billingAddress?.state || "",
        zip: payload.billingAddress?.zip || "",
        country: payload.billingAddress?.country || "India",
      },
      paymentTerms: payload.paymentTerms || "Due on Receipt",
      creditLimit: Number(payload.creditLimit || 0),
      isActive: payload.isActive !== false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const client = await clientPromise;
    const db = client.db(databaseName);
    const result = await db.collection("customers").insertOne(customer);
    return NextResponse.json({ id: result.insertedId, message: "Customer created" }, { status: 201 });
  } catch (error) {
    console.error("Error creating customer:", error);
    return NextResponse.json({ error: "Failed to create customer" }, { status: 500 });
  }
}


