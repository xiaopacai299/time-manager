import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Dimensions,
} from "react-native";
import { useAuth } from "../hooks/useAuth";
import { useTopInset } from "../hooks/useScreenInsets";

const { width: SCREEN_W } = Dimensions.get("window");
const GRID_PAD = 20;
const GAP = 12;
const CARD_W = (SCREEN_W - GRID_PAD * 2 - GAP) / 2;

type Nav = {
  navigate: (screen: "Diaries" | "Worklist" | "AppStats" | "Memos") => void;
};

type Props = {
  navigation: Nav;
};

type QuoteState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; content: string; author: string }
  | { status: "empty" }
  | { status: "error"; message: string };

const THEME = {
  bg: "#F5F0E8",
  paper: "#FDFCF9",
  ink: "#2C3E50",
  inkMuted: "#7F8C8D",
  accent: "#6B5B95",
  accentSoft: "rgba(107, 91, 149, 0.12)",
  quoteBg: "#3D4F5F",
  quoteText: "#F5F0E8",
  gold: "#C9A227",
  cardShadow: "#2D3436",
};

function FeatureCard({
  icon,
  title,
  subtitle,
  tint,
  onPress,
}: {
  icon: string;
  title: string;
  subtitle: string;
  tint: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.featureCard, { width: CARD_W }]}
      onPress={onPress}
      activeOpacity={0.88}
    >
      <View style={[styles.iconRing, { backgroundColor: `${tint}18` }]}>
        <Text style={styles.cardIcon}>{icon}</Text>
      </View>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardSub} numberOfLines={2}>
        {subtitle}
      </Text>
    </TouchableOpacity>
  );
}

