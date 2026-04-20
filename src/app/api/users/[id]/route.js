import { NextResponse } from "next/server";
import clientPromise, { databaseName } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { USER_COLLECTION } from "@/lib/user-collection";

// GET user by ID
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(databaseName);
    
    const user = await db.collection(USER_COLLECTION).findOne(
      { _id: new ObjectId(id) },
      { projection: { password: 0 } } // Exclude password
    );
    
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user }, { status: 200 });
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json({ error: "Failed to fetch user" }, { status: 500 });
  }
}

// PUT update user
export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const { firstName, lastName, username, email, role, isActive, deviceNo, allowedPaths } = await request.json();

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    // Validate required fields
    if (!firstName || !username) {
      return NextResponse.json(
        { error: "First name and username are required" },
        { status: 400 }
      );
    }

    // Validate email format if provided
    if (email && email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return NextResponse.json(
          { error: "Invalid email format" },
          { status: 400 }
        );
      }
    }

    const client = await clientPromise;
    const db = client.db(databaseName);

    // Check if email or username is already taken by another user
    const queryConditions = [{ username }];
    if (email && email.trim()) {
      queryConditions.push({ email });
    }
    
    const existingUser = await db.collection(USER_COLLECTION).findOne({
      $or: queryConditions,
      _id: { $ne: new ObjectId(id) }
    });
    
    if (existingUser) {
      return NextResponse.json(
        { error: "Username" + (email && email.trim() ? " or email" : "") + " is already taken by another user" },
        { status: 400 }
      );
    }

    // Update user
    const updateData = {
      firstName,
      username,
      role: role || 'user',
      isActive: isActive !== undefined ? isActive : true,
      ...(lastName && lastName.trim() ? { lastName } : {}),
      ...(email && email.trim() ? { email } : {}),
      ...(Array.isArray(deviceNo) && deviceNo.length > 0 ? { deviceNo } : {}),
      ...(Array.isArray(allowedPaths) ? { allowedPaths } : {}),
      updatedAt: new Date()
    };

    const result = await db.collection(USER_COLLECTION).updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get updated user
    const updatedUser = await db.collection(USER_COLLECTION).findOne(
      { _id: new ObjectId(id) },
      { projection: { password: 0 } }
    );

    return NextResponse.json(
      { 
        message: "User updated successfully", 
        user: updatedUser 
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

// DELETE user
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(databaseName);

    const result = await db.collection(USER_COLLECTION).deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(
      { message: "User deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
