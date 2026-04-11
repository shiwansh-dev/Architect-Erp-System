import { NextResponse } from "next/server";
import clientPromise, { databaseName } from "@/lib/mongodb";

// GET all item types
export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db(databaseName);
    
    const itemTypes = await db.collection("itemTypes").find({}).toArray();
    
    return NextResponse.json({ itemTypes }, { status: 200 });
  } catch (error) {
    console.error("Error fetching item types:", error);
    return NextResponse.json(
      { error: "Failed to fetch item types" },
      { status: 500 }
    );
  }
}

// POST new item type
export async function POST(request) {
  try {
    const client = await clientPromise;
    const db = client.db(databaseName);
    
    const itemTypeData = await request.json();
    
    // Check if type name already exists
    const existingItemType = await db.collection("itemTypes").findOne({ 
      typeName: itemTypeData.typeName 
    });
    
    if (existingItemType) {
      return NextResponse.json(
        { error: "Item type name already exists" },
        { status: 400 }
      );
    }
    
    const newItemType = {
      ...itemTypeData,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await db.collection("itemTypes").insertOne(newItemType);
    
    return NextResponse.json(
      { message: "Item type created successfully", id: result.insertedId },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating item type:", error);
    return NextResponse.json(
      { error: "Failed to create item type" },
      { status: 500 }
    );
  }
}
