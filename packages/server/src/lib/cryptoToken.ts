import { createHash, randomBytes } from 'node:crypto';

export function hashOpaqueToken(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}

export function newOpaqueRefreshToken(): string {
  return randomBytes(48).toString('base64url');
}

/** Chrome 扩展「上传密钥」原文（仅创建成功时下发一次；前缀便于与支持 JWT 的中间件分支）。 */
export function newExtensionUploadTokenRaw(): string {
  return `tmext_${randomBytes(32).toString('base64url')}`;
}

// 登录/注册时

// 服务端生成 newOpaqueRefreshToken() 原文，返回给客户端保存。
// 同时把 hashOpaqueToken(refreshRaw) 存到数据库（不是存原文）。
// 刷新 access token 时

// 客户端把 refresh 原文传回来。
// 服务端再做一次 hashOpaqueToken(客户端传回值)，去数据库查是否存在、是否过期。
// 命中才签发新的 access token。
// 补一句关键点：
// 这一步主要是验证“你持有有效 refresh 凭证”，从而确认用户身份（通过库里那条 token 记录关联的 userId）。不是拿它直接访问业务接口；业务接口一般靠 accessToken（JWT）鉴权。
