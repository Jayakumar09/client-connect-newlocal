import { google, drive_v3 } from 'googleapis';
import fs from 'fs';
import { DriveFolder } from '../types/index.js';

export class GoogleDriveService {
  private drive: drive_v3.Drive | null = null;
  private folderName: string;
  private rootFolderId: string;

  constructor() {
    this.folderName = process.env.GOOGLE_DRIVE_FOLDER_NAME || 'Vijayalakshmi_Matrimony_Backups';
    this.rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID || '';
  }

  private getDriveClient(): drive_v3.Drive {
    if (!this.drive) {
      if (process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY_PATH) {
        const auth = new google.auth.GoogleAuth({
          credentials: JSON.parse(
            fs.readFileSync(process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY_PATH, 'utf8')
          ),
          scopes: ['https://www.googleapis.com/auth/drive']
        });
        this.drive = google.drive({ version: 'v3', auth });
      } else if (process.env.GOOGLE_DRIVE_CLIENT_ID && process.env.GOOGLE_DRIVE_REFRESH_TOKEN) {
        const oauth2 = new google.auth.OAuth2(
          process.env.GOOGLE_DRIVE_CLIENT_ID,
          process.env.GOOGLE_DRIVE_CLIENT_SECRET,
          process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/oauth2callback'
        );
        oauth2.setCredentials({ refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN });
        this.drive = google.drive({ version: 'v3', auth: oauth2 });
      } else {
        throw new Error('Google Drive credentials not configured');
      }
    }
    return this.drive;
  }

  async getOrCreateRootFolder(): Promise<DriveFolder> {
    if (this.rootFolderId) {
      try {
        const existing = await this.getDriveClient().files.get({
          fileId: this.rootFolderId,
          fields: 'id, name, createdTime'
        });
        return {
          id: existing.data.id!,
          name: existing.data.name!,
          created_at: existing.data.createdTime!
        };
      } catch (error) {
        console.warn('Root folder not found, will create new one');
      }
    }

    const folder = await this.findOrCreateFolder(this.folderName);
    return folder;
  }

  async findOrCreateFolder(name: string, parentId?: string): Promise<DriveFolder> {
    const query = `name='${name}' and mimeType='application/vnd.google-apps.folder'`;
    const params: drive_v3.Params$Resource$Files$List = {
      q: parentId ? `${query} and '${parentId}' in parents` : query,
      fields: 'files(id, name, createdTime)'
    };

    const response = await this.getDriveClient().files.list(params);

    if (response.data.files && response.data.files.length > 0) {
      const existing = response.data.files[0];
      return {
        id: existing.id!,
        name: existing.name!,
        created_at: existing.createdTime!
      };
    }

    const folderMetadata: drive_v3.Schema$File = {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      ...(parentId && { parents: [parentId] })
    };

    const created = await this.getDriveClient().files.create({
      requestBody: folderMetadata,
      fields: 'id, name, createdTime'
    });

    return {
      id: created.data.id!,
      name: created.data.name!,
      created_at: created.data.createdTime!
    };
  }

  async createDatedFolder(parentId: string, date: string): Promise<DriveFolder> {
    return this.findOrCreateFolder(date, parentId);
  }

  async deleteOldBackups(folderId: string, retentionDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const response = await this.getDriveClient().files.list({
      q: `'${folderId}' in parents and mimeType='application/zip'`,
      fields: 'files(id, name, createdTime)'
    });

    const files = response.data.files || [];
    let deletedCount = 0;

    for (const file of files) {
      if (file.createdTime) {
        const fileDate = new Date(file.createdTime);
        if (fileDate < cutoffDate) {
          try {
            await this.getDriveClient().files.delete({ fileId: file.id! });
            deletedCount++;
            console.log(`Deleted old backup: ${file.name}`);
          } catch (error) {
            console.error(`Failed to delete ${file.name}:`, error);
          }
        }
      }
    }

    return deletedCount;
  }

  async listBackups(folderId: string): Promise<DriveFolder[]> {
    const response = await this.getDriveClient().files.list({
      q: `'${folderId}' in parents and mimeType='application/vnd.google-apps.folder'`,
      fields: 'files(id, name, createdTime)',
      orderBy: 'createdTime desc'
    });

    return (response.data.files || []).map((file: drive_v3.Schema$File) => ({
      id: file.id!,
      name: file.name!,
      created_at: file.createdTime!
    }));
  }

  async getBackupSize(folderId: string): Promise<number> {
    const response = await this.getDriveClient().files.list({
      q: `'${folderId}' in parents`,
      fields: 'files(id, name, size)'
    });

    const files = response.data.files || [];
    let totalSize = 0;

    for (const file of files) {
      if (file.size) {
        totalSize += parseInt(file.size, 10);
      }
    }

    return totalSize;
  }

  async uploadFile(
    filePath: string,
    folderId: string,
    fileName: string,
    mimeType: string
  ): Promise<{ id: string; name: string; size: number; createdTime: string }> {
    const fs = await import('fs');
    const localSize = fs.statSync(filePath).size;
    
    const response = await this.getDriveClient().files.create({
      requestBody: {
        name: fileName,
        parents: [folderId]
      },
      media: {
        body: fs.createReadStream(filePath)
      },
      fields: 'id, name, size, createdTime'
    });

    if (!response.data.id) {
      throw new Error(`Failed to upload ${fileName}: No file ID returned`);
    }

    const uploadedSize = response.data.size ? parseInt(String(response.data.size), 10) : localSize;

    console.log(`[GoogleDriveService] Uploaded: ${fileName}, Local Size: ${localSize}, Drive Size: ${uploadedSize}, ID: ${response.data.id}`);

    return {
      id: response.data.id,
      name: response.data.name || fileName,
      size: uploadedSize,
      createdTime: response.data.createdTime || new Date().toISOString()
    };
  }
}

export const googleDriveService = new GoogleDriveService();
