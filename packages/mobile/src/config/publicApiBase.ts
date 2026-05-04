/**
 * 登录页默认「服务器地址」（与 Expo 公共环境变量一致）。
 * - 本地：`packages/mobile/.env.development` → EXPO_PUBLIC_API_BASE
 * - 生产：`eas.json` 的 production.env 或 `.env.production`
 */
export const DEFAULT_PUBLIC_API_BASE =
  process.env.EXPO_PUBLIC_API_BASE?.trim() || "http://10.0.2.2:3000";
