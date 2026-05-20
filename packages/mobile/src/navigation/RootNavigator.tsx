import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActivityIndicator, View } from "react-native";
import { LoginScreen } from "../screens/LoginScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { DiaryScreen } from "../screens/DiaryScreen";
import { DiaryComposeScreen } from "../screens/DiaryComposeScreen";
import { WorklistScreen } from "../screens/WorklistScreen";
import { AppStatsScreen } from "../screens/AppStatsScreen";
import { MemoScreen } from "../screens/MemoScreen";
import { YearWorkScreen } from "../screens/YearWorkScreen";
import { PageListenScreen } from "../screens/PageListenScreen";
import { ExtensionTokensScreen } from "../screens/ExtensionTokensScreen";
import { useAuth } from "../hooks/useAuth";

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  Diaries: undefined;
  DiaryCompose: { diaryId?: string; initialDate?: string; initialContent?: string };
  Worklist: undefined;
  AppStats: undefined;
  Memos: undefined;
  YearWork: undefined;
  PageListen: undefined;
  ExtensionTokens: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { auth } = useAuth();
  // 加载中显示登陆前的加载动画，
  if (auth.status === "loading") {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {/* 未认证时显示登录页面 */}
        {auth.status === "unauthenticated" ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
            {/* 认证时显示主页面 */}
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Diaries" component={DiaryScreen} />
            <Stack.Screen name="DiaryCompose" component={DiaryComposeScreen} />
            <Stack.Screen name="Worklist" component={WorklistScreen} />
            <Stack.Screen name="AppStats" component={AppStatsScreen} />
            <Stack.Screen name="Memos" component={MemoScreen} />
            <Stack.Screen name="YearWork" component={YearWorkScreen} />
            <Stack.Screen name="PageListen" component={PageListenScreen} />
            <Stack.Screen name="ExtensionTokens" component={ExtensionTokensScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
