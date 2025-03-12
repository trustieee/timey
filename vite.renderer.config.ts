import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  resolve: {
    conditions: ['node', 'import']
  },
  build: {
    rollupOptions: {
      external: ['electron']
    }
  }
});
