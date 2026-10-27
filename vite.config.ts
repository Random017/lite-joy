import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'

const CSP_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
].join('; ')

// 只在构建产物里给轻照页面注入 CSP：开发模式会用到内联脚本与 WebSocket。
function injectImageToolCsp(): Plugin {
  return {
    name: 'inject-image-tool-csp',
    apply: 'build',
    transformIndexHtml(html, ctx) {
      const id = (ctx.filename ?? ctx.path).replace(/\\/g, '/')
      if (!id.includes('/image-tool/')) return html
      return html.replace(
        '<head>',
        `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP_POLICY}" />`,
      )
    },
  }
}

const entry = (path: string) => fileURLToPath(new URL(path, import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), injectImageToolCsp()],
  base: '/lite-joy/',
  build: {
    rollupOptions: {
      input: {
        main: entry('./index.html'),
        imageTool: entry('./image-tool/index.html'),
      },
    },
  },
})
