import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise, { databaseName } from "@/lib/mongodb";

// GET single unit
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const client = await clientPromise;
    const db = client.db(databaseName);
    
    const unit = await db.collection("units").findOne({
      _id: new ObjectId(id)
    });
    
    if (!unit) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }
    
    return NextResponse.json({ unit }, { status: 200 });
  } catch (error) {
    console.error("Error fetching unit:", error);
    return NextResponse.json(
      { error: "Failed to fetch unit" },
      { status: 500 }
    );
  }
}

// PUT update unit
export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const client = await clientPromise;
    const db = client.db(databaseName);
    
    const updateData = await request.json();
    
    // Check if unit code already exists (excluding current unit)
    if (updateData.unitCode) {
      const existingUnit = await db.collection("units").findOne({ 
        unitCode: updateData.unitCode,
        _id: { $ne: new ObjectId(id) }
      });
      
      if (existingUnit) {
        return NextResponse.json(
          { error: "Unit code already exists" },
          { status: 400 }
        );
      }
    }
    
    const updatedUnit = {
      ...updateData,
      updatedAt: new Date()
    };
    
    const result = await db.collection("units").updateOne(
      { _id: new ObjectId(params.id) },
      { $set: updatedUnit }
    );
    
    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }
    
    return NextResponse.json(
      { message: "Unit updated successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating unit:", error);
    return NextResponse.json(
      { error: "Failed to update unit" },
      { status: 500 }
    );
  }
}

// DELETE unit
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const client = await clientPromise;
    const db = client.db(databaseName);
    
    // Check if unit is being used in items collection
    const itemsUsingUnit = await db.collection("items").findOne({
      unit: { $exists: true }
    });
    
    if (itemsUsingUnit) {
      // You might want to check specifically for this unit
      // This is a basic check - you can enhance it to check for the specific unit
    }
    
    const result = await db.collection("units").deleteOne({
      _id: new ObjectId(id)
    });
    
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }
    
    return NextResponse.json(
      { message: "Unit deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting unit:", error);
    return NextResponse.json(
      { error: "Failed to delete unit" },
      { status: 500 }
    );
  }
}
