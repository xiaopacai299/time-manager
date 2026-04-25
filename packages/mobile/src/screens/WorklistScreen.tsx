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
import type { WorklistItemPayload } from "@time-manger/shared";
import { useSync } from "../sync/SyncProvider";
import {
  deleteWorklistItem,
  fetchWorklistItems,
  saveWorklistItem,
} from "../storage/worklistQueries";

type Props = {
  navigation: { goBack: () => void };
};

export function WorklistScreen({ navigation }: Props) {
  const { triggerSync, status, syncTick } = useSync();
  const [items, setItems] = useState<WorklistItemPayload[]>([]);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState<WorklistItemPayload | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await fetchWorklistItems());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, syncTick]);

  const resetForm = () => {
    setName("");
    setNote("");
    setEditing(null);
  };

  const handleSave = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await saveWorklistItem({
      id: editing?.id,
      name: trimmed,
      icon: editing?.icon ?? "📋",
      note: note.trim(),
      reminderAt: editing?.reminderAt,
      estimateDoneAt: editing?.estimateDoneAt,
      createdAt: editing?.createdAt,
      reminderNotified: editing?.reminderNotified,
      completionResult: editing?.completionResult,
      confirmSnoozeUntil: editing?.confirmSnoozeUntil,
    });
    resetForm();
    await triggerSync();
    await load();
  }, [editing, load, name, note, triggerSync]);

  const toggleDone = useCallback(
    async (item: WorklistItemPayload) => {
      const done = item.completionResult === "completed";
      await saveWorklistItem({
        ...item,
        completionResult: done ? "" : "completed",
        confirmSnoozeUntil: new Date().toISOString(),
      });
      await triggerSync();
      await load();
    },
    [load, triggerSync]
  );

  const handleDelete = useCallback(
    (item: WorklistItemPayload) => {
      Alert.alert("删除工作清单", "确定删除这个任务吗？", [
        { text: "取消", style: "cancel" },
        {
          text: "删除",
          style: "destructive",
          onPress: () => {
            void (async () => {
              await deleteWorklistItem(item.id);
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
        <Text style={styles.title}>工作清单</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.editor}>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="任务名称"
          placeholderTextColor="#aaa"
        />
        <TextInput
          style={[styles.input, styles.noteInput]}
          value={note}
          onChangeText={setNote}
          placeholder="备注"
          placeholderTextColor="#aaa"
          multiline
        />
        <TouchableOpacity style={styles.primaryButton} onPress={handleSave}>
          <Text style={styles.primaryButtonText}>{editing ? "保存修改" : "新增任务"}</Text>
        </TouchableOpacity>
        {editing ? (
          <TouchableOpacity style={styles.secondaryButton} onPress={resetForm}>
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
              <Text style={styles.emptyText}>暂无工作清单</Text>
            )}
          </View>
        }
        renderItem={({ item }) => {
          const done = item.completionResult === "completed";
          return (
            <View style={styles.card}>
              <TouchableOpacity onPress={() => void toggleDone(item)} style={styles.row}>
                <Text style={styles.icon}>{item.icon || "📋"}</Text>
                <View style={styles.itemBody}>
                  <Text style={[styles.itemName, done && styles.doneText]}>{item.name}</Text>
                  {item.note ? <Text style={styles.note}>{item.note}</Text> : null}
                </View>
                <Text style={done ? styles.doneBadge : styles.todoBadge}>
                  {done ? "已完成" : "待办"}
                </Text>
              </TouchableOpacity>
              <View style={styles.actions}>
                <TouchableOpacity
                  onPress={() => {
                    setEditing(item);
                    setName(item.name);
                    setNote(item.note);
                  }}
                >
                  <Text style={styles.actionText}>编辑</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item)}>
                  <Text style={styles.deleteText}>删除</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
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
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    color: "#1a1a1a",
    marginBottom: 10,
  },
  noteInput: { minHeight: 72, textAlignVertical: "top" },
  primaryButton: { backgroundColor: "#4f46e5", borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  primaryButtonText: { color: "#fff", fontWeight: "800" },
  secondaryButton: { marginTop: 8, alignItems: "center" },
  secondaryButtonText: { color: "#666", fontWeight: "700" },
  list: { padding: 16, paddingBottom: 32 },
  empty: { padding: 40, alignItems: "center" },
  emptyText: { color: "#888" },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 10 },
  row: { flexDirection: "row", alignItems: "center" },
  icon: { fontSize: 22, marginRight: 10 },
  itemBody: { flex: 1 },
  itemName: { fontSize: 16, fontWeight: "800", color: "#1a1a1a" },
  doneText: { color: "#999", textDecorationLine: "line-through" },
  note: { color: "#777", marginTop: 4 },
  todoBadge: { color: "#4f46e5", fontWeight: "800" },
  doneBadge: { color: "#16a34a", fontWeight: "800" },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 18, marginTop: 12 },
  actionText: { color: "#4f46e5", fontWeight: "700" },
  deleteText: { color: "#e53e3e", fontWeight: "700" },
});
