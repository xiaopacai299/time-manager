/**
 * Metro 打包配置（React Native / Expo 的 JS 打包器）。
 *
 * 本仓库是 monorepo：依赖可能被提升到仓库根目录的 node_modules。
 * 下面几项让 Metro 既能监视 packages/mobile，也能正确解析根目录里的依赖。
 */
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

/** 当前包目录：packages/mobile */
const projectRoot = __dirname;
/** 仓库根目录（mobile 的上两级） */
const workspaceRoot = path.resolve(projectRoot, "../..");
const workspaceNodeModules = path.join(workspaceRoot, "node_modules");

const config = getDefaultConfig(projectRoot);

/** 监视目录：包含默认路径 + 整个 workspace，否则根目录源码/依赖变更可能不会被热更新捕获 */
config.watchFolders = Array.from(
  new Set([...(config.watchFolders ?? []), workspaceRoot])
);
/** 解析依赖时依次查找：本包 node_modules → 仓库根 node_modules */
config.resolver.nodeModulesPaths = [
  path.join(projectRoot, "node_modules"),
  workspaceNodeModules,
];
/** 强制 react / react-native 从 workspace 根解析，避免 monorepo 里多份 React 导致 hooks 等问题 */
config.resolver.extraNodeModules = {
  react: path.join(workspaceNodeModules, "react"),
  "react-native": path.join(workspaceNodeModules, "react-native"),
};
/** 忽略 Expo 导出缓存目录下的临时文件，避免误打包或监听噪音 */
config.resolver.blockList = /.*\.expo-export-.*/;

module.exports = config;
