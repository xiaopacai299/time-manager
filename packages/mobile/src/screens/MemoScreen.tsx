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
import { useAuth } from "../hooks/useAuth";
import { useTopInset } from "../hooks/useScreenInsets";
import type { MemoItemPayload } from "@time-manger/shared";

type Props = {
  navigation: { goBack: () => void };
};

export function MemoScreen({ navigation }: Props) {
  const { auth } = useAuth();
  const [items, setItems] = useState<MemoItemPayload[]>([]);
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [editing, setEditing] = useState<MemoItemPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const topInset = useTopInset();

  const load = useCallback(async () => {
    if (auth.status !== "authenticated") return;
    setLoading(true);
    setError(null);
    try {
      const { items: rows } = await auth.client.listMemoItems();
      setItems(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [auth]);

  useEffect(() => {
    void load();
  }, [load]);

  const resetForm = () => {
    setName("");
    setContent("");
    setEditing(null);
  };

  const handleSave = useCallback(async () => {
    if (auth.status !== "authenticated") return;
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setLoading(true);
    setError(null);
    try {
      if (editing) {
        await auth.client.updateMemoItem(editing.id, {
          name: trimmedName,
          content: content.trim(),
          icon: editing.icon,
        });
      } else {
        await auth.client.createMemoItem({
          name: trimmedName,
          content: content.trim(),
        });
      }
      resetForm();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setLoading(false);
    }
  }, [auth, content, editing, load, name]);

  const handleDelete = useCallback(
    (item: MemoItemPayload) => {
      if (auth.status !== "authenticated") return;
      Alert.alert("删除便签", "确定删除这条便签吗？", [
        { text: "取消", style: "cancel" },
        {
          text: "删除",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setLoading(true);
              try {
                await auth.client.deleteMemoItem(item.id);
                if (editing?.id === item.id) resetForm();
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

  return (
    <View style={[styles.root, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={navigation.goBack} hitSlop={12}>
          <Text style={styles.back}>返回</Text>
        </TouchableOpacity>
        <Text style={styles.title}>便签</Text>
        <View style={styles.headerSpacer} />
      </View>

      {error ? (
        <View style={styles.errBanner}>
          <Text style={styles.errText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.editor}>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="标题"
          placeholderTextColor="#B2BEC3"
        />
        <TextInput
          style={[styles.input, styles.bodyInput]}
          value={content}
          onChangeText={setContent}
          placeholder="随手记下想法…"
          placeholderTextColor="#B2BEC3"
          multiline
        />
        <TouchableOpacity style={styles.primaryBtn} onPress={() => void handleSave()}>
          <Text style={styles.primaryBtnText}>{editing ? "保存" : "新建便签"}</Text>
        </TouchableOpacity>
        {editing ? (
          <TouchableOpacity style={styles.secondaryBtn} onPress={resetForm}>
            <Text style={styles.secondaryBtnText}>取消编辑</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            {loading ? <ActivityIndicator color="#6B5B95" /> : <Text style={styles.emptyText}>暂无便签</Text>}
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.85}
            onPress={() => {
              setEditing(item);
              setName(item.name);
              setContent(item.content);
            }}
          >
            <View style={styles.cardTop}>
              <Text style={styles.cardIcon}>{item.icon || "📝"}</Text>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {item.name}
              </Text>
            </View>
            {item.content ? (
              <Text style={styles.cardBody} numberOfLines={4}>
                {item.content}
              </Text>
            ) : null}
            <TouchableOpacity
              style={styles.delBtn}
              onPress={() => handleDelete(item)}
              hitSlop={8}
            >
              <Text style={styles.delText}>删除</Text>
            </TouchableOpacity>
          </TouchableOpacity>
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
  editor: {
    padding: 18,
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E8E4DE",
  },
  input: {
    borderWidth: 1,
    borderColor: "#DFD8CF",
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: "#2D3436",
    marginBottom: 10,
  },
  bodyInput: { minHeight: 100, textAlignVertical: "top" },
  primaryBtn: {
    backgroundColor: "#6B5B95",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  secondaryBtn: { marginTop: 10, alignItems: "center" },
  secondaryBtnText: { color: "#636E72", fontWeight: "600" },
  list: { padding: 18, paddingBottom: 40 },
  empty: { paddingVertical: 40, alignItems: "center" },
  emptyText: { color: "#95A5A6" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#2D3436",
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: "#D4A574",
  },
  cardTop: { flexDirection: "row", alignItems: "flex-start" },
  cardIcon: { fontSize: 22, marginRight: 10 },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: "800", color: "#2D3436" },
  cardBody: { marginTop: 10, fontSize: 14, color: "#636E72", lineHeight: 21 },
  delBtn: { alignSelf: "flex-end", marginTop: 10 },
  delText: { color: "#E17055", fontWeight: "700", fontSize: 13 },
});
