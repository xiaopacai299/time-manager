/**
 * 编译期写入的 API 根地址（登录不再手填，始终用此值）。
 * - 本地 `pnpm run mobile:start`：`packages/mobile/.env.development` 的 EXPO_PUBLIC_API_BASE（默认模拟器 10.0.2.2:3000；真机连本机请改成电脑局域网 IP）
 * - EAS 打包：`eas.json` 各 profile 的 `env.EXPO_PUBLIC_API_BASE`（如公网服务器）
 */
export const DEFAULT_PUBLIC_API_BASE =
  process.env.EXPO_PUBLIC_API_BASE?.trim() || "http://10.0.2.2:3000";
