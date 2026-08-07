import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiUrl = (env.VITE_API_URL || '').trim();

  return {
    plugins: [react()],
    server: {
      port: 3000,
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
    },
    // Only override when a real value exists — never bake in `undefined`
    define: apiUrl
      ? {
          'import.meta.env.VITE_API_URL': JSON.stringify(apiUrl),
        }
      : undefined,
  };
});
