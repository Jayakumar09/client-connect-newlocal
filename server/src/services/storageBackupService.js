import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DEFAULT_BUCKETS = ['person-images', 'attachments', 'profile-assets', 'chat-files'];
const MAX_PAGINATION_SIZE = 1000;

class StorageBackupService {
  constructor(config = {}) {
    this.supabaseUrl = config.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    this.supabaseKey = config.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    const bucketConfig = config.SUPABASE_BUCKETS || process.env.SUPABASE_BUCKETS;
    this.buckets = bucketConfig 
      ? (Array.isArray(bucketConfig) ? bucketConfig : bucketConfig.split(',').map(b => b.trim()))
      : DEFAULT_BUCKETS;
    this.tempDir = config.TEMP_BACKUP_DIR || process.env.TEMP_BACKUP_DIR || './temp/backup';
    this.supabase = null;
    
    if (this.supabaseUrl && this.supabaseKey) {
      this.supabase = createClient(this.supabaseUrl, this.supabaseKey);
    }
  }

  async ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  calculateChecksum(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  async listFolderContents(bucketName, folderPath = '') {
    const items = [];
    
    try {
      let offset = 0;
      let hasMore = true;
      const pageSize = MAX_PAGINATION_SIZE;
      
      const displayPath = folderPath || '(root)';
      console.log(`[StorageBackup] Listing ${bucketName}/${displayPath}...`);

      while (hasMore) {
        const { data: fileList, error } = await this.supabase.storage
          .from(bucketName)
          .list(folderPath || undefined, { limit: pageSize, offset });

        if (error) {
          console.warn(`[StorageBackup] Could not list ${bucketName}/${displayPath}:`, error.message);
          return items;
        }

        if (!fileList || fileList.length === 0) {
          hasMore = false;
          continue;
        }

        console.log(`[StorageBackup] Listing page: offset=${offset}, count=${fileList.length}`);
        offset += fileList.length;
        hasMore = fileList.length === pageSize;

        for (const file of fileList) {
          if (!file.name) continue;
          
          if (file.name.endsWith('/')) {
            items.push({
              name: file.name,
              isFolder: true,
              size: 0,
              createdAt: file.created_at
            });
          } else {
            items.push({
              name: file.name,
              isFolder: false,
              size: file.metadata?.size || 0,
              createdAt: file.created_at
            });
          }
        }
      }

      console.log(`[StorageBackup] Found ${items.length} total items in ${displayPath}`);
    } catch (err) {
      console.error(`[StorageBackup] Error listing ${bucketName}/${folderPath}:`, err.message);
    }

    return items;
  }

  async exploreBucket(bucketName) {
    const allFiles = [];
    const processedPaths = new Set();

    const explorePath = async (folderPath = '') => {
      const pathKey = folderPath || '(root)';
      if (processedPaths.has(pathKey)) {
        console.log(`[StorageBackup] Already processed ${pathKey}, skipping`);
        return;
      }
      processedPaths.add(pathKey);

      console.log(`[StorageBackup] Exploring ${bucketName}/${pathKey}...`);
      const items = await this.listFolderContents(bucketName, folderPath);
      
      if (items.length === 0) {
        console.log(`[StorageBackup] No items found in ${pathKey}`);
        return;
      }

      const foldersToExplore = [];

      for (const item of items) {
        const fullPath = folderPath ? `${folderPath}/${item.name}` : item.name;

        if (item.isFolder) {
          foldersToExplore.push(item.name);
          console.log(`[StorageBackup] Found explicit folder: ${item.name}`);
          continue;
        }

        if (item.name.includes('/')) {
          const parentFolder = item.name.split('/')[0] + '/';
          if (!foldersToExplore.includes(parentFolder)) {
            foldersToExplore.push(parentFolder);
            console.log(`[StorageBackup] Found implicit folder from path: ${parentFolder}`);
          }
          continue;
        }

        const downloadCheck = await this.tryDownloadFirst(bucketName, fullPath);
        
        if (downloadCheck.isFolder) {
          if (!foldersToExplore.includes(item.name + '/')) {
            foldersToExplore.push(item.name + '/');
            console.log(`[StorageBackup] Detected as folder via download: ${item.name}/`);
          }
          continue;
        }

        if (downloadCheck.size > 0) {
          const cleanPath = fullPath.replace(/\/+/g, '/');
          console.log(`[StorageBackup] ✓ Confirmed file: ${cleanPath} (${downloadCheck.size} bytes)`);
          allFiles.push({
            bucket: bucketName,
            path: cleanPath,
            name: item.name,
            size: downloadCheck.size,
            createdAt: item.createdAt
          });
        }
      }

      for (const folderName of foldersToExplore) {
        if (!folderName || folderName === '/') continue;
        const fullFolderPath = folderPath ? `${folderPath}/${folderName}` : folderName;
        console.log(`[StorageBackup] Exploring subfolder: ${fullFolderPath}`);
        await explorePath(fullFolderPath);
      }
    };

    await explorePath('');
    console.log(`[StorageBackup] Total files found in ${bucketName}: ${allFiles.length}`);
    return allFiles;
  }

  async tryDownloadFirst(bucketName, itemPath) {
    try {
      const { data, error } = await this.supabase.storage
        .from(bucketName)
        .download(itemPath);

      if (error || !data) {
        if (error?.message?.includes('Not Found') || error?.message?.includes('not found')) {
          const checkList = await this.supabase.storage
            .from(bucketName)
            .list(itemPath, { limit: 1 });
          
          if (checkList.data && checkList.data.length > 0) {
            return { isFolder: true, size: 0 };
          }
        }
        return { isFolder: false, size: 0 };
      }

      if (data) {
        const arrayBuffer = await data.arrayBuffer();
        return { isFolder: false, size: arrayBuffer.byteLength };
      }
    } catch (err) {
      console.warn(`[StorageBackup] tryDownloadFirst error for ${itemPath}:`, err.message);
    }
    return { isFolder: false, size: 0 };
  }

  async downloadFile(bucketName, filePath) {
    if (!filePath || filePath.endsWith('/')) {
      return { success: false, error: 'Skipping folder path' };
    }

    try {
      const { data, error } = await this.supabase.storage
        .from(bucketName)
        .download(filePath);

      if (error) {
        const errorMsg = error.message || 'Download failed';
        if (errorMsg.includes('Not Found') || errorMsg.includes('not found')) {
          return { success: false, error: `Object not found: ${filePath}` };
        }
        return { success: false, error: errorMsg };
      }

      if (!data) {
        return { success: false, error: 'No data returned' };
      }

      const arrayBuffer = await data.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      return { 
        success: true, 
        buffer, 
        size: buffer.length,
        contentType: data.type || 'application/octet-stream'
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async backupBucket(bucketName, outputDir) {
    const bucketDir = path.join(outputDir, 'storage', bucketName);
    await this.ensureDir(bucketDir);

    console.log(`[StorageBackup] Starting backup for bucket: ${bucketName}`);
    
    const allFiles = await this.exploreBucket(bucketName);
    console.log(`[StorageBackup] Found ${allFiles.length} files in ${bucketName}`);

    const included = [];
    const missing = [];
    let totalIncludedSize = 0;

    for (const file of allFiles) {
      const downloadResult = await this.downloadFile(bucketName, file.path);
      
      if (downloadResult.success && downloadResult.buffer) {
        const targetPath = path.join(bucketDir, file.path);
        const targetDir = path.dirname(targetPath);
        await this.ensureDir(targetDir);
        
        fs.writeFileSync(targetPath, downloadResult.buffer);
        
        const checksum = await this.calculateChecksum(targetPath);
        
        included.push({
          bucket_name: bucketName,
          path: file.path,
          name: file.name,
          size: downloadResult.size,
          checksum,
          downloaded: true,
          download_error: null
        });
        
        totalIncludedSize += downloadResult.size;
        
        console.log(`[StorageBackup] ✓ ${bucketName}/${file.path} (${downloadResult.size} bytes)`);
      } else {
        missing.push({
          bucket_name: bucketName,
          path: file.path,
          name: file.name,
          downloaded: false,
          download_error: downloadResult.error
        });
        
        console.warn(`[StorageBackup] ✗ ${bucketName}/${file.path} - ${downloadResult.error}`);
      }
    }

    const bucketResult = {
      bucket_name: bucketName,
      total_files_expected: allFiles.length,
      total_files_included: included.length,
      total_files_missing: missing.length,
      total_expected_size: allFiles.reduce((sum, f) => sum + f.size, 0),
      total_included_size: totalIncludedSize,
      files_included: included,
      files_missing: missing
    };

    console.log(`[StorageBackup] ${bucketName} complete: ${included.length}/${allFiles.length} files, ${totalIncludedSize} bytes`);

    return bucketResult;
  }

  async runFullBackup(outputDir, options = {}) {
    const { buckets = this.buckets } = options;
    
    const results = {
      success: true,
      timestamp: new Date().toISOString(),
      buckets: [],
      totalFilesExpected: 0,
      totalFilesIncluded: 0,
      totalFilesMissing: 0,
      totalExpectedSize: 0,
      totalIncludedSize: 0,
      warnings: [],
      errors: []
    };

    console.log(`[StorageBackup] Starting full backup for ${buckets.length} buckets`);

    for (const bucketName of buckets) {
      try {
        const bucketResult = await this.backupBucket(bucketName, outputDir);
        results.buckets.push(bucketResult);
        
        results.totalFilesExpected += bucketResult.total_files_expected;
        results.totalFilesIncluded += bucketResult.total_files_included;
        results.totalFilesMissing += bucketResult.total_files_missing;
        results.totalExpectedSize += bucketResult.total_expected_size;
        results.totalIncludedSize += bucketResult.total_included_size;

        if (bucketResult.total_files_missing > 0) {
          results.warnings.push(`${bucketName}: ${bucketResult.total_files_missing} files missing`);
        }
      } catch (err) {
        console.error(`[StorageBackup] Bucket ${bucketName} failed:`, err.message);
        results.errors.push({ bucket: bucketName, error: err.message });
        results.success = false;
      }
    }

    results.success = results.totalFilesExpected > 0 && results.totalFilesMissing === 0;
    
    console.log(`[StorageBackup] Complete: ${results.totalFilesIncluded}/${results.totalFilesExpected} files, ${results.totalIncludedSize} bytes`);
    console.log(`[StorageBackup] Overall success: ${results.success}`);

    return results;
  }
}

export { StorageBackupService, DEFAULT_BUCKETS };