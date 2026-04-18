import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

function calculateFileChecksum(filePath, algorithm = 'sha256') {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      return reject(new Error(`File not found: ${filePath}`));
    }

    
    const hash = crypto.createHash(algorithm);
    const stream = fs.createReadStream(filePath);
    
    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', (err) => reject(err));
  });
}

function calculateBufferChecksum(buffer, algorithm = 'sha256') {
  const hash = crypto.createHash(algorithm);
  hash.update(buffer);
  return hash.digest('hex');
}

function calculateStringChecksum(str, algorithm = 'sha256') {
  const hash = crypto.createHash(algorithm);
  hash.update(str, 'utf8');
  return hash.digest('hex');
}

async function verifyChecksum(filePath, expectedChecksum, algorithm = 'sha256') {
  try {
    const actualChecksum = await calculateFileChecksum(filePath, algorithm);
    return {
      verified: actualChecksum === expectedChecksum,
      expected: expectedChecksum,
      actual: actualChecksum
    };
  } catch (err) {
    return {
      verified: false,
      expected: expectedChecksum,
      actual: null,
      error: err.message
    };
  }
}

async function calculateDirectoryChecksums(dirPath, baseDir = null) {
  const checksums = {};
  baseDir = baseDir || dirPath;

  if (!fs.existsSync(dirPath)) {
    return checksums;
  }

  const items = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dirPath, item.name);
    const relativePath = path.relative(baseDir, fullPath);

    if (item.isDirectory()) {
      const subChecksums = await calculateDirectoryChecksums(fullPath, baseDir);
      Object.assign(checksums, subChecksums);
    } else {
      try {
        checksums[relativePath] = await calculateFileChecksum(fullPath);
      } catch (err) {
        console.warn(`[Checksum] Could not calculate checksum for ${relativePath}:`, err.message);
      }
    }
  }

  return checksums;
}

async function generateManifestChecksum(manifest) {
  const normalized = JSON.stringify(manifest, Object.keys(manifest).sort(), 2);
  return calculateStringChecksum(normalized);
}

export {
  calculateFileChecksum,
  calculateBufferChecksum,
  calculateStringChecksum,
  verifyChecksum,
  calculateDirectoryChecksums,
  generateManifestChecksum
};