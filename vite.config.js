import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Project site lives at https://<user>.github.io/ArchiveVault/
// so assets must be served from that sub-path.
export default defineConfig({
  base: '/ArchiveVault/',
  plugins: [react()],
})
