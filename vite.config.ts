import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2022',
    // three.js alone is ~740 kB minified; it is split into its own long-lived chunk below.
    chunkSizeWarningLimit: 800,
    rolldownOptions: {
      output: {
        // Stable vendor chunks: they change far less often than app code, so they cache well.
        codeSplitting: {
          groups: [
            { name: 'three', test: /node_modules[\\/]three[\\/]/, priority: 30 },
            { name: 'postfx', test: /node_modules[\\/](postprocessing|n8ao|@react-three[\\/]postprocessing)[\\/]/, priority: 25 },
            { name: 'r3f', test: /node_modules[\\/](@react-three|three-stdlib|three-mesh-bvh|camera-controls|maath|zustand|@use-gesture)[\\/]/, priority: 20 },
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler|framer-motion|motion-dom|motion-utils)[\\/]/, priority: 10 },
          ],
        },
      },
    },
  },
})
