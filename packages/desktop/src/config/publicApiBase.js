/**
 * 登录/注册固定使用本值，不在页面手填（与 Vite 模式自动选 env 文件）。
 * - `vite` / `desktop:dev`：`packages/desktop/.env.development` → 默认本机 http://localhost:3000
 * - `vite build` / 安装包：`packages/desktop/.env.production` → 如阿里云 API
 */
export function getViteDefaultApiBase() {
  const v = typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE;
  const s = v != null ? String(v).trim() : "";
  return s || "http://localhost:3000";
}