export function HomeScreen({ navigation }: Props) {
  const { auth, logout } = useAuth();
  const [quote, setQuote] = useState<QuoteState>({ status: "idle" });
  const [refreshing, setRefreshing] = useState(false);
  const topInset = useTopInset();

  const loadQuote = useCallback(async () => {
    if (auth.status !== "authenticated") return;
    setQuote((q) => (q.status === "loading" ? q : { status: "loading" }));
    try {
      const { quote: q } = await auth.client.getFeaturedQuote();
      if (q?.content?.trim()) {
        setQuote({
          status: "ok",
          content: q.content.trim(),
          author: (q.author || "").trim(),
        });
      } else {
        setQuote({ status: "empty" });
      }
    } catch (e) {
      setQuote({
        status: "error",
        message: e instanceof Error ? e.message : "加载失败",
      });
    }
  }, [auth]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadQuote();
    } finally {
      setRefreshing(false);
    }
  }, [loadQuote]);

  useEffect(() => {
    void loadQuote();
  }, [loadQuote]);

  const handleLogout = useCallback(() => {
    Alert.alert("登出", "确定要退出登录吗？", [
      { text: "取消", style: "cancel" },
      { text: "登出", style: "destructive", onPress: () => void logout() },
    ]);
  }, [logout]);

  const user = auth.status === "authenticated" ? auth.user : null;

  return (
    <View style={[styles.root, { paddingTop: topInset }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={THEME.accent}
            colors={[THEME.accent]}
          />
        }
      >
        {/* 第一行：用户 + 登出 */}
        <View style={styles.userRow}>
          <View style={styles.userTextWrap}>
            <Text style={styles.greeting}>欢迎回来</Text>
            <Text style={styles.email} numberOfLines={1} ellipsizeMode="middle">
              {user?.email ?? "—"}
            </Text>
          </View>
          <TouchableOpacity style={styles.logoutPill} onPress={handleLogout} activeOpacity={0.85}>
            <Text style={styles.logoutPillText}>退出</Text>
          </TouchableOpacity>
        </View>

        {/* 第二行：名言（与桌面同源 /api/v1/quotes/featured） */}
        <View style={styles.quoteSection}>
          <View style={styles.quoteLabelRow}>
            <View style={styles.quoteLabelDot} />
            <Text style={styles.quoteLabel}>今日一言</Text>
          </View>
          <View style={styles.quoteCard}>
            {quote.status === "loading" || quote.status === "idle" ? (
              <View style={styles.quoteLoading}>
                <ActivityIndicator color={THEME.quoteText} size="small" />
                <Text style={[styles.quoteLoadingText, { marginLeft: 10 }]}>采撷一句智慧…</Text>
              </View>
            ) : quote.status === "ok" ? (
              <>
                <Text style={styles.quoteMark}>“</Text>
                <Text style={styles.quoteContent}>{quote.content}</Text>
                {quote.author ? (
                  <Text style={styles.quoteAuthor}>— {quote.author}</Text>
                ) : null}
              </>
            ) : quote.status === "empty" ? (
              <Text style={styles.quoteEmpty}>暂无可用的名言，请稍后在服务端配置工作名言库。</Text>
            ) : (
              <Text style={styles.quoteError}>{quote.message}</Text>
            )}
          </View>
        </View>

        {/* 第三行起：功能网格 */}
        <Text style={styles.gridSectionTitle}>功能</Text>
        <View style={styles.grid}>
          <FeatureCard
            icon="📋"
            title="工作清单"
            subtitle="任务与待办"
            tint={THEME.accent}
            onPress={() => navigation.navigate("Worklist")}
          />
          <FeatureCard
            icon="📊"
            title="应用统计"
            subtitle="今日各应用时长"
            tint="#2980B9"
            onPress={() => navigation.navigate("AppStats")}
          />
          <FeatureCard
            icon="✍️"
            title="写日记"
            subtitle="记录心情与思考"
            tint="#E17055"
            onPress={() => navigation.navigate("Diaries")}
          />
          <FeatureCard
            icon="🗒️"
            title="便签"
            subtitle="快速随手记"
            tint={THEME.gold}
            onPress={() => navigation.navigate("Memos")}
          />
        </View>

        <View style={styles.footerSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: THEME.bg },
  scrollContent: { paddingBottom: 32 },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: GRID_PAD,
    paddingTop: 8,
    paddingBottom: 20,
  },
  userTextWrap: { flex: 1, marginRight: 12 },
  greeting: {
    fontSize: 12,
    color: THEME.inkMuted,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    fontWeight: "600",
  },
  email: {
    fontSize: 17,
    fontWeight: "700",
    color: THEME.ink,
    marginTop: 4,
  },
  logoutPill: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: THEME.paper,
    borderWidth: 1,
    borderColor: "#E0D8CD",
    shadowColor: THEME.cardShadow,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  logoutPillText: { color: "#C0392B", fontWeight: "800", fontSize: 14 },
  quoteSection: { paddingHorizontal: GRID_PAD, marginBottom: 8 },
  quoteLabelRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  quoteLabelDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME.gold,
    marginRight: 8,
  },
  quoteLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: THEME.inkMuted,
    letterSpacing: 2,
  },
  quoteCard: {
    backgroundColor: THEME.quoteBg,
    borderRadius: 20,
    padding: 22,
    minHeight: 120,
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  quoteMark: {
    position: "absolute",
    top: 12,
    left: 16,
    fontSize: 48,
    color: "rgba(255,255,255,0.12)",
    fontWeight: "300",
    lineHeight: 48,
  },
  quoteContent: {
    fontSize: 16,
    lineHeight: 26,
    color: THEME.quoteText,
    fontWeight: "500",
    letterSpacing: 0.3,
  },
  quoteAuthor: {
    marginTop: 14,
    fontSize: 13,
    color: "rgba(245,240,232,0.7)",
    textAlign: "right",
    fontStyle: "italic",
  },
  quoteLoading: { flexDirection: "row", alignItems: "center", gap: 10 },
  quoteLoadingText: { color: "rgba(245,240,232,0.7)", fontSize: 14 },
  quoteEmpty: { color: "rgba(245,240,232,0.75)", fontSize: 14, lineHeight: 22 },
  quoteError: { color: "#F8C4C4", fontSize: 14, lineHeight: 20 },
  gridSectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: THEME.ink,
    paddingHorizontal: GRID_PAD,
    marginTop: 20,
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: GRID_PAD,
    justifyContent: "space-between",
  },
  featureCard: {
    backgroundColor: THEME.paper,
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 14,
    marginBottom: GAP,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.04)",
    shadowColor: THEME.cardShadow,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  iconRing: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  cardIcon: { fontSize: 24 },
  cardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: THEME.ink,
    marginBottom: 6,
  },
  cardSub: {
    fontSize: 12,
    color: THEME.inkMuted,
    lineHeight: 17,
  },
  footerSpacer: { height: 24 },
});
