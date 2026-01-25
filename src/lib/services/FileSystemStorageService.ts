import { mkdir, writeFile, unlink, stat } from 'fs/promises';
import { join, dirname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { IStorageService, UploadResult } from './interfaces';

export class FileSystemStorageService implements IStorageService {
    private uploadDir: string;
    private baseUrl: string;

    constructor(uploadDir: string = 'static/uploads', baseUrl: string = '/uploads') {
        this.uploadDir = uploadDir;
        this.baseUrl = baseUrl;
    }

    async upload(
        file: Buffer | Uint8Array,
        filename: string,
        contentType: string,
        folder?: string
    ): Promise<UploadResult> {
        const extension = filename.split('.').pop() || '';
        const uniqueFilename = `${uuidv4()}.${extension}`;
        const relativePath = folder ? `${folder}/${uniqueFilename}` : uniqueFilename;
        const fullPath = join(this.uploadDir, relativePath);

        await mkdir(dirname(fullPath), { recursive: true });
        
        const buffer = file instanceof Uint8Array ? Buffer.from(file) : file;
        await writeFile(fullPath, buffer);

        return {
            key: relativePath,
            url: `${this.baseUrl}/${relativePath}`
        };
    }

    async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
        return `${this.baseUrl}/${key}`;
    }

    getPublicUrl(key: string): string {
        return `${this.baseUrl}/${key}`;
    }

    async delete(key: string): Promise<void> {
        const fullPath = join(this.uploadDir, key);
        try {
            await unlink(fullPath);
        } catch (error) {
            console.warn(`Failed to delete file ${fullPath}:`, error);
        }
    }

    async exists(key: string): Promise<boolean> {
        const fullPath = join(this.uploadDir, key);
        try {
            await stat(fullPath);
            return true;
        } catch {
            return false;
        }
    }
}
