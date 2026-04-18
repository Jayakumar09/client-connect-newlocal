# Production Deployment Guide

## Overview

This guide covers deploying the matrimony application with **separate, independent builds** for admin and client frontends:
- **Admin App**: `admin.vijayalakshmiboyarmatrimony.com` → `dist/admin/`
- **Client App**: `app.vijayalakshmiboyarmatrimony.com` → `dist/client/`

---

## Folder Structure

```
client-connect-main/
├── admin/
│   ├── index.html          # Admin app entry point
│   └── _redirects           # Admin routing rules
├── client/
│   ├── index.html          # Client app entry point
│   └── _redirects           # Client routing rules
├── dist/
│   ├── admin/               # Admin build output (gitignored)
│   │   ├── index.html
│   │   ├── assets/
│   │   ├── _redirects
│   │   ├── favicon.svg
│   │   └── ...
│   └── client/              # Client build output (gitignored)
│       ├── index.html
│       ├── assets/
│       ├── _redirects
│       └── ...
├── scripts/
│   ├── post-build.mjs       # Post-build script (copies redirects, assets)
│   └── verify-build.mjs     # Build verification script
├── src/
│   ├── main-admin.tsx       # Admin entry point
│   ├── main-client.tsx      # Client entry point
│   └── ...
├── vite.admin.config.ts     # Admin Vite config
├── vite.client.config.ts   # Client Vite config
├── wrangler-admin.toml      # Cloudflare config for admin
├── wrangler-client.toml    # Cloudflare config for client
└── package.json
```

---

## Prerequisites

1. Cloudflare account with Pages access
2. Wrangler CLI installed (`npm install -g wrangler`)
3. Domains configured in Cloudflare DNS:
   - `admin.vijayalakshmiboyarmatrimony.com` → CNAME to Cloudflare Pages
   - `app.vijayalakshmiboyarmatrimony.com` → CNAME to Cloudflare Pages

---

## Build Commands

### Build Both Apps
```bash
npm run build:all
```

### Build Admin Only
```bash
npm run build:admin
```

### Build Client Only
```bash
npm run build:client
```

### Development Builds
```bash
npm run build:admin:dev
npm run build:client:dev
```

### Preview Builds Locally
```bash
npm run preview:admin   # Opens on port 8081
npm run preview:client  # Opens on port 8080
```

### Verify Builds
```bash
npm run verify:admin
npm run verify:client
npm run verify:all
```

### Clean Build Artifacts
```bash
npm run clean
```

---

## Environment Variables

### Admin Environment (.env.admin)
```bash
VITE_SUPABASE_URL=https://sujliykbkpxdxitgbzwi.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_URL=https://matrimony-api.onrender.com
VITE_API_BASE_URL=https://matrimony-api.onrender.com
VITE_DEPLOYMENT_MODE=production
VITE_APP_AREA=admin
VITE_ADMIN_DOMAIN=admin.vijayalakshmiboyarmatrimony.com
VITE_CLIENT_DOMAIN=app.vijayalakshmiboyarmatrimony.com
VITE_ADMIN_API_KEY=your-admin-key
```

### Client Environment (.env.client)
```bash
VITE_SUPABASE_URL=https://sujliykbkpxdxitgbzwi.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_URL=https://matrimony-api.onrender.com
VITE_API_BASE_URL=https://matrimony-api.onrender.com
VITE_DEPLOYMENT_MODE=production
VITE_APP_AREA=client
VITE_ADMIN_DOMAIN=admin.vijayalakshmiboyarmatrimony.com
VITE_CLIENT_DOMAIN=app.vijayalakshmiboyarmatrimony.com
```

### OpenAI / Codex API Keys

For integrations that use OpenAI (Codex / ChatGPT models), configure API keys in your environment.

- **Server (recommended):** set the server-side key and never commit it to source control. Use this key for any proxy or backend calls to OpenAI.

```bash
OPENAI_API_KEY=sk-...        # Server-side secret (DO NOT expose to clients)
```

- **Client (only for development/testing; not recommended for production):** Vite exposes `VITE_` prefixed env vars to the browser, so keys set this way will be public.

```bash
VITE_OPENAI_API_KEY=sk-...    # Public if built into client — use with caution
```

Recommended approach: keep `OPENAI_API_KEY` on the server and add a server-side API route that proxies requests to OpenAI. This prevents leaking your secret key to end users.

---

## Cloudflare Deployment

### Option 1: Using Wrangler CLI

#### Deploy Admin App
```bash
npm run deploy:admin
```

#### Deploy Client App
```bash
npm run deploy:client
```

### Option 2: Using Cloudflare Dashboard

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → Pages
2. Create two separate projects:
   - `vijayalakshmi-admin`
   - `vijayalakshmi-client`

3. For each project, configure:

**Admin Project:**
- Build command: `npm run build:admin`
- Build output directory: `dist/admin`
- Environment variables: Add from `.env.admin`

**Client Project:**
- Build command: `npm run build:client`
- Build output directory: `dist/client`
- Environment variables: Add from `.env.client`

4. Add custom domains:
   - Admin: `admin.vijayalakshmiboyarmatrimony.com`
   - Client: `app.vijayalakshmiboyarmatrimony.com`

---

## _redirects Configuration

The `_redirects` files prevent Cloudflare from rewriting static asset requests to `index.html`.

