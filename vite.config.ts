import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { apiMiddlewarePlugin } from './vite-api-middleware'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), apiMiddlewarePlugin()],
  server: {
    proxy: {
      '/api/analyze': {
        target: 'https://idealab.alibaba-inc.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/analyze/, '/api/openai/v1/chat/completions'),
        secure: false,
        headers: {
          'Origin': 'https://idealab.alibaba-inc.com',
        },
      },
    },
  },
})
