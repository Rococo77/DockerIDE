import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      // Native addons can't be bundled. dockerode -> ssh2 loads its optional native crypto
      // and cpu-features inside try/catch and falls back to pure JS when they are missing.
      external: [/\.node$/, 'cpu-features'],
    },
  },
});
