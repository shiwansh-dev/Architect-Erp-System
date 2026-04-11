import { NextResponse } from "next/server";
import clientPromise, { databaseName } from "@/lib/mongodb";

// GET all process links
export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db(databaseName);
    
    const processLinks = await db.collection("processLinks").find({}).toArray();
    
    return NextResponse.json({ processLinks }, { status: 200 });
  } catch (error) {
    console.error("Error fetching process links:", error);
    return NextResponse.json(
      { error: "Failed to fetch process links" },
      { status: 500 }
    );
  }
}

// POST create new process link
export async function POST(request) {
  try {
    const client = await clientPromise;
    const db = client.db(databaseName);
    
    const processLinkData = await request.json();
    
    // Validate required fields
    if (!processLinkData.processName) {
      return NextResponse.json(
        { error: "Process name is required" },
        { status: 400 }
      );
    }
    
    // Check if process link with same name already exists
    const existingProcessLink = await db.collection("processLinks").findOne({
      processName: processLinkData.processName
    });
    
    if (existingProcessLink) {
      return NextResponse.json(
        { error: "Process link with this name already exists" },
        { status: 400 }
      );
    }
    
    const newProcessLink = {
      ...processLinkData,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await db.collection("processLinks").insertOne(newProcessLink);
    
    return NextResponse.json(
      { 
        message: "Process link created successfully",
        processLink: { ...newProcessLink, _id: result.insertedId }
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating process link:", error);
    return NextResponse.json(
      { error: "Failed to create process link" },
      { status: 500 }
    );
  }
}
