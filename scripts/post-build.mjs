import { copyFileSync, mkdirSync, existsSync, cpSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const target = process.argv[2] || 'all';
const apps = target === 'all' ? ['admin', 'client'] : [target];

function copyRedirects() {
  for (const app of apps) {
    const srcRedirects = join(__dirname, '..', app, '_redirects');
    const distRedirects = join(__dirname, '..', 'dist', app, '_redirects');

    if (existsSync(srcRedirects)) {
      mkdirSync(join(__dirname, '..', 'dist', app), { recursive: true });
      copyFileSync(srcRedirects, distRedirects);
      console.log(`✓ Copied ${app}/_redirects`);
    }

    const htmlFile = join(__dirname, '..', 'dist', app, `${app}.html`);
    const indexFile = join(__dirname, '..', 'dist', app, 'index.html');
    if (existsSync(htmlFile)) {
      copyFileSync(htmlFile, indexFile);
      console.log(`✓ Renamed ${app}.html to index.html`);
    }
  }
}

function copyPublicAssets() {
  const publicDir = join(__dirname, '..', 'public');

  if (existsSync(publicDir)) {
    for (const app of apps) {
      cpSync(publicDir, join(__dirname, '..', 'dist', app), { recursive: true, overwrite: true });
      console.log(`✓ Copied public assets to dist/${app}`);
    }
  }
}

function verifyAssets() {
  for (const app of apps) {
    const indexPath = join(__dirname, '..', 'dist', app, 'index.html');

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

  for (const app of apps) {
    const etagFile = join(__dirname, '..', 'dist', app, 'ETAG');
    writeFileSync(etagFile, etag);
    console.log(`✓ Generated ETag for ${app}: ${etag}`);
  }

  return etag;
}

function main() {
  console.log(`Running post-build steps for: ${target}...\n`);

  copyRedirects();
  copyPublicAssets();

  console.log('\nVerifying build outputs...');
  verifyAssets();

  console.log('\nGenerating build info...');
  generateETag();

  console.log('\n✓ Post-build complete!');
}

main();
