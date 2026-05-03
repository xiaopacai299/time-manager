import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useAuth } from "../hooks/useAuth";
import { useTopInset } from "../hooks/useScreenInsets";
import type { TimeRecordPayload } from "@time-manger/shared";

type Props = {
  navigation: { goBack: () => void };
};

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

export function AppStatsScreen({ navigation }: Props) {
  const { auth } = useAuth();
  const [records, setRecords] = useState<TimeRecordPayload[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const topInset = useTopInset();

  const load = useCallback(async () => {
    if (auth.status !== "authenticated") return;
    setLoading(true);
    setError(null);
    try {
      const { records: rows } = await auth.client.listTimeRecordsByDate(todayDate());
      setRecords(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [auth]);

  useEffect(() => {
    void load();
  }, [load]);

  const total = records.reduce((sum, r) => sum + r.durationMs, 0);

  return (
    <View style={[styles.root, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={navigation.goBack} hitSlop={12}>
          <Text style={styles.back}>返回</Text>
        </TouchableOpacity>
        <Text style={styles.title}>应用统计</Text>
        <View style={styles.headerSpacer} />
      </View>

      {error ? (
        <View style={styles.errBanner}>
          <Text style={styles.errText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.hero}>
        <Text style={styles.heroLabel}>今日总时长</Text>
        <Text style={styles.heroValue}>{formatMs(total)}</Text>
        <Text style={styles.heroHint}>统计今日各应用时长 · 数据来自服务端</Text>
      </View>

      <FlatList
        data={records}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            {loading ? (
              <ActivityIndicator color="#6B5B95" />
            ) : (
              <Text style={styles.emptyText}>暂无今日记录</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FAF8F5" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E8E4DE",
  },
  back: { color: "#6B5B95", fontWeight: "700", fontSize: 16 },
  title: { fontSize: 18, fontWeight: "800", color: "#2D3436" },
  headerSpacer: { width: 40 },
  errBanner: { backgroundColor: "#FFF5F5", padding: 10 },
  errText: { color: "#C53030", fontSize: 13, textAlign: "center" },
  hero: {
    marginHorizontal: 18,
    marginTop: 18,
    padding: 22,
    borderRadius: 20,
    backgroundColor: "#3D4F5F",
    alignItems: "center",
  },
  heroLabel: { fontSize: 13, color: "rgba(255,255,255,0.75)", letterSpacing: 2 },
  heroValue: {
    fontSize: 36,
    fontWeight: "800",
    color: "#F5F0E8",
    marginTop: 6,
  },
  heroHint: { fontSize: 12, color: "rgba(255,255,255,0.55)", marginTop: 8 },
  list: { paddingHorizontal: 18, paddingBottom: 40, paddingTop: 16 },
  empty: { paddingVertical: 48, alignItems: "center" },
  emptyText: { color: "#95A5A6", fontSize: 15 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    shadowColor: "#2D3436",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  rowLeft: { flex: 1, marginRight: 12 },
  appName: { fontSize: 15, fontWeight: "700", color: "#2D3436" },
  appKey: { fontSize: 12, color: "#95A5A6", marginTop: 4 },
  duration: { fontSize: 15, fontWeight: "800", color: "#6B5B95" },
});
