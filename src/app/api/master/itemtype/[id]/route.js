import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise, { databaseName } from "@/lib/mongodb";

// GET single item type
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const client = await clientPromise;
    const db = client.db(databaseName);
    
    const itemType = await db.collection("itemTypes").findOne({
      _id: new ObjectId(id)
    });
    
    if (!itemType) {
      return NextResponse.json({ error: "Item type not found" }, { status: 404 });
    }
    
    return NextResponse.json({ itemType }, { status: 200 });
  } catch (error) {
    console.error("Error fetching item type:", error);
    return NextResponse.json(
      { error: "Failed to fetch item type" },
      { status: 500 }
    );
  }
}

// PUT update item type
export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const client = await clientPromise;
    const db = client.db(databaseName);
    
    const updateData = await request.json();
    
    // Check if type name already exists (excluding current item type)
    if (updateData.typeName) {
      const existingItemType = await db.collection("itemTypes").findOne({ 
        typeName: updateData.typeName,
        _id: { $ne: new ObjectId(id) }
      });
      
      if (existingItemType) {
        return NextResponse.json(
          { error: "Item type name already exists" },
          { status: 400 }
        );
      }
    }
    
    const updatedItemType = {
      ...updateData,
      updatedAt: new Date()
    };
    
    const result = await db.collection("itemTypes").updateOne(
      { _id: new ObjectId(params.id) },
      { $set: updatedItemType }
    );
    
    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Item type not found" }, { status: 404 });
    }
    
    return NextResponse.json(
      { message: "Item type updated successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating item type:", error);
    return NextResponse.json(
      { error: "Failed to update item type" },
      { status: 500 }
    );
  }
}

// DELETE item type
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const client = await clientPromise;
    const db = client.db(databaseName);
    
    const result = await db.collection("itemTypes").deleteOne({
      _id: new ObjectId(id)
    });
    
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Item type not found" }, { status: 404 });
    }
    
    return NextResponse.json(
      { message: "Item type deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting item type:", error);
    return NextResponse.json(
      { error: "Failed to delete item type" },
      { status: 500 }
    );
  }
}
