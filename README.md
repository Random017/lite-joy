# lite-joy

Vue 3 + TypeScript + Vite 的小站：两个小游戏、一个开发者工具侧栏，以及「轻照」本地图片 / 证件照工具。

## 开发

要求 Node.js **^20.19.0 或 >=22.12.0**（Vite 8 的最低版本）。

```bash
npm install
npm run dev
```

- 主站：`http://localhost:5173/lite-joy/`
- 轻照：`http://localhost:5173/lite-joy/image-tool/`

## 构建与预览

```bash
npm run build
npm run preview
```

构建产物在 `dist/`，轻照页面在 `dist/image-tool/`，两者一起部署。`base` 固定为 `/lite-joy/`，对应 GitHub Pages 的项目路径。

## 测试

```bash
# 轻照核心逻辑单元测试
npm test

# 浏览器端冒烟 / 功能验证（需要本机 Edge，先启动 dev 或 preview）
npm run test:e2e
```

E2E 默认访问 `http://127.0.0.1:5173/lite-joy/image-tool/`，可用 `BASE_URL` 覆盖，例如：

```powershell
$env:BASE_URL='http://127.0.0.1:4184/lite-joy/image-tool/'
npm run test:e2e
```

验证截图与导出文件写入 `test-artifacts/`（已忽略）。

## 目录

```text
├─ src/                     # 主站（Vue SFC）
│  ├─ App.vue               # 首页 + 游戏视图
│  └─ components/           # 游戏、卡片、开发者工具侧栏
├─ image-tool/              # 轻照（原生 JS + Canvas，独立页面入口）
│  ├─ index.html
│  ├─ src/
│  ├─ tests/                # Vitest
│  └─ e2e/                  # Playwright
├─ vite.config.ts           # 多页面构建、base、轻照 CSP 注入
└─ vitest.config.ts
```

轻照的功能、浏览器上限和已知限制见 [image-tool/README.md](image-tool/README.md)。

## 部署

推送到 `main` 后由 [.github/workflows/deploy.yml](.github/workflows/deploy.yml) 构建并发布到 GitHub Pages。
