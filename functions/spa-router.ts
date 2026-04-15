export async function onRequest(context) {
  const url = new URL(context.request.url);
  const pathname = url.pathname;

  // Skip static assets - let them be served normally
  if (
    pathname.startsWith('/assets/') ||
    pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|webp)$/i) ||
    pathname.startsWith('/manifest.json') ||
    pathname.startsWith('/sw.js') ||
    pathname.startsWith('/pwa-')
  ) {
    return context.next();
  }

  // Skip API requests
  if (pathname.startsWith('/api/')) {
    return context.next();
  }

  // For all other routes (SPA navigation), serve index.html
  const indexUrl = new URL('/index.html', url.origin);
  return fetch(indexUrl.toString());
}
