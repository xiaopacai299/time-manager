const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");
const workspaceNodeModules = path.join(workspaceRoot, "node_modules");

const config = getDefaultConfig(projectRoot);

config.watchFolders = Array.from(
  new Set([...(config.watchFolders ?? []), workspaceRoot])
);
config.resolver.nodeModulesPaths = [
  path.join(projectRoot, "node_modules"),
  workspaceNodeModules,
];
config.resolver.extraNodeModules = {
  react: path.join(workspaceNodeModules, "react"),
  "react-native": path.join(workspaceNodeModules, "react-native"),
};

module.exports = config;
