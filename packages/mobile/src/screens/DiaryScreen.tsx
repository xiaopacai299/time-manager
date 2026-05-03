import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTopInset } from "../hooks/useScreenInsets";
import { useAuth } from "../hooks/useAuth";
import type { RootStackParamList } from "../navigation/RootNavigator";
import type { DiaryPayload } from "@time-manger/shared";
import { SwipeableDeleteRow } from "../components/SwipeableDeleteRow";

type Props = NativeStackScreenProps<RootStackParamList, "Diaries">;

const ACCENT = "#6B5B95";
/** 列表卡片固定高度（与两行正文 + 日期 + 内边距匹配） */
const LIST_CARD_HEIGHT = 116;

export function DiaryScreen({ navigation }: Props) {
  const { auth } = useAuth();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<DiaryPayload[]>([]);
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

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const handleDelete = useCallback(
    (item: DiaryPayload, closeSwipe?: () => void) => {
      if (auth.status !== "authenticated") return;
      Alert.alert("删除日记", "确定删除这条日记吗？", [
        { text: "取消", style: "cancel", onPress: () => closeSwipe?.() },
        {
          text: "删除",
          style: "destructive",
          onPress: () => {
            closeSwipe?.();
            void (async () => {
              setLoading(true);
              setError(null);
              try {
                await auth.client.deleteDiary(item.id);
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
    [auth, load]
  );

  const refreshing = loading;
  const topInset = useTopInset();

  const openNew = () => {
    navigation.navigate("DiaryCompose", {});
  };

  const openEdit = (item: DiaryPayload) => {
    navigation.navigate("DiaryCompose", {
      diaryId: item.id,
      initialDate: item.date,
      initialContent: item.content,
    });
  };

  return (
    <View style={[styles.flex, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
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

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: 100 + insets.bottom }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load()}
            tintColor={ACCENT}
            colors={[ACCENT]}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            {refreshing ? (
              <ActivityIndicator color={ACCENT} />
            ) : (
              <Text style={styles.emptyText}>暂无日记</Text>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <SwipeableDeleteRow onDeleteRequest={(closeSwipe) => handleDelete(item, closeSwipe)}>
            <View style={styles.card}>
              <TouchableOpacity style={styles.row} onPress={() => openEdit(item)} activeOpacity={0.75}>
                <Text style={styles.itemIcon}>✍️</Text>
                <View style={styles.itemBody}>
                  <Text style={styles.itemName} numberOfLines={1} ellipsizeMode="tail">
                    {item.date}
                  </Text>
                  <Text style={styles.note} numberOfLines={2} ellipsizeMode="tail">
                    {item.content}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </SwipeableDeleteRow>
        )}
      />

      <TouchableOpacity
        style={[styles.fab, { bottom: 94 + insets.bottom, right: 20 }]}
        onPress={openNew}
        activeOpacity={0.9}
        accessibilityLabel="新增日记"
      >
        <Text style={styles.fabPlus}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#FAF8F5" },
  header: {
    height: 56,
    paddingHorizontal: 16,
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E8E4DE",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  back: { color: ACCENT, fontWeight: "700" },
  title: { fontSize: 18, fontWeight: "800", color: "#2D3436" },
  headerSpacer: { width: 32 },
  errorBanner: {
    backgroundColor: "#fff5f5",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#feb2b2",
  },
  errorText: { color: "#c53030", fontSize: 13 },
  list: { paddingHorizontal: 16, paddingTop: 16 },
  empty: { padding: 40, alignItems: "center" },
  emptyText: { color: "#888" },
  card: {
    height: LIST_CARD_HEIGHT,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    overflow: "hidden",
  },
  row: { flex: 1, flexDirection: "row", alignItems: "flex-start", minHeight: 0 },
  itemIcon: { fontSize: 22, marginRight: 10 },
  itemBody: { flex: 1, minWidth: 0, paddingRight: 6 },
  itemName: { fontSize: 16, fontWeight: "800", color: "#2D3436" },
  note: { color: "#636E72", marginTop: 4, fontSize: 14, lineHeight: 20 },
  fab: {
    position: "absolute",
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabPlus: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "300",
    marginTop: -2,
  },
});
