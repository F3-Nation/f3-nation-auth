import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import {
  validateImageFile,
  uploadProfilePicture,
  deleteProfilePicture,
  isFirebaseStorageUrl,
} from '@/lib/storage';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = file.type;

    // Validate the file
    const validation = validateImageFile(buffer, mimeType);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Get current user to check for existing profile picture
    const [currentUser] = await db
      .select({ image: users.image })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    // Delete old profile picture if it exists and is from Firebase Storage
    if (currentUser?.image && isFirebaseStorageUrl(currentUser.image)) {
      await deleteProfilePicture(session.user.id);
    }

    // Upload new profile picture
    const uploadResult = await uploadProfilePicture(session.user.id, buffer, mimeType);

    if (!uploadResult.success) {
      return NextResponse.json({ error: uploadResult.error }, { status: 500 });
    }

    // Update user record with new image URL
    await db.update(users).set({ image: uploadResult.url }).where(eq(users.id, session.user.id));

    return NextResponse.json({
      success: true,
      imageUrl: uploadResult.url,
    });
  } catch (error) {
    console.error('Profile picture upload error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current user
    const [currentUser] = await db
      .select({ image: users.image })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    // Delete from Firebase Storage if applicable
    if (currentUser?.image && isFirebaseStorageUrl(currentUser.image)) {
      await deleteProfilePicture(session.user.id);
    }

    // Clear image URL in database
    await db.update(users).set({ image: null }).where(eq(users.id, session.user.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Profile picture delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
