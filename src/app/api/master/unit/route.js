import { NextResponse } from "next/server";
import clientPromise, { databaseName } from "@/lib/mongodb";

// GET all units
export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db(databaseName);
    
    const units = await db.collection("units").find({}).toArray();
    
    return NextResponse.json({ units }, { status: 200 });
  } catch (error) {
    console.error("Error fetching units:", error);
    return NextResponse.json(
      { error: "Failed to fetch units" },
      { status: 500 }
    );
  }
}

// POST new unit
export async function POST(request) {
  try {
    const client = await clientPromise;
    const db = client.db(databaseName);
    
    const unitData = await request.json();
    
    // Check if unit code already exists
    const existingUnit = await db.collection("units").findOne({ 
      unitCode: unitData.unitCode 
    });
    
    if (existingUnit) {
      return NextResponse.json(
        { error: "Unit code already exists" },
        { status: 400 }
      );
    }
    
    const newUnit = {
      ...unitData,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await db.collection("units").insertOne(newUnit);
    
    return NextResponse.json(
      { message: "Unit created successfully", id: result.insertedId },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating unit:", error);
    return NextResponse.json(
      { error: "Failed to create unit" },
      { status: 500 }
    );
  }
}
