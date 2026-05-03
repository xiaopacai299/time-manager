import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../hooks/useAuth";
import { useTopInset } from "../hooks/useScreenInsets";

const DEFAULT_API_BASE = "http://10.0.2.2:3000";
const { width: W } = Dimensions.get("window");

const ACCENT = "#6B5B95";
const INK = "#2C3E50";
const INK_MUTED = "#7F8C8D";
const BG = "#E8E2DA";
const PAPER = "#FDFCF9";
const GOLD = "#C9A227";

export function LoginScreen() {
  const { login } = useAuth();
  const insets = useSafeAreaInsets();
  const [apiBase, setApiBase] = useState(DEFAULT_API_BASE);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError("请填写邮箱和密码");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await login(apiBase.trim(), email.trim().toLowerCase(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : "登录失败");
    } finally {
      setLoading(false);
    }
  };

  const topInset = useTopInset();

  return (
    <View style={styles.root}>
      <View style={[styles.blobTop, { right: -W * 0.22 }]} pointerEvents="none" />
      <View style={[styles.blobMid, { left: -W * 0.35 }]} pointerEvents="none" />
      <View style={[styles.blobGold, { right: W * 0.08, bottom: "18%" }]} pointerEvents="none" />

      <KeyboardAvoidingView
        style={styles.flexInner}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: topInset + 8, paddingBottom: 28 + insets.bottom },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <Text style={styles.kicker}>时间与专注</Text>
            <Text style={styles.brandMark}>Time Manager</Text>
            <View style={styles.ruleRow}>
              <View style={styles.ruleLine} />
              <Text style={styles.ruleDot}>◆</Text>
              <View style={styles.ruleLine} />
            </View>
            <Text style={styles.tagline}>登录你的账号，同步记录与清单</Text>
          </View>

          <View style={styles.paper}>
            <Text style={styles.sectionEyebrow}>连接</Text>
            <Text style={styles.label}>服务器地址</Text>
            <TextInput
              style={styles.input}
              value={apiBase}
              onChangeText={setApiBase}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="http://10.0.2.2:3000"
              placeholderTextColor="#B2A99A"
            />
            <View style={styles.hintBox}>
              <Text style={styles.hint}>
                填 Node 后端地址（默认端口 3000）。不要填 8081——那是 Expo Metro。真机用电脑局域网 IP、同一
                Wi-Fi；模拟器可用 10.0.2.2；不要用 localhost。
              </Text>
            </View>

            <Text style={[styles.sectionEyebrow, styles.sectionEyebrowSpaced]}>账号</Text>
            <Text style={styles.label}>邮箱</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="you@example.com"
              placeholderTextColor="#B2A99A"
            />

            <Text style={styles.label}>密码</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor="#B2A99A"
            />

            {error ? (
              <View style={styles.errorPill}>
                <Text style={styles.error}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.88}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>登录</Text>
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.footerNote}>本地数据经加密存储 · 与桌面端同一套同步协议</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  blobTop: {
    position: "absolute",
    top: -120,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "rgba(107, 91, 149, 0.09)",
  },
  blobMid: {
    position: "absolute",
    top: "32%",
    width: 420,
    height: 420,
    borderRadius: 210,
    backgroundColor: "rgba(61, 79, 95, 0.06)",
  },
  blobGold: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(201, 162, 39, 0.12)",
  },
  flexInner: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 22,
    justifyContent: "center",
  },
  hero: {
    alignItems: "center",
    marginBottom: 26,
  },
  kicker: {
    fontSize: 11,
    fontWeight: "800",
    color: ACCENT,
    letterSpacing: 5,
    marginBottom: 14,
  },
  brandMark: {
    fontSize: 30,
    fontWeight: "200",
    color: INK,
    letterSpacing: 2,
  },
  ruleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 12,
    gap: 12,
    maxWidth: 260,
  },
  ruleLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(44, 62, 80, 0.2)",
  },
  ruleDot: {
    fontSize: 8,
    color: GOLD,
    opacity: 0.85,
  },
  tagline: {
    fontSize: 14,
    color: INK_MUTED,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 12,
  },
  paper: {
    backgroundColor: PAPER,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.95)",
    shadowColor: "#2C3E50",
    shadowOpacity: 0.07,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 3,
  },
  sectionEyebrow: {
    fontSize: 10,
    fontWeight: "800",
    color: INK_MUTED,
    letterSpacing: 3,
    marginBottom: 10,
  },
  sectionEyebrowSpaced: {
    marginTop: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#636E72",
    marginBottom: 8,
    marginTop: 4,
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#DFD8CF",
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: INK,
  },
  hintBox: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderLeftWidth: 3,
    borderLeftColor: ACCENT,
    backgroundColor: "rgba(107, 91, 149, 0.06)",
    borderRadius: 0,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
  },
  hint: {
    fontSize: 12,
    color: INK_MUTED,
    lineHeight: 18,
  },
  errorPill: {
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "rgba(229, 62, 62, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(229, 62, 62, 0.2)",
  },
  error: {
    color: "#C53030",
    textAlign: "center",
    fontSize: 14,
    fontWeight: "600",
  },
  button: {
    marginTop: 22,
    backgroundColor: ACCENT,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: ACCENT,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  buttonDisabled: { opacity: 0.65 },
  buttonText: { color: "#fff", fontWeight: "800", fontSize: 17, letterSpacing: 1 },
  footerNote: {
    marginTop: 22,
    textAlign: "center",
    fontSize: 11,
    color: INK_MUTED,
    letterSpacing: 0.5,
    lineHeight: 17,
    opacity: 0.85,
  },
});
