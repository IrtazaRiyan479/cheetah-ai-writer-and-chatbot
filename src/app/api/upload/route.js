import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function POST(request) {
  try {
    const data = await request.formData();
    const file = data.get('file');

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file found' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create a unique filename and ensure the uploads directory exists
    const filename = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '');
    const uniqueFilename = `${Date.now()}-${filename}`;
    const uploadDir = path.join(process.cwd(), 'public/uploads');

    // Create the folder if it doesn't exist yet
    await mkdir(uploadDir, { recursive: true });

    // Save the file
    const filepath = path.join(uploadDir, uniqueFilename);
    await writeFile(filepath, buffer);

    // Return the public URL
    return NextResponse.json({
      success: true,
      url: `/uploads/${uniqueFilename}`,
      type: file.type,
      name: file.name
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
