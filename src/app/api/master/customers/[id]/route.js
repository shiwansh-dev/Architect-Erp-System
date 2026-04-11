import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise, { databaseName } from "@/lib/mongodb";

// GET single customer
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const client = await clientPromise;
    const db = client.db(databaseName);
    
    const customer = await db.collection("customers").findOne({
      _id: new ObjectId(id)
    });
    
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }
    
    return NextResponse.json({ customer }, { status: 200 });
  } catch (error) {
    console.error("Error fetching customer:", error);
    return NextResponse.json(
      { error: "Failed to fetch customer" },
      { status: 500 }
    );
  }
}

// PUT update customer
export async function PUT(request, { params }) {
  try {
    const client = await clientPromise;
    const db = client.db(databaseName);
    
    const updateData = await request.json();
    
    // Remove _id from updateData to avoid MongoDB error
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _id: _unused, ...updateFields } = updateData;
    
    const updatedCustomer = {
      ...updateFields,
      updatedAt: new Date()
    };
    
    const result = await db.collection("customers").updateOne(
      { _id: new ObjectId(params.id) },
      { $set: updatedCustomer }
    );
    
    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }
    
    return NextResponse.json(
      { message: "Customer updated successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating customer:", error);
    return NextResponse.json(
      { error: "Failed to update customer" },
      { status: 500 }
    );
  }
}

// DELETE customer
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const client = await clientPromise;
    const db = client.db(databaseName);
    
    const result = await db.collection("customers").deleteOne({
      _id: new ObjectId(id)
    });
    
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }
    
    return NextResponse.json(
      { message: "Customer deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting customer:", error);
    return NextResponse.json(
      { error: "Failed to delete customer" },
      { status: 500 }
    );
  }
}