### Admin _redirects (dist/admin/_redirects)
```
/assets/*                  200
/favicon.svg               200
/favicon.ico               200
/apple-touch-icon.png      200
/robots.txt                200
/mask-icon.svg             200
/pwa-192x192.png           200
/pwa-512x512.png           200
/manifest.json             200
/sw.js                     200
/*                       /index.html   200
```

### Client _redirects (dist/client/_redirects)
```
/assets/*                  200
/favicon.svg               200
/favicon.ico               200
/apple-touch-icon.png      200
/robots.txt                200
/mask-icon.svg             200
/images/*                  200
/pwa-192x192.png           200
/pwa-512x512.png           200
/manifest.json             200
/sw.js                     200
/*                       /index.html   200
```

---

## wrangler.toml Configuration

### Admin (wrangler-admin.toml)
```toml
name = "vijayalakshmi-admin"
compatibility_date = "2024-01-01"
pages_build_output_dir = "dist/admin"

[vars]
APP_AREA = "admin"

[[routes]]
pattern = "admin.vijayalakshmiboyarmatrimony.com"
zone_name = "vijayalakshmiboyarmatrimony.com"

[[headers]]
for = "/*"
[headers.values]
X-Frame-Options = "DENY"
X-Content-Type-Options = "nosniff"
Cache-Control = "no-cache"

[[headers]]
for = "/assets/*"
[headers.values]
Cache-Control = "public, max-age=31536000, immutable"
```

### Client (wrangler-client.toml)
```toml
name = "vijayalakshmi-client"
compatibility_date = "2024-01-01"
pages_build_output_dir = "dist/client"

[vars]
APP_AREA = "client"

[[routes]]
pattern = "app.vijayalakshmiboyarmatrimony.com"
zone_name = "vijayalakshmiboyarmatrimony.com"

[[headers]]
for = "/*"
[headers.values]
X-Frame-Options = "DENY"
X-Content-Type-Options = "nosniff"

[[headers]]
for = "/assets/*"
[headers.values]
Cache-Control = "public, max-age=31536000, immutable"
```

---

## Cache-Busting Strategy

### Build-Time Cache-Busting
- Vite automatically adds content hashes to asset filenames
- Example: `assets/index-a1b2c3d4.js`

### Cache Headers (set via wrangler.toml)
- **Static assets** (`/assets/*`): `Cache-Control: public, max-age=31536000, immutable`
- **HTML files**: `Cache-Control: no-cache` (always fetch fresh)
- **Favicon/icons**: `Cache-Control: public, max-age=86400`

### Version ETag
Each build generates an ETag file at `dist/{app}/ETAG` containing:
- Build timestamp
- Package version
- Git commit hash (if available)

---

## Post-Deploy Verification

### Automated Verification Script
```bash
npm run verify:admin
npm run verify:client
```

### Manual Checks

1. **Admin App**
   - Visit: `https://admin.vijayalakshmiboyarmatrimony.com`
   - Check browser console for `[Boot] App area: ADMIN`
   - Verify assets load: `https://admin.vijayalakshmiboyarmatrimony.com/assets/*.js`

2. **Client App**
   - Visit: `https://app.vijayalakshmiboyarmatrimony.com`
   - Check browser console for `[Boot] App area: CLIENT`
   - Verify PWA loads: `https://app.vijayalakshmiboyarmatrimony.com/manifest.json`

3. **Asset Validation**
   - Open DevTools → Network tab
   - Refresh page
   - Verify no 404 errors for assets
   - Verify JS/CSS files have `200 OK` status (not redirected to index.html)

4. **API Connectivity**
   - Open DevTools → Console
   - Check for CORS errors
   - Verify API calls to `matrimony-api.onrender.com` succeed

---

## Troubleshooting

### Build Fails with "Missing index.html"
- Ensure you're in the project root directory
- Check that `npm install` has been run
- Verify `admin/index.html` and `client/index.html` exist

### Assets Return 404
- Verify `_redirects` file exists in `dist/{app}/`
- Check Cloudflare Pages → Settings → Build output directory
- Ensure static assets are in `dist/{app}/assets/`

### Wrong App Loads on Domain
- Verify `VITE_APP_AREA` is set correctly in environment
- Check Cloudflare Pages custom domain configuration
- Clear browser cache or use incognito mode

### CORS Errors
- Verify backend CORS whitelist includes correct domains
- Check `VITE_API_URL` matches backend domain
- Ensure HTTPS is used in production

---

## CI/CD Pipeline (GitHub Actions)

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build Admin
        run: npm run build:admin
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
          VITE_API_URL: ${{ secrets.VITE_API_URL }}
          VITE_APP_AREA: admin

      - name: Build Client
        run: npm run build:client
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
          VITE_API_URL: ${{ secrets.VITE_API_URL }}
          VITE_APP_AREA: client

      - name: Deploy Admin
        run: npx wrangler pages deploy dist/admin --project-name=vijayalakshmi-admin
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}

      - name: Deploy Client
        run: npx wrangler pages deploy dist/client --project-name=vijayalakshmi-client
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

---

## Security Checklist

- [ ] API keys stored in environment variables (not in code)
- [ ] CORS restricted to allowed domains only
- [ ] `ADMIN_API_KEY` is secure (32+ characters)
- [ ] Supabase RLS policies configured
- [ ] Cloudflare security headers enabled
- [ ] HTTPS enforced on all domains
- [ ] No sensitive data in client-side code
