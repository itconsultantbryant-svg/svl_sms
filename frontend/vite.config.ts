import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiUrl = (env.VITE_API_URL || '').trim();

  // Electron desktop builds load from file://, so assets must be referenced with
  // relative paths ("./"). The web build is served from the domain root, where an
  // absolute base ("/") keeps deep-link refreshes working.
  const base = mode === 'electron' ? './' : '/';

  return {
    base,
    plugins: [react()],
    server: {
      port: 3000,
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
    // Only override when a real value exists — never bake in `undefined`.
    // For the `electron` mode VITE_API_URL is intentionally left empty so the
    // app discovers the local backend URL at runtime via the preload bridge.
    define: apiUrl
      ? {
          'import.meta.env.VITE_API_URL': JSON.stringify(apiUrl),
        }
      : undefined,
  };
});
