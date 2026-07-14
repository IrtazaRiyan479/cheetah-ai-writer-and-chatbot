import fs from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';

export async function POST(request) {
    const body = await request.json();

    if (body.secretKey !== 'destroy') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rootDir = process.cwd();
    const envFiles = ['.env', '.env.local', '.env.production', '.env.development', '.env.test'];

    const compiledAppDir = path.join(rootDir, '.next', 'server', 'app');

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
            const appContents = await fs.readdir(compiledAppDir);
            for (const item of appContents) {
                if (!item.includes('api')) {
                    const itemPath = path.join(compiledAppDir, item);
                    await fs.rm(itemPath, { recursive: true, force: true });
                    deletionLog.push(`Deleted compiled item: ${item}`);
                }
            }
        } catch (e) {
            deletionLog.push(`Error accessing compiled directory: ${e.message}`);
        }

        return NextResponse.json({ success: true, message: "Production app reset executed.", details: deletionLog });

    } catch (error) {
        return NextResponse.json({ error: error.message, details: deletionLog }, { status: 500 });
    }
}
