import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../hooks/useAuth";
import { useTopInset } from "../hooks/useScreenInsets";

type Row = {
  id: string;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

type Props = {
  navigation: { goBack: () => void };
};

const THEME = {
  bg: "#F5F0E8",
  paper: "#FDFCF9",
  ink: "#2C3E50",
  inkMuted: "#7F8C8D",
  accent: "#6B5B95",
};

export function ExtensionTokensScreen({ navigation }: Props) {
  const { auth } = useAuth();
  const [tokens, setTokens] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTokenPlain, setNewTokenPlain] = useState<string | null>(null);
  const topInset = useTopInset();

  const load = useCallback(async () => {
    if (auth.status !== "authenticated") return;
    setLoading(true);
    try {
      const { tokens: rows } = await auth.client.listExtensionUploadTokens();
      setTokens(rows);
    } catch (e) {
      Alert.alert("加载失败", e instanceof Error ? e.message : "未知错误");
    } finally {
      setLoading(false);
    }
  }, [auth]);

  useEffect(() => {
    void load();
  }, [load]);

  const onCreate = useCallback(async () => {
    if (auth.status !== "authenticated") return;
    setCreating(true);
    try {
      const res = await auth.client.createExtensionUploadToken({ label: "Chrome" });
      setNewTokenPlain(res.token);
      await load();
    } catch (e) {
      Alert.alert("创建失败", e instanceof Error ? e.message : "未知错误");
    } finally {
      setCreating(false);
    }
  }, [auth, load]);

  const onRevoke = useCallback(
    (row: Row) => {
      if (auth.status !== "authenticated") return;
      Alert.alert("吊销密钥", "吊销后 Chrome 扩展需更换为新密钥。", [
        { text: "取消", style: "cancel" },
        {
          text: "吊销",
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                await auth.client.revokeExtensionUploadToken(row.id);
                await load();
              } catch (e) {
                Alert.alert("失败", e instanceof Error ? e.message : "未知错误");
              }
            })();
          },
        },
      ]);
    },
    [auth, load]
  );

  return (
    <View style={[styles.root, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={styles.back}>← 返回</Text>
        </TouchableOpacity>
        <Text style={styles.title}>扩展上传密钥</Text>
        <View style={{ width: 56 }} />
      </View>
      <Text style={styles.sub}>用于 Chrome 扩展上传到账号；请在扩展选项粘贴「tmext_…」整条密钥。</Text>

      <TouchableOpacity
        style={[styles.primaryBtn, creating && styles.btnDisabled]}
        disabled={creating}
        onPress={() => void onCreate()}
      >
        {creating ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryBtnText}>生成新密钥</Text>
        )}
      </TouchableOpacity>

      {loading && tokens.length === 0 ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={THEME.accent} />
      ) : (
        <FlatList
          style={{ marginTop: 16 }}
          data={tokens}
          keyExtractor={(x) => x.id}
          refreshing={loading}
          onRefresh={() => void load()}
          ListEmptyComponent={<Text style={styles.empty}>暂无密钥记录</Text>}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.rowTitle}>{item.label?.trim() || "（未命名）"}</Text>
              <Text style={styles.rowMeta}>创建于 {new Date(item.createdAt).toLocaleString()}</Text>
              {item.lastUsedAt ? (
                <Text style={styles.rowMeta}>最近使用 {new Date(item.lastUsedAt).toLocaleString()}</Text>
              ) : null}
              <Text style={[styles.rowMeta, item.revokedAt ? styles.revoked : styles.active]}>
                {item.revokedAt ? `已吊销 ${new Date(item.revokedAt).toLocaleString()}` : "有效"}
              </Text>
              {!item.revokedAt ? (
                <TouchableOpacity onPress={() => onRevoke(item)} style={styles.revokeHit}>
                  <Text style={styles.revokeText}>吊销</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}
        />
      )}

      <Modal visible={!!newTokenPlain} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>请立即复制密钥</Text>
            <Text style={styles.modalHint}>只在本次显示一次，关闭后无法找回。</Text>
            <Text selectable style={styles.modalToken}>
              {newTokenPlain ?? ""}
            </Text>
            <TouchableOpacity style={styles.modalBtn} onPress={() => setNewTokenPlain(null)}>
              <Text style={styles.modalBtnText}>我已保存</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: THEME.bg, paddingHorizontal: 16 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  back: { fontSize: 16, color: THEME.accent, fontWeight: "700" },
  title: { fontSize: 17, fontWeight: "800", color: THEME.ink },
  sub: { fontSize: 12, color: THEME.inkMuted, lineHeight: 18, marginBottom: 12 },
  primaryBtn: {
    backgroundColor: THEME.accent,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.7 },
  primaryBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  empty: { textAlign: "center", color: THEME.inkMuted, marginTop: 24 },
  row: {
    backgroundColor: THEME.paper,
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  rowTitle: { fontWeight: "800", color: THEME.ink, fontSize: 15 },
  rowMeta: { fontSize: 12, color: THEME.inkMuted, marginTop: 4 },
  active: { color: "#16A085", fontWeight: "700" },
  revoked: { color: THEME.inkMuted },
  revokeHit: { alignSelf: "flex-start", marginTop: 10 },
  revokeText: { color: "#C0392B", fontWeight: "800", fontSize: 14 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: THEME.paper,
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: "800", color: THEME.ink },
  modalHint: { fontSize: 13, color: THEME.inkMuted, marginTop: 8 },
  modalToken: {
    marginTop: 14,
    fontSize: 13,
    color: "#1e293b",
    lineHeight: 20,
    fontFamily: "monospace",
  },
  modalBtn: {
    marginTop: 18,
    backgroundColor: THEME.accent,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  modalBtnText: { color: "#fff", fontWeight: "800" },
});
