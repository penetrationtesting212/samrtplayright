import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/codegen': {
        target: 'http://localhost:3001',
        ws: true,
        changeOrigin: true,
      },
    },
  },
  // Prevent Vite from crawling large test workspaces and experimental CT packages
  resolve: {
    alias: {
      // Treat experimental CT packages as external/unresolvable in app build
      '@playwright/experimental-ct-react': '/__do_not_resolve__',
      '@playwright/experimental-ct-react17': '/__do_not_resolve__',
      '@playwright/experimental-ct-vue': '/__do_not_resolve__',
      '@playwright/experimental-ct-svelte': '/__do_not_resolve__',
    }
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    rollupOptions: {
      // Explicitly externalize experimental CT packages to avoid resolution warnings
      external: [
        '@playwright/experimental-ct-react',
        '@playwright/experimental-ct-react17',
        '@playwright/experimental-ct-vue',
        '@playwright/experimental-ct-svelte',
      ]
    }
  },
});
