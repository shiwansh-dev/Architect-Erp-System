import { NextResponse } from "next/server";
import clientPromise, { databaseName } from "@/lib/mongodb";
import { USER_COLLECTION } from "@/lib/user-collection";

// GET all users with pagination and search
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 10;
    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    const client = await clientPromise;
    const db = client.db(databaseName);

    // Build search query
    const searchQuery = search ? {
      $or: [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ]
    } : {};

    // Get total count for pagination
    const totalUsers = await db.collection(USER_COLLECTION).countDocuments(searchQuery);
    const totalPages = Math.ceil(totalUsers / limit);

    // Get users with pagination
    const users = await db.collection(USER_COLLECTION)
      .find(searchQuery, { projection: { password: 0 } }) // Exclude password
      .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    return NextResponse.json({
      users,
      pagination: {
        currentPage: page,
        totalPages,
        totalUsers,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    }, { status: 200 });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}

// POST create new user
export async function POST(request) {
  try {
    const { firstName, lastName, username, email, password, role = 'user', deviceNo, allowedPaths } = await request.json();

    // Validate required fields
    if (!firstName || !username || !password) {
      return NextResponse.json(
        { error: "First name, username, and password are required" },
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

    // Check if user already exists
    const queryConditions = [{ username }];
    if (email && email.trim()) {
      queryConditions.push({ email });
    }
    
    const existingUser = await db.collection(USER_COLLECTION).findOne({ 
      $or: queryConditions
    });
    if (existingUser) {
      return NextResponse.json(
        { error: "User with this username" + (email && email.trim() ? " or email" : "") + " already exists" },
        { status: 400 }
      );
    }

    // Create new user
    const userData = {
      firstName,
      username,
      password, // In production, this should be hashed
      role,
      ...(lastName && lastName.trim() ? { lastName } : {}),
      ...(email && email.trim() ? { email } : {}),
      ...(Array.isArray(deviceNo) && deviceNo.length > 0 ? { deviceNo } : {}),
      ...(Array.isArray(allowedPaths) ? { allowedPaths } : {}),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection(USER_COLLECTION).insertOne(userData);

    // Get the created user (without password)
    const newUser = await db.collection(USER_COLLECTION).findOne(
      { _id: result.insertedId },
      { projection: { password: 0 } }
    );

    return NextResponse.json(
      { 
        message: "User created successfully", 
        user: newUser 
      },
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
