import { NextResponse } from "next/server";
import clientPromise, { databaseName } from "@/lib/mongodb";

export async function POST(request) {
  try {
    const { fname, lname, email, password } = await request.json();

    // Connect to MongoDB
    const client = await clientPromise;
    const db = client.db(databaseName);

    // Check if user already exists
    const existingUser = await db.collection("users").findOne({ email });
    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 }
      );
    }

    // Insert new user
    const result = await db.collection("users").insertOne({
      firstName: fname,
      lastName: lname,
      email,
      password,
      createdAt: new Date(),
    });

    return NextResponse.json(
      { message: "User created successfully", userId: result.insertedId },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }
}
