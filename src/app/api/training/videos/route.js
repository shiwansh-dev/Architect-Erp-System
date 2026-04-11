import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/googleDriveAuth";

const GOOGLE_DRIVE_FOLDER_ID = "1HX94GcsFXiJmPWFCExnEV-hPy2N4-xtA";

export async function GET() {
  try {
    // Get OAuth2 access token
    const accessToken = await getAccessToken();

    // Fetch files from Google Drive folder using OAuth2
    // Try query with video mimeType first, fallback to all files if that fails
    let query = `'${GOOGLE_DRIVE_FOLDER_ID}' in parents and mimeType contains 'video/'`;
    const fields = "files(id,name,mimeType,createdTime,modifiedTime,size)";
    let url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=${fields}&orderBy=name`;

    console.log("Fetching videos from Google Drive folder:", GOOGLE_DRIVE_FOLDER_ID);
    console.log("Query:", query);

    let response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    // If query fails, try getting all files and filter client-side
    if (!response.ok) {
      console.warn("Query with mimeType filter failed, trying all files in folder");
      query = `'${GOOGLE_DRIVE_FOLDER_ID}' in parents`;
      url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=${fields}&orderBy=name`;
      
      response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Google Drive API error:", JSON.stringify(errorData, null, 2));
      console.error("Response status:", response.status);
      console.error("Request URL:", url);
      return NextResponse.json(
        { error: "Failed to fetch videos from Google Drive", details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Filter for video files if we got all files
    const videoFiles = data.files ? data.files.filter(file => 
      file.mimeType && file.mimeType.startsWith('video/')
    ) : [];

    // Format videos for frontend
    const videos = videoFiles.map((file) => ({
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      createdTime: file.createdTime,
      modifiedTime: file.modifiedTime,
      size: file.size,
      // Use proxy endpoint instead of direct Google Drive links
      streamUrl: `/api/training/videos/${file.id}/stream`,
    }));

    return NextResponse.json({ videos }, { status: 200 });
  } catch (error) {
    console.error("Error fetching videos from Google Drive:", error);
    return NextResponse.json(
      { error: "Failed to fetch videos", details: error.message },
      { status: 500 }
    );
  }
}
