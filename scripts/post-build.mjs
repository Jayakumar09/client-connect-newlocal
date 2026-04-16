import { copyFileSync, mkdirSync, existsSync, cpSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));

function copyRedirects() {
  const adminRedirects = join(__dirname, '..', 'admin', '_redirects');
  const clientRedirects = join(__dirname, '..', 'client', '_redirects');
  const distAdminRedirects = join(__dirname, '..', 'dist', 'admin', '_redirects');
  const distClientRedirects = join(__dirname, '..', 'dist', 'client', '_redirects');

  if (existsSync(adminRedirects)) {
    mkdirSync(join(__dirname, '..', 'dist', 'admin'), { recursive: true });
    copyFileSync(adminRedirects, distAdminRedirects);
    console.log('✓ Copied admin/_redirects');
  }

  if (existsSync(clientRedirects)) {
    mkdirSync(join(__dirname, '..', 'dist', 'client'), { recursive: true });
    copyFileSync(clientRedirects, distClientRedirects);
    console.log('✓ Copied client/_redirects');
  }

  const adminHtml = join(__dirname, '..', 'dist', 'admin', 'admin.html');
  const adminIndex = join(__dirname, '..', 'dist', 'admin', 'index.html');
  if (existsSync(adminHtml)) {
    copyFileSync(adminHtml, adminIndex);
    console.log('✓ Renamed admin.html to index.html');
  }

  const clientHtml = join(__dirname, '..', 'dist', 'client', 'client.html');
  const clientIndex = join(__dirname, '..', 'dist', 'client', 'index.html');
  if (existsSync(clientHtml)) {
    copyFileSync(clientHtml, clientIndex);
    console.log('✓ Renamed client.html to index.html');
  }
}

function copyPublicAssets() {
  const publicDir = join(__dirname, '..', 'public');
  const distAdminPublic = join(__dirname, '..', 'dist', 'admin');
  const distClientPublic = join(__dirname, '..', 'dist', 'client');

  if (existsSync(publicDir)) {
    cpSync(publicDir, distAdminPublic, { recursive: true, overwrite: true });
    cpSync(publicDir, distClientPublic, { recursive: true, overwrite: true });
    console.log('✓ Copied public assets to dist/admin and dist/client');
  }
}

function verifyAssets() {
  for (const app of ['admin', 'client']) {
    const indexPath = join(__dirname, '..', 'dist', app, 'index.html');
    const assetsDir = join(__dirname, '..', 'dist', app, 'assets');

    if (!existsSync(indexPath)) {
      console.error(`✗ Missing index.html in dist/${app}`);
      process.exit(1);
    }

    const indexContent = readFileSync(indexPath, 'utf-8');

    const scriptMatches = indexContent.match(/src="([^"]+\.js)"/g) || [];
    for (const match of scriptMatches) {
      const src = match.match(/src="([^"]+)"/)[1];
      const assetPath = join(__dirname, '..', 'dist', app, src);
      if (!existsSync(assetPath)) {
        console.error(`✗ Missing asset: ${src} referenced in dist/${app}/index.html`);
        process.exit(1);
      }
    }

    const cssMatches = indexContent.match(/href="([^"]+\.css)"/g) || [];
    for (const match of cssMatches) {
      const href = match.match(/href="([^"]+)"/)[1];
      const assetPath = join(__dirname, '..', 'dist', app, href);
      if (!existsSync(assetPath)) {
        console.error(`✗ Missing asset: ${href} referenced in dist/${app}/index.html`);
        process.exit(1);
      }
    }

    console.log(`✓ dist/${app}/index.html references valid assets`);
  }
}

function generateETag() {
  const buildInfo = {
    timestamp: new Date().toISOString(),
    gitCommit: ''
  };

  try {
    const gitHead = readFileSync(join(__dirname, '..', '.git', 'HEAD'), 'utf-8').trim();
    if (gitHead.startsWith('ref: ')) {
      const ref = gitHead.slice(5);
      buildInfo.gitCommit = readFileSync(join(__dirname, '..', '.git', ref), 'utf-8').trim().slice(0, 7);
    }
  } catch (e) {
    // Ignore git errors
  }

  const etag = crypto.createHash('md5').update(JSON.stringify(buildInfo)).digest('hex').slice(0, 12);

  for (const app of ['admin', 'client']) {
    const etagFile = join(__dirname, '..', 'dist', app, 'ETAG');
    writeFileSync(etagFile, etag);
    console.log(`✓ Generated ETag for ${app}: ${etag}`);
  }

  return etag;
}

function main() {
  console.log('Running post-build steps...\n');

  copyRedirects();
  copyPublicAssets();

  console.log('\nVerifying build outputs...');
  verifyAssets();

  console.log('\nGenerating build info...');
  generateETag();

  console.log('\n✓ Post-build complete!');
}

main();
