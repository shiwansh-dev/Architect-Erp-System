import { NextResponse } from "next/server";
import clientPromise, { databaseName } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const userId = formData.get('userId');
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = file.type || 'image/png';
    const base64 = `data:${mimeType};base64,${buffer.toString('base64')}`;

    // Persist avatar base64 to this user's document immediately
    try {
      const client = await clientPromise;
      const db = client.db(databaseName);
      await db.collection('users').updateOne(
        { _id: new ObjectId(userId) },
        { $set: { avatarBase64: base64, updatedAt: new Date() } }
      );
    } catch (err) {
      console.error('Failed to save avatar to DB:', err);
    }

    return NextResponse.json({ base64 }, { status: 200 });
  } catch (error) {
    console.error('Avatar upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}


