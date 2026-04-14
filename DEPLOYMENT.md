# Production Deployment Guide

## Overview

This guide covers deploying the full-stack matrimony application to:
- **Frontend**: Cloudflare Pages (app.vijayalakshmiboyarmatrimony.com & admin.vijayalakshmiboyarmatrimony.com)
- **Backend**: Render (API server)

## Prerequisites

1. Cloudflare account with Pages access
2. Render account
3. Supabase project (already configured)
4. Domain configured in Cloudflare

---

## Part 1: Backend Deployment (Render)

### Step 1: Create Render Web Service

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **New +** → **Web Service**
3. Connect your GitHub repository
4. Configure the service:

```
Name: matrimony-api
Region: Singapore
Branch: main
Root Directory: server
Runtime: Node
Build Command: npm run build
Start Command: npm start
Plan: Free
```

### Step 2: Environment Variables

Add these in Render dashboard → Environment:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `PORT` | `3001` |
| `SUPABASE_URL` | `https://sujliykbkpxdxitgbzwi.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | (from Supabase dashboard) |
| `ADMIN_DOMAIN` | `admin.vijayalakshmiboyarmatrimony.com` |
| `CLIENT_DOMAIN` | `app.vijayalakshmiboyarmatrimony.com` |
| `ADMIN_API_KEY` | (generate secure key) |

### Step 3: Configure CORS

The server is pre-configured to accept requests from:
- `https://app.vijayalakshmiboyarmatrimony.com`
- `https://admin.vijayalakshmiboyarmatrimony.com`
- Localhost (development)

### Step 4: Health Check

The server exposes `/health` endpoint for Render health checks.

---

## Part 2: Frontend Deployment (Cloudflare Pages)

### Option A: Single Repository with Subdirectory

Deploy from root directory with build command:

```
Build command: npm run build
Build output directory: dist
```

### Option B: Separate Deployments

For admin-only and client-only builds, use environment variables:

**Client App (app.vijayalakshmiboyarmatrimony.com):**
```
VITE_DEPLOYMENT_MODE=production
VITE_API_URL=https://matrimony-api.onrender.com
VITE_ADMIN_DOMAIN=admin.vijayalakshmiboyarmatrimony.com
VITE_CLIENT_DOMAIN=app.vijayalakshmiboyarmatrimony.com
```

**Admin App (admin.vijayalakshmiboyarmatrimony.com):**
```
VITE_DEPLOYMENT_MODE=production
VITE_API_URL=https://matrimony-api.onrender.com
VITE_ADMIN_DOMAIN=admin.vijayalakshmiboyarmatrimony.com
VITE_CLIENT_DOMAIN=app.vijayalakshmiboyarmatrimony.com
```

---

## Part 3: Domain Configuration

### Cloudflare Pages

1. Go to Cloudflare Dashboard → Pages
2. Select your project
3. Go to **Custom domains**
4. Add:
   - `app.vijayalakshmiboyarmatrimony.com`
   - `admin.vijayalakshmiboyarmatrimony.com`

### Subdomain Routing

For subdomain-based routing, configure Cloudflare Workers or Page Rules:

```javascript
// workers/hydrogen.ts - Subdomain routing
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const hostname = url.hostname;
    
    if (hostname.startsWith('admin.')) {
      // Rewrite to /admin prefix
      url.pathname = '/admin' + url.pathname;
      return fetch(url);
    }
    
    return fetch(request);
  }
}
```

---

## Part 4: Environment Files

### Frontend (.env.production)
```
VITE_SUPABASE_URL=https://sujliykbkpxdxitgbzwi.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_DEPLOYMENT_MODE=production
VITE_API_URL=https://matrimony-api.onrender.com
VITE_BACKUP_API_URL=https://matrimony-api.onrender.com
VITE_ADMIN_API_KEY=your-admin-key
```

### Backend (.env.production)
```
NODE_ENV=production
PORT=3001
SUPABASE_URL=https://sujliykbkpxdxitgbzwi.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-key
ADMIN_API_KEY=your-admin-key
CLIENT_DOMAIN=app.vijayalakshmiboyarmatrimony.com
ADMIN_DOMAIN=admin.vijayalakshmiboyarmatrimony.com
```

---

## Part 5: Testing

### Local Testing with Production Config

```bash
# Frontend
npm run build
npm run preview

# Backend
cd server
npm run build
npm start
```

### Test Checklist

- [ ] Backend health check: `https://api.example.com/health`
- [ ] CORS headers configured correctly
- [ ] Supabase connection working
- [ ] Chat upload working
- [ ] Backup functionality working
- [ ] PWA installable on mobile

---

## Troubleshooting

### CORS Errors

Check that:
1. Server has correct `ADMIN_DOMAIN` and `CLIENT_DOMAIN` env vars
2. Frontend has correct `VITE_API_URL` set
3. Domains are exactly matching (no trailing slashes)

### Build Failures

1. Clear cache: `rm -rf node_modules dist`
2. Reinstall: `npm install`
3. Check TypeScript: `npx tsc --noEmit`

### Supabase Connection Issues

1. Verify URL and keys in environment
2. Check RLS policies in Supabase dashboard
3. Test API in Supabase playground

---

## Security Checklist

- [ ] All API keys are environment variables (not in code)
- [ ] CORS restricted to allowed domains
- [ ] ADMIN_API_KEY is secure (32+ characters)
- [ ] Supabase service role key is protected
- [ ] Database RLS policies configured
- [ ] Storage bucket policies configured

---

## Monitoring

### Backend Health Check
```bash
curl https://matrimony-api.onrender.com/health
```

### Logs
View logs in Render dashboard for debugging.

### Uptime
Use a monitoring service like Better Uptime or Pingometer to monitor:
- `https://matrimony-api.onrender.com/health`
- Frontend domains
