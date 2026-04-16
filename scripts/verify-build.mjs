import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = process.argv[2] || 'client';

const distDir = join(__dirname, '..', 'dist', app);

console.log(`\n🔍 Verifying ${app} build...\n`);

function checkFile(name, path) {
  const fullPath = join(distDir, path);
  if (!existsSync(fullPath)) {
    console.error(`❌ Missing: ${path}`);
    return false;
  }
  console.log(`✅ ${name}: ${path}`);
  return true;
}

let success = true;

console.log('📁 Checking critical files...');
success = checkFile('index.html', 'index.html') && success;
success = checkFile('JavaScript bundle', findFile(distDir, 'assets', '.js')) && success;

console.log('\n📄 Checking index.html references...');
const indexPath = join(distDir, 'index.html');
const indexContent = readFileSync(indexPath, 'utf-8');

const scriptMatches = indexContent.match(/src="([^"]+\.js)"/g) || [];
const cssMatches = indexContent.match(/href="([^"]+\.css)"/g) || [];

for (const match of scriptMatches) {
  const src = match.match(/src="([^"]+)"/)[1];
  success = checkFile('Script', src) && success;
}

for (const match of cssMatches) {
  const href = match.match(/href="([^"]+)"/)[1];
  success = checkFile('Stylesheet', href) && success;
}

console.log('\n📦 Checking static assets...');
const publicAssets = [
  'favicon.svg',
  'apple-touch-icon.png',
  'manifest.json',
  'sw.js'
];

for (const asset of publicAssets) {
  if (existsSync(join(distDir, asset))) {
    console.log(`✅ Static asset: ${asset}`);
  }
}

console.log('\n🌐 Checking routing configuration...');
if (existsSync(join(distDir, '_redirects'))) {
  console.log('✅ _redirects file exists');
} else {
  console.warn('⚠️ _redirects file missing (may be configured via Cloudflare Dashboard)');
}

console.log('\n📊 Build statistics...');
const assetsDir = join(distDir, 'assets');
if (existsSync(assetsDir)) {
  const files = getAllFiles(assetsDir);
  const totalSize = files.reduce((acc, f) => acc + statSync(f).size, 0);
  console.log(`   Total files in assets/: ${files.length}`);
  console.log(`   Total size: ${(totalSize / 1024).toFixed(2)} KB`);
}

function findFile(dir, subDir, ext) {
  const searchDir = join(dir, subDir);
  if (!existsSync(searchDir)) return 'NOT_FOUND';

  const files = readdirSync(searchDir);
  const match = files.find(f => f.endsWith(ext));
  return match ? join(subDir, match) : 'NOT_FOUND';
}

function getAllFiles(dir, files = []) {
  if (!existsSync(dir)) return files;

  for (const file of readdirSync(dir)) {
    const path = join(dir, file);
    if (statSync(path).isDirectory()) {
      getAllFiles(path, files);
    } else {
      files.push(path);
    }
  }
  return files;
}

console.log('\n' + (success ? '✅ Build verification PASSED' : '❌ Build verification FAILED') + '\n');

process.exit(success ? 0 : 1);
