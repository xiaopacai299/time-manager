import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useTopInset } from "../hooks/useScreenInsets";
import { useAuth } from "../hooks/useAuth";
import type { DiaryPayload } from "@time-manger/shared";

type Props = {
  navigation: { goBack: () => void };
};

export function DiaryScreen({ navigation }: Props) {
  const { auth } = useAuth();
  const [items, setItems] = useState<DiaryPayload[]>([]);
  const [content, setContent] = useState("");
  const [editing, setEditing] = useState<DiaryPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (auth.status !== "authenticated") return;
    setLoading(true);
    setError(null);
    try {
      const { diaries } = await auth.client.listDiaries();
      setItems(diaries);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [auth]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = useCallback(async () => {
    if (auth.status !== "authenticated") return;
    const trimmed = content.trim();
    if (!trimmed) return;
    const date = new Date().toISOString().slice(0, 10);
    setLoading(true);
    setError(null);
    try {
      if (editing) {
        await auth.client.updateDiary(editing.id, {
          date: editing.date,
          content: trimmed,
        });
      } else {
        await auth.client.createDiary({ date, content: trimmed });
      }
      setContent("");
      setEditing(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setLoading(false);
    }
  }, [auth, content, editing, load]);

  const handleDelete = useCallback(
    (item: DiaryPayload) => {
      if (auth.status !== "authenticated") return;
      Alert.alert("删除日记", "确定删除这条日记吗？", [
        { text: "取消", style: "cancel" },
        {
          text: "删除",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setLoading(true);
              setError(null);
              try {
                await auth.client.deleteDiary(item.id);
                if (editing?.id === item.id) {
                  setEditing(null);
                  setContent("");
                }
                await load();
              } catch (e) {
                setError(e instanceof Error ? e.message : "删除失败");
              } finally {
                setLoading(false);
              }
            })();
          },
        },
      ]);
    },
    [auth, editing, load]
  );

  const refreshing = loading;
  const topInset = useTopInset();

  return (
    <View style={[styles.flex, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={navigation.goBack}>
          <Text style={styles.back}>返回</Text>
        </TouchableOpacity>
        <Text style={styles.title}>日记</Text>
        <View style={styles.headerSpacer} />
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.editor}>
        <TextInput
          style={styles.input}
          value={content}
          onChangeText={setContent}
          placeholder="写下今天的日记..."
          placeholderTextColor="#aaa"
          multiline
        />
        <TouchableOpacity style={styles.primaryButton} onPress={() => void handleSave()}>
          <Text style={styles.primaryButtonText}>{editing ? "保存修改" : "新增日记"}</Text>
        </TouchableOpacity>
        {editing ? (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => {
              setEditing(null);
              setContent("");
            }}
          >
            <Text style={styles.secondaryButtonText}>取消编辑</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void load()} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            {refreshing ? (
              <ActivityIndicator color="#4f46e5" />
            ) : (
              <Text style={styles.emptyText}>暂无日记</Text>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.date}>{item.date}</Text>
            <Text style={styles.content}>{item.content}</Text>
            <View style={styles.actions}>
              <TouchableOpacity
                onPress={() => {
                  setEditing(item);
                  setContent(item.content);
                }}
              >
                <Text style={styles.actionText}>编辑</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(item)}>
                <Text style={styles.deleteText}>删除</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#f5f5f5" },
  header: {
    height: 56,
    paddingHorizontal: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  back: { color: "#4f46e5", fontWeight: "700" },
  title: { fontSize: 18, fontWeight: "800", color: "#1a1a1a" },
  headerSpacer: { width: 32 },
  errorBanner: {
    backgroundColor: "#fff5f5",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#feb2b2",
  },
  errorText: { color: "#c53030", fontSize: 13 },
  editor: { padding: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#eee" },
  input: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    color: "#1a1a1a",
    textAlignVertical: "top",
  },
  primaryButton: { marginTop: 12, backgroundColor: "#4f46e5", borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  primaryButtonText: { color: "#fff", fontWeight: "800" },
  secondaryButton: { marginTop: 8, alignItems: "center" },
  secondaryButtonText: { color: "#666", fontWeight: "700" },
  list: { padding: 16, paddingBottom: 32 },
  empty: { padding: 40, alignItems: "center" },
  emptyText: { color: "#888" },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 10 },
  date: { color: "#4f46e5", fontWeight: "800", marginBottom: 8 },
  content: { color: "#333", lineHeight: 20 },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 18, marginTop: 12 },
  actionText: { color: "#4f46e5", fontWeight: "700" },
  deleteText: { color: "#e53e3e", fontWeight: "700" },
});
