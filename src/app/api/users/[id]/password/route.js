import { NextResponse } from "next/server";
import clientPromise, { databaseName } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

// GET user password by ID (admin only - for generating login URLs)
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(databaseName);
    
    const user = await db.collection("users").findOne(
      { _id: new ObjectId(id) },
      { projection: { password: 1, username: 1 } } // Only get password and username
    );
    
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ 
      username: user.username,
      password: user.password 
    }, { status: 200 });
  } catch (error) {
    console.error("Error fetching user password:", error);
    return NextResponse.json({ error: "Failed to fetch user password" }, { status: 500 });
  }
}

