# @time-manger/mobile

Expo（React Native）移动端，**使用 Expo Go 开发**，无需本机 Android Studio / Xcode / JDK / NDK。

## 启动

在仓库根目录：

```bash
pnpm install
pnpm --filter @time-manger/mobile start
```

终端会出现一个二维码：

- **手机端**：在 Play Store / App Store 下载 **Expo Go**，用它扫码打开（Android 直接扫，iOS 需用相机扫码）。
- **电脑与手机不在同一局域网时**：默认脚本已加 `--tunnel`，Expo 会通过隧道转发。如果同一 Wi‑Fi 想更快连接，可以执行 `pnpm --filter @time-manger/mobile start:lan`。

修改源码后，Expo Go 会自动热重载；若没刷新，**摇手机 → Reload**。

## 不再需要的东西

由于改用 Expo Go：

- 不再需要 `android/` / `ios/` 原生工程（已删除，已加入 `.gitignore`）。
- 不再需要 `expo run:android` / `expo run:ios` / `gradlew` / `adb` / `JAVA_HOME` / `NDK`。
- 若以后要发布独立安装包或加自定义原生模块，再用 **EAS Build**（云端构建）或本地 `npx expo prebuild` 重新生成原生工程即可。

## 注意

Expo Go 只支持 Expo SDK 内置模块。本项目当前依赖均在 Expo SDK 范围内：`expo-sqlite`、`expo-secure-store`、`expo-status-bar`、`react-native-safe-area-context`、`react-native-screens`、`@react-navigation/*` 等。

## 服务端地址

登录页里的 **服务器地址** 默认是 `http://10.0.2.2:3000`（仅 Android 模拟器可用，指代宿主机）。  
**真机用 Expo Go**：把它改成 **电脑在局域网里的 IP**（例如 `http://192.168.1.100:3000`），并确保后端在 `0.0.0.0` 上监听、防火墙放行该端口。
