import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  Alert,
} from "react-native";
import { useAuth } from "../hooks/useAuth";
import { useSync } from "../sync/SyncProvider";
import { fetchTodayRecords } from "../storage/timeRecordQueries";
import type { TimeRecordPayload } from "@time-manger/shared";

function formatMs(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return "<1m";
}

function todayDate(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function HomeScreen() {
  const { auth, logout } = useAuth();
  const { triggerSync, status, lastSyncAt, error: syncError, syncTick } =
    useSync();
  const [records, setRecords] = useState<TimeRecordPayload[]>([]);
  const [loadingDb, setLoadingDb] = useState(false);

  const reloadFromLocal = useCallback(async () => {
    setLoadingDb(true);
    try {
      const today = todayDate();
      const rows = await fetchTodayRecords(today);
      setRecords(rows);
    } finally {
      setLoadingDb(false);
    }
  }, []);

  useEffect(() => {
    void reloadFromLocal();
  }, [reloadFromLocal, syncTick]);

  const handleSync = useCallback(async () => {
    await triggerSync();
    await reloadFromLocal();
  }, [triggerSync, reloadFromLocal]);

  const handleLogout = useCallback(() => {
    Alert.alert("登出", "确定要退出登录吗？", [
      { text: "取消", style: "cancel" },
      {
        text: "登出",
        style: "destructive",
        onPress: () => void logout(),
      },
    ]);
  }, [logout]);

  const user = auth.status === "authenticated" ? auth.user : null;
  const total = records.reduce((sum, r) => sum + r.durationMs, 0);
  const syncing = status === "syncing";

  return (
    <SafeAreaView style={styles.flex}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>今日统计</Text>
          {user && (
            <Text style={styles.headerSub}>{user.email}</Text>
          )}
        </View>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.logoutText}>登出</Text>
        </TouchableOpacity>
      </View>

      {records.length > 0 && (
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>今日总时长</Text>
          <Text style={styles.totalValue}>{formatMs(total)}</Text>
        </View>
      )}

      <FlatList
        data={records}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={syncing || loadingDb}
            onRefresh={() => void handleSync()}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            {syncing || loadingDb ? (
              <ActivityIndicator size="large" color="#4f46e5" />
            ) : (
              <>
                <Text style={styles.emptyText}>暂无今日数据</Text>
                <Text style={styles.emptyHint}>
                  下拉刷新或点击「立即同步」（与桌面端共用 SyncEngine）
                </Text>
              </>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.appName}>{item.appName}</Text>
              <Text style={styles.appKey}>{item.appKey}</Text>
            </View>
            <Text style={styles.duration}>{formatMs(item.durationMs)}</Text>
          </View>
        )}
      />

      {syncError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{syncError}</Text>
        </View>
      ) : null}

      <View style={styles.footer}>
        {lastSyncAt && (
          <Text style={styles.syncTime}>上次同步：{lastSyncAt}</Text>
        )}
        <TouchableOpacity
          style={[styles.syncButton, syncing && styles.syncButtonDisabled]}
          onPress={() => void handleSync()}
          disabled={syncing}
        >
          {syncing ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.syncButtonText}>立即同步</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#f5f5f5" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#1a1a1a" },
  headerSub: { fontSize: 12, color: "#888", marginTop: 2 },
  logoutText: { fontSize: 14, color: "#e53e3e", paddingTop: 4 },
  totalCard: {
    backgroundColor: "#4f46e5",
    margin: 16,
    borderRadius: 14,
    padding: 20,
    alignItems: "center",
  },
  totalLabel: { fontSize: 14, color: "rgba(255,255,255,0.8)" },
  totalValue: {
    fontSize: 36,
    fontWeight: "800",
    color: "#fff",
    marginTop: 4,
  },
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  empty: {
    paddingVertical: 60,
    alignItems: "center",
  },
  emptyText: { fontSize: 16, color: "#888", marginBottom: 6 },
  emptyHint: { fontSize: 13, color: "#bbb", textAlign: "center", paddingHorizontal: 24 },
  row: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  rowLeft: { flex: 1, marginRight: 12 },
  appName: { fontSize: 15, fontWeight: "600", color: "#1a1a1a" },
  appKey: { fontSize: 12, color: "#999", marginTop: 2 },
  duration: { fontSize: 15, fontWeight: "700", color: "#4f46e5" },
  errorBanner: {
    backgroundColor: "#fff5f5",
    borderTopWidth: 1,
    borderTopColor: "#feb2b2",
    padding: 12,
  },
  errorText: { color: "#c53030", fontSize: 13, textAlign: "center" },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#eee",
    padding: 16,
    paddingBottom: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  syncTime: { fontSize: 12, color: "#999", flex: 1 },
  syncButton: {
    backgroundColor: "#4f46e5",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 90,
    alignItems: "center",
  },
  syncButtonDisabled: { opacity: 0.6 },
  syncButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
