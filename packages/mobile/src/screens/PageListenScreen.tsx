import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../hooks/useAuth";
import { useTopInset } from "../hooks/useScreenInsets";

type CaptureRow = {
  id: string;
  url: string;
  title: string;
  pageSnippet: string;
  aiSummary: string;
  capturedAt: string;
};

type Props = {
  navigation: { goBack: () => void; navigate: (screen: "ExtensionTokens") => void };
};

const POLL_MS = 5000;

const THEME = {
  bg: "#F5F0E8",
  paper: "#FDFCF9",
  ink: "#2C3E50",
  inkMuted: "#7F8C8D",
  accent: "#6B5B95",
};

export function PageListenScreen({ navigation }: Props) {
  const { auth } = useAuth();
  const [captures, setCaptures] = useState<CaptureRow[]>([]);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const topInset = useTopInset();

  const load = useCallback(async () => {
    if (auth.status !== "authenticated") return;
    setError(null);
    try {
      const { captures: rows } = await auth.client.listPageListenCaptures(50);
      setCaptures(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setBootstrapping(false);
    }
  }, [auth]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load();
      timerRef.current = setInterval(() => void load(), POLL_MS);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null;
      };
    }, [load])
  );

  const toggleExpand = (id: string) => {
    setExpanded((m) => ({ ...m, [id]: !m[id] }));
  };

  const renderItem = ({ item }: { item: CaptureRow }) => {
    const open = !!expanded[item.id];
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {item.title?.trim() || "（无标题）"}
        </Text>
        <Text style={styles.cardMeta} numberOfLines={1}>
          {new Date(item.capturedAt).toLocaleString()}
        </Text>
        <Text style={styles.cardUrl} numberOfLines={2}>
          {item.url}
        </Text>
        <Text style={styles.summary}>{item.aiSummary}</Text>
        <TouchableOpacity onPress={() => toggleExpand(item.id)} activeOpacity={0.85}>
          <Text style={styles.expandHint}>{open ? "收起网页摘录" : "展开网页摘录"}</Text>
        </TouchableOpacity>
        {open ? (
          <Text style={styles.snippet}>{item.pageSnippet || "—"}</Text>
        ) : null}
      </View>
    );
  };

  return (
    <View style={[styles.root, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
          <Text style={styles.backText}>← 返回</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>监听页面</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate("ExtensionTokens")}
          hitSlop={10}
          style={styles.headerRight}
        >
          <Text style={styles.headerLink}>扩展密钥</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.sub}>
        来自 Chrome 扩展上传的网页摘要；本页每 {POLL_MS / 1000} 秒自动刷新。右上角可生成长期「上传密钥」填入扩展。
      </Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {bootstrapping && captures.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={THEME.accent} />
        </View>
      ) : (
        <FlatList
          data={captures}
          keyExtractor={(x) => x.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void onRefresh()}
              tintColor={THEME.accent}
              colors={[THEME.accent]}
            />
          }
          ListEmptyComponent={
            !bootstrapping ? (
              <Text style={styles.empty}>暂无记录。请在电脑 Chrome 安装扩展并对网页使用右键「监听页面」。</Text>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: THEME.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backBtn: { paddingVertical: 4 },
  backText: { fontSize: 16, color: THEME.accent, fontWeight: "700" },
  headerTitle: { fontSize: 17, fontWeight: "800", color: THEME.ink },
  headerRight: { minWidth: 72, alignItems: "flex-end" },
  headerLink: { fontSize: 14, fontWeight: "800", color: THEME.accent },
  sub: {
    fontSize: 12,
    color: THEME.inkMuted,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  error: {
    color: "#C0392B",
    paddingHorizontal: 20,
    marginBottom: 8,
    fontSize: 13,
  },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
  card: {
    backgroundColor: THEME.paper,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  cardTitle: { fontSize: 16, fontWeight: "800", color: THEME.ink },
  cardMeta: { fontSize: 11, color: THEME.inkMuted, marginTop: 4 },
  cardUrl: { fontSize: 11, color: "#2980B9", marginTop: 6 },
  summary: {
    fontSize: 14,
    color: THEME.ink,
    lineHeight: 22,
    marginTop: 10,
  },
  expandHint: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: "700",
    color: THEME.accent,
  },
  snippet: {
    marginTop: 8,
    fontSize: 12,
    color: THEME.inkMuted,
    lineHeight: 18,
  },
  empty: {
    textAlign: "center",
    color: THEME.inkMuted,
    marginTop: 40,
    paddingHorizontal: 24,
    lineHeight: 20,
    fontSize: 14,
  },
});
