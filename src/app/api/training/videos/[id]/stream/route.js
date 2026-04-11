import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/googleDriveAuth";

/**
 * Server-side proxy to stream Google Drive videos
 * This keeps the Google Drive folder private while allowing video playback
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const range = request.headers.get("range");

    if (!id) {
      return new NextResponse("Video ID is required", { status: 400 });
    }

    // Get OAuth2 access token
    const accessToken = await getAccessToken();

    // Get video metadata first to determine content type
    const metadataResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${id}?fields=name,mimeType,size`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!metadataResponse.ok) {
      console.error("Failed to get video metadata:", await metadataResponse.text());
      return new NextResponse("Video not found", { status: 404 });
    }

    const metadata = await metadataResponse.json();
    const mimeType = metadata.mimeType || "video/mp4";

    // Request video content from Google Drive
    const driveUrl = `https://www.googleapis.com/drive/v3/files/${id}?alt=media`;
    const headers = {
      Authorization: `Bearer ${accessToken}`,
    };

    // Add range header if present (for video seeking)
    if (range) {
      headers.Range = range;
    }

    const videoResponse = await fetch(driveUrl, {
      headers,
    });

    if (!videoResponse.ok) {
      console.error("Failed to stream video:", await videoResponse.text());
      return new NextResponse("Failed to stream video", {
        status: videoResponse.status,
      });
    }

    // Get content length from response or metadata
    let videoSize = null;
    if (videoResponse.headers.get("content-length")) {
      videoSize = parseInt(videoResponse.headers.get("content-length"), 10);
    } else if (metadata.size) {
      videoSize = parseInt(metadata.size, 10);
    }

    // Prepare response headers
    const responseHeaders = {
      "Content-Type": mimeType,
      "Accept-Ranges": "bytes",
      "Cache-Control": "public, max-age=3600",
    };

    // Handle range requests for video seeking
    if (range && videoResponse.status === 206) {
      // Partial content response
      const contentRange = videoResponse.headers.get("content-range");
      const contentLength = videoResponse.headers.get("content-length");

      if (contentRange) {
        responseHeaders["Content-Range"] = contentRange;
      }
      if (contentLength) {
        responseHeaders["Content-Length"] = contentLength;
      }

      // Stream the partial content
      if (!videoResponse.body) {
        return new NextResponse("No video content", { status: 500 });
      }

      return new NextResponse(videoResponse.body, {
        status: 206, // Partial Content
        headers: responseHeaders,
      });
    }

    // For full video requests, stream the response
    if (!videoResponse.body) {
      return new NextResponse("No video content", { status: 500 });
    }

    if (videoSize) {
      responseHeaders["Content-Length"] = videoSize.toString();
    }

    // Stream the video directly without loading into memory
    return new NextResponse(videoResponse.body, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("Error streaming video:", error);
    return new NextResponse("Failed to stream video", { status: 500 });
  }
}

