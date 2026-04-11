import { NextResponse } from "next/server";
import { validateUserSession } from "@/lib/auth-utils";

/**
 * API route to verify if a user has permission to access a specific path
 * This is called from client-side to verify permissions server-side
 */
export async function POST(request) {
  try {
    const { pathname } = await request.json();

    if (!pathname) {
      return NextResponse.json(
        { error: "Pathname is required" },
        { status: 400 }
      );
    }

    // Pass request directly - validateUserSession will handle cookies/headers
    // For API routes, we need to import cookies from next/headers if needed
    // But for now, pass the request object which should have cookies
    const { user, hasAccess } = await validateUserSession(request, pathname);

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized", hasAccess: false },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { 
        hasAccess,
        user: {
          _id: user._id?.toString ? user._id.toString() : String(user._id || ''),
          role: user.role,
          allowedPaths: user.allowedPaths,
        }
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error verifying permission:", error);
    return NextResponse.json(
      { error: "Failed to verify permission", hasAccess: false },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check current user's permissions
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const pathname = searchParams.get('pathname') || '';

    // Pass request directly - validateUserSession will handle cookies/headers
    const { user, hasAccess } = await validateUserSession(request, pathname || undefined);

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized", hasAccess: false },
        { status: 401 }
      );
    }

    // If pathname provided, check specific path
    if (pathname) {
      return NextResponse.json(
        { 
          hasAccess,
          user: {
            _id: user._id?.toString ? user._id.toString() : String(user._id || ''),
            role: user.role,
            allowedPaths: user.allowedPaths,
          }
        },
        { status: 200 }
      );
    }

    // Otherwise return user info
    return NextResponse.json(
      { 
        user: {
          _id: user._id?.toString ? user._id.toString() : String(user._id || ''),
          role: user.role,
          allowedPaths: user.allowedPaths,
          isActive: user.isActive,
        }
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error getting user permissions:", error);
    return NextResponse.json(
      { error: "Failed to get permissions" },
      { status: 500 }
    );
  }
}

