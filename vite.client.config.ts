import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_,CLIENT_');
  const isProduction = mode === 'production';

  return {
    base: '/',
    build: {
      outDir: 'dist/client',
      emptyOutDir: true,
      sourcemap: !isProduction,
      minify: isProduction ? 'terser' : false,
      rollupOptions: {
        input: './client.html',
        output: {
          manualChunks: isProduction ? {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select'],
            'charts': ['recharts'],
          } : undefined,
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
        },
      },
      commonjsOptions: {
        transformMixedEsModules: true,
      },
    },
    plugins: [
      react(),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core"
      ],
    },
    define: {
      __VITE_DEPLOYMENT_MODE__: JSON.stringify(mode),
      __VITE_APP_AREA__: JSON.stringify('client'),
    },
    server: {
      host: "::",
      port: 8080,
      proxy: {
        '/api': {
          target: env.VITE_API_URL || 'http://localhost:3001',
          changeOrigin: true,
          rewrite: (path) => path,
        },
      },
    },
    worker: {
      format: 'es',
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-router-dom', '@supabase/supabase-js'],
    },
  };
});
