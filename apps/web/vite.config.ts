import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'frappe-gantt/dist/frappe-gantt.css': new URL(
        './node_modules/frappe-gantt/dist/frappe-gantt.css',
        import.meta.url,
      ).pathname,
    },
  },
  server: { host: '127.0.0.1', port: 5173 },
  preview: { host: '127.0.0.1', port: 4173 },
});
