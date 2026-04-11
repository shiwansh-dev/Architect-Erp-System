import { NextResponse } from "next/server";

// Logout endpoint - clears authentication cookies
export async function POST() {
  try {
    const response = NextResponse.json({ success: true, message: "Logged out" }, { status: 200 });
    
    // Clear authentication cookies
    response.cookies.set('userId', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0, // Expire immediately
      path: '/',
    });
    
    response.cookies.set('userId_client', '', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });
    
    return response;
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}


