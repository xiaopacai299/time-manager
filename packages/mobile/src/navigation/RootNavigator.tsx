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
import { useAuth } from "../hooks/useAuth";

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  Diaries: undefined;
  DiaryCompose: { diaryId?: string; initialDate?: string; initialContent?: string };
  Worklist: undefined;
  AppStats: undefined;
  Memos: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { auth } = useAuth();

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
        {auth.status === "unauthenticated" ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Diaries" component={DiaryScreen} />
            <Stack.Screen name="DiaryCompose" component={DiaryComposeScreen} />
            <Stack.Screen name="Worklist" component={WorklistScreen} />
            <Stack.Screen name="AppStats" component={AppStatsScreen} />
            <Stack.Screen name="Memos" component={MemoScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
