import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { saveLocalImage } from '@/lib/storage';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const contentType = req.headers.get('content-type') || '';

    let fileData: string | Buffer;
    let category = 'Dairy';
    let customFilename: string | undefined;

    if (contentType.includes('application/json')) {
      const body = await req.json();
      fileData = body.file;
      category = body.category || 'Dairy';
      customFilename = body.filename;
    } else if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file');
      category = (formData.get('category') as string) || 'Dairy';
      customFilename = (formData.get('filename') as string) || undefined;

      if (!file || !(file instanceof Blob)) {
        return NextResponse.json({ error: 'Missing or invalid file in form data' }, { status: 400 });
      }

      const arrayBuffer = await file.arrayBuffer();
      fileData = Buffer.from(arrayBuffer);
    } else {
      return NextResponse.json({ error: 'Unsupported Content-Type. Use JSON or multipart/form-data' }, { status: 400 });
    }

    if (!fileData) {
      return NextResponse.json({ error: 'Missing file payload' }, { status: 400 });
    }

    const saved = await saveLocalImage(fileData, category, { customFilename });

    return NextResponse.json({
      url: saved.url,
      secure_url: saved.secure_url,
      public_id: saved.public_id,
      size: saved.size,
      mimeType: saved.mimeType,
    });
  } catch (error: any) {
    console.error('API Upload error:', error);
    return NextResponse.json({ error: error.message || 'Local upload failed' }, { status: 500 });
  }
}
