import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise, { databaseName } from "@/lib/mongodb";

// GET single process link
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    
    const client = await clientPromise;
    const db = client.db(databaseName);
    
    const processLink = await db.collection("processLinks").findOne({
      _id: new ObjectId(id)
    });
    
    if (!processLink) {
      return NextResponse.json({ error: "Process link not found" }, { status: 404 });
    }
    
    return NextResponse.json({ processLink }, { status: 200 });
  } catch (error) {
    console.error("Error fetching process link:", error);
    return NextResponse.json(
      { error: "Failed to fetch process link" },
      { status: 500 }
    );
  }
}

// PUT update process link
export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    
    const client = await clientPromise;
    const db = client.db(databaseName);
    
    const updateData = await request.json();
    
    // Validate required fields
    if (!updateData.processName) {
      return NextResponse.json(
        { error: "Process name is required" },
        { status: 400 }
      );
    }
    
    // Check if another process link with same name already exists (excluding current one)
    const existingProcessLink = await db.collection("processLinks").findOne({
      processName: updateData.processName,
      _id: { $ne: new ObjectId(id) }
    });
    
    if (existingProcessLink) {
      return NextResponse.json(
        { error: "Process link with this name already exists" },
        { status: 400 }
      );
    }
    
    const updatedProcessLink = {
      ...updateData,
      updatedAt: new Date()
    };
    
    const result = await db.collection("processLinks").updateOne(
      { _id: new ObjectId(id) },
      { $set: updatedProcessLink }
    );
    
    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Process link not found" }, { status: 404 });
    }
    
    return NextResponse.json(
      { message: "Process link updated successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating process link:", error);
    return NextResponse.json(
      { error: "Failed to update process link" },
      { status: 500 }
    );
  }
}

// DELETE process link
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    
    const client = await clientPromise;
    const db = client.db(databaseName);
    
    const result = await db.collection("processLinks").deleteOne({
      _id: new ObjectId(id)
    });
    
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Process link not found" }, { status: 404 });
    }
    
    return NextResponse.json(
      { message: "Process link deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting process link:", error);
    return NextResponse.json(
      { error: "Failed to delete process link" },
      { status: 500 }
    );
  }
}
