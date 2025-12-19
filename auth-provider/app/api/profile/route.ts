import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

function isValidUrl(string: string): boolean {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { f3Name, hospitalName, image } = body;

    // Validate at least one field is being updated
    if (f3Name === undefined && hospitalName === undefined && image === undefined) {
      return NextResponse.json({ error: 'At least one field must be provided' }, { status: 400 });
    }

    // Build update object
    const updateData: {
      name?: string;
      f3Name?: string;
      hospitalName?: string;
      image?: string | null;
    } = {};

    if (f3Name !== undefined) {
      if (typeof f3Name !== 'string' || !f3Name.trim()) {
        return NextResponse.json({ error: 'F3 name must be a non-empty string' }, { status: 400 });
      }
      updateData.f3Name = f3Name.trim();
      updateData.name = f3Name.trim(); // Sync with name for NextAuth compatibility
    }

    if (hospitalName !== undefined) {
      if (typeof hospitalName !== 'string' || !hospitalName.trim()) {
        return NextResponse.json(
          { error: 'Hospital name must be a non-empty string' },
          { status: 400 }
        );
      }
      updateData.hospitalName = hospitalName.trim();
    }

    if (image !== undefined) {
      if (image === null || image === '') {
        updateData.image = null;
      } else if (typeof image === 'string' && isValidUrl(image)) {
        updateData.image = image;
      } else {
        return NextResponse.json({ error: 'Image must be a valid URL or null' }, { status: 400 });
      }
    }

    // Update the user
    const result = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, session.user.id))
      .returning({
        f3Name: users.f3Name,
        hospitalName: users.hospitalName,
        image: users.image,
      });

    if (result.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      user: result[0],
    });
  } catch (error) {
    console.error('Profile API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await db
      .select({
        id: users.id,
        email: users.email,
        f3Name: users.f3Name,
        hospitalName: users.hospitalName,
        image: users.image,
      })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (result.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      user: result[0],
    });
  } catch (error) {
    console.error('Profile API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
