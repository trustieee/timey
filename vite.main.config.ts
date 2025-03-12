import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  resolve: {
    // Some libs that can run in both Web and Node.js need to be told how to resolve
    conditions: ['node', 'require'],
  },
  build: {
    rollupOptions: {
      external: ['electron'],
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
  },
});
