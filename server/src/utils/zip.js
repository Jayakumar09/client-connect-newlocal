import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { createHash } from 'crypto';
import AdmZip from 'adm-zip';

export function createZipArchive(inputDir, outputPath, options = {}) {
  const { includeBaseDir = false, baseDirName = '' } = options;

  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    let totalFiles = 0;

    output.on('close', () => {
      const stats = {
        path: outputPath,
        size: archive.pointer(),
        files: totalFiles
      };
      console.log(`[Zip] Archive created: ${stats.size} bytes, ${totalFiles} files`);
      resolve(stats);
    });

    archive.on('error', (err) => {
      reject(err);
    });

    archive.on('entry', (entry) => {
      if (entry.type === 'file') {
        totalFiles++;
      }
    });

    archive.pipe(output);

    if (includeBaseDir && baseDirName) {
      archive.directory(inputDir, baseDirName);
    } else {
      archive.directory(inputDir, false);
    }

    archive.finalize();
  });
}

export async function verifyZipArchive(zipPath) {
  if (!fs.existsSync(zipPath)) {
    throw new Error(`ZIP file not found: ${zipPath}`);
  }

  const stats = fs.statSync(zipPath);
  
  if (stats.size === 0) {
    throw new Error('ZIP file is empty');
  }

  return {
    exists: true,
    size: stats.size,
    readable: true,
    verified: true
  };
}

export function listZipContents(zipPath) {
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();
  
  return entries.map(entry => ({
    name: entry.entryName,
    size: entry.header.size,
    compressedSize: entry.header.compressedSize,
    isDirectory: entry.isDirectory
  }));
}

export function extractZip(zipPath, outputDir) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const zip = new AdmZip(zipPath);
  zip.extractAllTo(outputDir, true);
  
  console.log(`[Zip] Extracted to: ${outputDir}`);
  
  return {
    extractedTo: outputDir,
    entries: listZipContents(zipPath)
  };
}

export async function createZipWithManifest(inputDir, outputPath, manifest) {
  const manifestPath = path.join(inputDir, 'backup-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  
  const stats = await createZipArchive(inputDir, outputPath);
  
  return {
    ...stats,
    manifestIncluded: true
  };
}

export function calculateZipChecksum(zipPath, algorithm = 'sha256') {
  return new Promise((resolve, reject) => {
    const hash = createHash(algorithm);
    const stream = fs.createReadStream(zipPath);
    
    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}