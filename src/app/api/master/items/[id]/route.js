import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise, { databaseName } from "@/lib/mongodb";

// GET a specific item by ID
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid item ID" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(databaseName);

    const item = await db.collection("items").findOne({
      _id: new ObjectId(id)
    });

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    return NextResponse.json({ item }, { status: 200 });
  } catch (error) {
    console.error("Error fetching item:", error);
    return NextResponse.json(
      { error: "Failed to fetch item" },
      { status: 500 }
    );
  }
}