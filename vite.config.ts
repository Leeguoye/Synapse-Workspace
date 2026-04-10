import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.keep': 'empty',
      },
    },
  },
  base: './',
  build: {
    outDir: 'dist-react',
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-ui': ['@xyflow/react', 'lucide-react', 'framer-motion'],
          'vendor-utils': ['echarts', 'uuid'],
        }
      }
    }
  },
  server: {
    port: 5173,
    strictPort: true,
  },
})
