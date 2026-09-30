import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const SERVERS = ['api', 'web', 'adminApi', 'adminWeb']

const portFromBlock = (env: Record<string, string>, name: string) => {
  const base = Number(env.TEZT_PORT_BASE || 0)
  const index = SERVERS.indexOf(name)
  return base > 0 && index >= 0 ? base + index : 0
}

const stripTrailingSlash = (value: string) => value.replace(/\/+$/, '')

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  const adminApiPort =
    Number(env.E2E_ADMIN_API_PORT || 0) || portFromBlock(env, 'adminApi')
  const adminWebPort =
    Number(env.E2E_ADMIN_WEB_PORT || 0) || portFromBlock(env, 'adminWeb') || 5173

  const configuredOrigin = stripTrailingSlash(
    env.E2E_ADMIN_API_ORIGIN ||
      (adminApiPort ? `http://localhost:${adminApiPort}` : '') ||
      env.VITE_API_URL ||
      ''
  )

  const devApiOrigin = configuredOrigin || 'http://localhost:5000'

  if (command === 'serve' || configuredOrigin) {
    process.env.VITE_ADMIN_API_ORIGIN = devApiOrigin
  }

  return {
    plugins: [react()],
    server: {
      port: adminWebPort,
      proxy: {
        '/api': {
          target: devApiOrigin,
          changeOrigin: true,
          secure: false,
        },
        '/socket.io': {
          target: devApiOrigin,
          changeOrigin: true,
          secure: false,
          ws: true,
        },
      },
    },
  }
})
