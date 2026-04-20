import { NextResponse } from "next/server";
import clientPromise, { databaseName } from "@/lib/mongodb";
import { USER_COLLECTION } from "@/lib/user-collection";

export async function POST(request) {
  try {
    const { username, password } = await request.json();

    // Connect to MongoDB
    const client = await clientPromise;
    const db = client.db(databaseName);

    // Find user by username - get all fields except password for comparison
    const user = await db.collection(USER_COLLECTION).findOne(
      { username }, 
      { projection: {} } // Get all fields including password for authentication
    );
    
    if (!user) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    // Check password (since we're not using encryption, direct comparison)
    if (user.password !== password) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    // Login successful - return all user data except password
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: userPassword, ...userWithoutPassword } = user;
    
    // Create response with user data
    const response = NextResponse.json(
      { 
        message: "Login successful", 
        user: userWithoutPassword 
      },
      { status: 200 }
    );

    // Set secure HTTP-only cookie for server-side validation
    // This prevents client-side manipulation
    response.cookies.set('userId', user._id.toString(), {
      httpOnly: true, // Prevents JavaScript access (security)
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      sameSite: 'lax', // CSRF protection
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    // Also set a non-httpOnly cookie for client-side access (for backward compatibility)
    // Note: This is less secure but needed for current client-side code
    response.cookies.set('userId_client', user._id.toString(), {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });
    
    return response;
  } catch (error) {
    console.error("Error during signin:", error);
    return NextResponse.json(
      { error: "Login failed. Please try again." },
      { status: 500 }
    );
  }
}
