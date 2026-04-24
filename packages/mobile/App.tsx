import "react-native-screens";
import React from "react";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "./src/hooks/useAuth";
import { SyncProvider } from "./src/sync/SyncProvider";
import { RootNavigator } from "./src/navigation/RootNavigator";

export default function App() {
  return (
    <AuthProvider>
      <SyncProvider>
        <StatusBar style="auto" />
        <RootNavigator />
      </SyncProvider>
    </AuthProvider>
  );
}
