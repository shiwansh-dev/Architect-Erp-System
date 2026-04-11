import { NextResponse } from "next/server";
import clientPromise, { databaseName } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

// GET current profile by user ID
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(databaseName);
    const profile = await db.collection("users").findOne({ _id: new ObjectId(userId) });
    
    if (!profile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Remove password from response
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _unused, ...safeProfile } = profile;
    return NextResponse.json({ profile: safeProfile }, { status: 200 });
  } catch (error) {
    console.error("Error fetching profile:", error);
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}

// PUT update profile by user ID
export async function PUT(request) {
  try {
    const payload = await request.json();
    const { userId, ...updateData } = payload;
    
    if (!userId) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db(databaseName);

    // Build a partial $set with only provided fields to avoid overwriting
    const update = { updatedAt: new Date() };
    if (Object.prototype.hasOwnProperty.call(updateData, 'firstName')) update.firstName = updateData.firstName;
    if (Object.prototype.hasOwnProperty.call(updateData, 'lastName')) update.lastName = updateData.lastName;
    if (Object.prototype.hasOwnProperty.call(updateData, 'email')) update.email = updateData.email;
    if (Object.prototype.hasOwnProperty.call(updateData, 'phone')) update.phone = updateData.phone;
    if (Object.prototype.hasOwnProperty.call(updateData, 'bio')) update.bio = updateData.bio;
    if (Object.prototype.hasOwnProperty.call(updateData, 'avatarUrl')) update.avatarUrl = updateData.avatarUrl;

    if (Object.prototype.hasOwnProperty.call(updateData, 'social')) {
      const socialSet = {};
      if (updateData.social && Object.prototype.hasOwnProperty.call(updateData.social, 'facebook')) socialSet['social.facebook'] = updateData.social.facebook;
      if (updateData.social && Object.prototype.hasOwnProperty.call(updateData.social, 'twitter')) socialSet['social.twitter'] = updateData.social.twitter;
      if (updateData.social && Object.prototype.hasOwnProperty.call(updateData.social, 'linkedin')) socialSet['social.linkedin'] = updateData.social.linkedin;
      if (updateData.social && Object.prototype.hasOwnProperty.call(updateData.social, 'instagram')) socialSet['social.instagram'] = updateData.social.instagram;
      Object.assign(update, socialSet);
    }

    const result = await db.collection("users").updateOne(
      { _id: new ObjectId(userId) },
      { $set: update }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Profile updated" }, { status: 200 });
  } catch (error) {
    console.error("Error updating profile:", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}


