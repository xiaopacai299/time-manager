/**
 * 渲染进程默认 API 根地址（与 Vite 环境变量一致）。
 * - 本地：`packages/desktop/.env.development` → VITE_API_BASE=http://localhost:3000
 * - 生产构建：`packages/desktop/.env.production` → VITE_API_BASE=http://47.103.104.7:8080
 */
export function getViteDefaultApiBase() {
  const v = typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE;
  const s = v != null ? String(v).trim() : "";
  return s || "http://localhost:3000";
}
