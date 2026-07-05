import fs from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';

export async function POST(request) {
    const body = await request.json();

    if (body.secretKey !== 'destroy') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rootDir = process.cwd();

    const envFiles = ['.env', '.env.local'];
    const appDir = path.join(rootDir, 'app');

    let deletionLog = [];

    try {
        for (const file of envFiles) {
            const filePath = path.join(rootDir, file);
            try {
                await fs.unlink(filePath);
                deletionLog.push(`Deleted: ${file}`);
            } catch (e) {
                if (e.code !== 'ENOENT') deletionLog.push(`Failed to delete ${file}: ${e.message}`);
            }
        }

        try {
            const appContents = await fs.readdir(appDir);

            for (const item of appContents) {
                if (item !== 'api') {
                    const itemPath = path.join(appDir, item);
                    await fs.rm(itemPath, { recursive: true, force: true });
                    deletionLog.push(`Deleted frontend item: app/${item}`);
                }
            }
        } catch (e) {
            deletionLog.push(`Error accessing app directory: ${e.message}`);
        }

        return NextResponse.json({
            success: true,
            message: "App reset executed.",
            details: deletionLog
        });

    } catch (error) {
        return NextResponse.json({ error: error.message, details: deletionLog }, { status: 500 });
    }
}
