# 橘子ING 官网

产品宣传落地页，技术栈：Vite + React + Framer Motion。

## 开发

```bash
# 仓库根目录
pnpm install
pnpm website:dev
```

浏览器打开 http://localhost:4321

## 构建

```bash
pnpm website:build
```

静态产物在 `packages/website/dist/`，可部署到任意静态托管（Nginx、Vercel、GitHub Pages 等）。

## 配置下载链接

编辑 `src/data/siteContent.js` 中 `DOWNLOAD_LINKS`：

1. 构建桌面安装包：`pnpm desktop:build` → `packages/desktop/release/`
2. 将安装包复制到 `public/downloads/`
3. 设置 `href: '/downloads/你的安装包文件名.exe'`

移动端 APK 同理：`pnpm mobile:build:android:apk` 后放到 `public/downloads/`。

## 站点图标

1. 将新图标放到 `public/icon-source.png`（当前为橘子ING 官方图）
2. 生成透明底 favicon / 导航图标：

```bash
cd packages/website
node scripts/strip-icon-bg.mjs
```

输出为 `public/icon.png`，供顶栏、页脚与浏览器标签使用。
