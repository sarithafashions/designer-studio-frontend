import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import process from 'node:process'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  const backendURL = new URL(env.VITE_API_BASE_URL).hostname
  const frontendURL = new URL(env.VITE_FRONTEND_URL).hostname

  return {
    plugins: [react()],

    server: {
      allowedHosts: [backendURL, frontendURL],
      port: 5173,
      open: true,
      host: true,
    },
  }
})
