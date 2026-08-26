import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Base path matches the GitHub Pages URL (https://<user>.github.io/Artistry-and-Bloom/).
// Used unconditionally so local dev mirrors production asset paths.
export default defineConfig({
  plugins: [react()],
  base: '/Artistry-and-Bloom/',
})
