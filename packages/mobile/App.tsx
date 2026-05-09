import "react-native-gesture-handler";
import "react-native-screens";
import React from "react";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./src/hooks/useAuth";
// 导入根导航器
import { RootNavigator } from "./src/navigation/RootNavigator";

export default function App() {
  return (
    // 手势处理根视图
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* 安全区域提供者 */}
      <SafeAreaProvider>
        {/* 认证提供者 */}
        <AuthProvider>
          {/* 状态栏 */}
          <StatusBar style="dark" />
          {/* 根导航器 */}
          <RootNavigator />
        </AuthProvider>
      </SafeAreaProvider>
      {/* 手势处理根视图 */}
    </GestureHandlerRootView>
  );
}
