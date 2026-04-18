import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => {
  // Load env variables - vite automatically loads .env, .env.local, etc.
  const env = loadEnv(mode, process.cwd(), '');
  
  const isProduction = mode === 'production';
  
  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
      // Proxy API requests in development
      proxy: {
        '/api': {
          target: env.VITE_API_URL || 'http://localhost:3001',
          changeOrigin: true,
          rewrite: (path) => path,
        },
      },
    },
    
    // Production build configuration
    build: {
      outDir: 'dist',
      sourcemap: !isProduction, // Only generate sourcemaps in dev
      minify: isProduction ? 'terser' : false,
      rollupOptions: {
        output: {
          // Chunk splitting for better caching
          manualChunks: isProduction ? {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select'],
            'charts': ['recharts'],
          } : undefined,
        },
      },
      // Tell Vite to transpile packages that need it
      commonjsOptions: {
        transformMixedEsModules: true,
      },
    },
    
    plugins: [
      react(),
      // Only use component tagger in development for debugging
      mode === "development" && componentTagger(),
    ].filter(Boolean),
    
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
    
    // Environment variables exposed to client
    define: {
      // Expose deployment mode to client
      __VITE_DEPLOYMENT_MODE__: JSON.stringify(mode),
    },
    
    // CSS configuration
    css: {
      devSourcemap: !isProduction,
    },
    
    // Worker configuration
    worker: {
      format: 'es',
    },
    
    // Optimize deps
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-router-dom', '@supabase/supabase-js'],
      exclude: [],
    },
  };
});
