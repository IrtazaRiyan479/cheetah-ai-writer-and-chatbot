import { NextResponse } from 'next/server';
import { writeFile, mkdir, unlink, readdir } from 'fs/promises';
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

export async function DELETE(request) {
  try {
    const body = await request.json();
    const { fileUrls = [], clearAll = false } = body;
    const uploadDir = path.join(process.cwd(), 'public/uploads');

    if (clearAll) {
      const files = await readdir(uploadDir);
      for (const file of files) {
        await unlink(path.join(uploadDir, file));
      }
      return NextResponse.json({ success: true, message: 'All uploads cleared' });
    }

    if (fileUrls.length > 0) {
      for (const url of fileUrls) {
        const filename = path.basename(url); // Extracts just the filename, prevents path traversal attacks
        const filepath = path.join(uploadDir, filename);
        try {
          await unlink(filepath);
        } catch (err) {
          console.warn(`Could not delete ${filename}:`, err.message);
        }
      }
      return NextResponse.json({ success: true, message: 'Specific session uploads cleared' });
    }

    return NextResponse.json({ success: false, error: 'No files specified' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
