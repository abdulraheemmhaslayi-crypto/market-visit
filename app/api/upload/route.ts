import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { uploadToCloudinary } from '@/utils/cloudinary';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { file, category } = await req.json();
    if (!file || !category) {
      return NextResponse.json({ error: 'Missing file or category' }, { status: 400 });
    }

    const result = await uploadToCloudinary(file, category);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('API Upload error:', error);
    return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 });
  }
}
