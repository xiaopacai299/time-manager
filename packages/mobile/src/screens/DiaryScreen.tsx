import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import type { DiaryPayload } from "@time-manger/shared";
import { useSync } from "../sync/SyncProvider";
import { deleteDiary, fetchDiaries, saveDiary } from "../storage/diaryQueries";

type Props = {
  navigation: { goBack: () => void };
};

export function DiaryScreen({ navigation }: Props) {
  const { triggerSync, status, syncTick } = useSync();
  const [items, setItems] = useState<DiaryPayload[]>([]);
  const [content, setContent] = useState("");
  const [editing, setEditing] = useState<DiaryPayload | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await fetchDiaries());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, syncTick]);

  const handleSave = useCallback(async () => {
    const trimmed = content.trim();
    if (!trimmed) return;
    const date = new Date().toISOString().slice(0, 10);
    await saveDiary({
      id: editing?.id,
      date: editing?.date ?? date,
      content: trimmed,
      createdAt: editing?.createdAt,
    });
    setContent("");
    setEditing(null);
    await triggerSync();
    await load();
  }, [content, editing, load, triggerSync]);

  const handleDelete = useCallback(
    (item: DiaryPayload) => {
      Alert.alert("删除日记", "确定删除这条日记吗？", [
        { text: "取消", style: "cancel" },
        {
          text: "删除",
          style: "destructive",
          onPress: () => {
            void (async () => {
              await deleteDiary(item.id);
              await triggerSync();
              await load();
            })();
          },
        },
      ]);
    },
    [load, triggerSync]
  );

  const refreshing = loading || status === "syncing";

  return (
    <SafeAreaView style={styles.flex}>
      <View style={styles.header}>
        <TouchableOpacity onPress={navigation.goBack}>
          <Text style={styles.back}>返回</Text>
        </TouchableOpacity>
        <Text style={styles.title}>日记</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.editor}>
        <TextInput
          style={styles.input}
          value={content}
          onChangeText={setContent}
          placeholder="写下今天的日记..."
          placeholderTextColor="#aaa"
          multiline
        />
        <TouchableOpacity style={styles.primaryButton} onPress={handleSave}>
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void triggerSync()} />}
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
    </SafeAreaView>
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
