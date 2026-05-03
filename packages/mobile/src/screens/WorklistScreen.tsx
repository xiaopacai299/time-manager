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
  Modal,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  Pressable,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTopInset } from "../hooks/useScreenInsets";
import { useAuth } from "../hooks/useAuth";
import type { WorklistItemPayload } from "@time-manger/shared";
import { SwipeableDeleteRow } from "../components/SwipeableDeleteRow";

type Props = {
  navigation: { goBack: () => void };
};

const ACCENT = "#6B5B95";
/** 列表卡片固定高度（标题/备注各两行 + 元信息 + 内边距） */
const LIST_CARD_HEIGHT = 132;

/** 任务图标库（Emoji，存库仍为字符串，与桌面同步协议一致） */
const TASK_ICON_CHOICES = [
  "📋",
  "✅",
  "📌",
  "🎯",
  "💼",
  "📚",
  "🏃",
  "💡",
  "⭐",
  "🔔",
  "📝",
  "📅",
  "⏰",
  "🗓️",
  "✏️",
  "🎨",
  "💻",
  "☎️",
  "🏠",
  "⚡",
  "🔥",
  "🌟",
  "📎",
  "🛠️",
  "📊",
  "💬",
  "🎓",
  "✈️",
  "🛒",
  "🏋️",
] as const;

/** 仅调整时分秒，保留基准日期的年月日（新建用今天，编辑保留原记录日期）。 */
function applyPickerTime(baseDay: Date | null, picked: Date): Date {
  const target = baseDay ? new Date(baseDay) : new Date();
  target.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
  return target;
}

function formatScheduleLabel(d: Date | null): string {
  if (!d) return "";
  try {
    const today = new Date();
    const sameDay =
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate();
    const timeStr = d.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });
    if (sameDay) return `今日 ${timeStr}`;
    return `${d.getMonth() + 1}月${d.getDate()}日 ${timeStr}`;
  } catch {
    return d.toISOString();
  }
}

function completionUi(item: WorklistItemPayload): {
  label: string;
  variant: "todo" | "done" | "incomplete";
} {
  if (item.completionResult === "completed") {
    return { label: "已完成", variant: "done" };
  }
  if (item.completionResult === "incomplete") {
    return { label: "未完成", variant: "incomplete" };
  }
  return { label: "待办", variant: "todo" };
}

export function WorklistScreen({ navigation }: Props) {
  const { auth } = useAuth();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<WorklistItemPayload[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<WorklistItemPayload | null>(null);
  const [icon, setIcon] = useState("📋");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [reminderAt, setReminderAt] = useState<Date | null>(null);
  const [estimateDoneAt, setEstimateDoneAt] = useState<Date | null>(null);
  const [picker, setPicker] = useState<"none" | "reminder" | "estimate">("none");
  const [saving, setSaving] = useState(false);
  /** 图标库仅在点击当前图标后展开 */
  const [iconPickerVisible, setIconPickerVisible] = useState(false);

  const load = useCallback(async () => {
    if (auth.status !== "authenticated") return;
    setLoading(true);
    setError(null);
    try {
      const { items: rows } = await auth.client.listWorklistItems();
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
    setEditing(null);
    setIcon("📋");
    setName("");
    setNote("");
    setReminderAt(null);
    setEstimateDoneAt(null);
    setPicker("none");
    setIconPickerVisible(false);
  };

  const openNew = () => {
    resetForm();
    setModalOpen(true);
  };

  const openEdit = (item: WorklistItemPayload) => {
    setEditing(item);
    setIcon(item.icon || "📋");
    setName(item.name);
    setNote(item.note ?? "");
    setReminderAt(item.reminderAt ? new Date(item.reminderAt) : null);
    setEstimateDoneAt(item.estimateDoneAt ? new Date(item.estimateDoneAt) : null);
    setPicker("none");
    setIconPickerVisible(false);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setPicker("none");
    setIconPickerVisible(false);
  };

  const handleSaveModal = useCallback(async () => {
    if (auth.status !== "authenticated") return;
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert("提示", "请填写清单名称");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: trimmed,
        icon: icon.trim() || "📋",
        note: note.trim(),
        reminderAt: reminderAt ? reminderAt.toISOString() : null,
        estimateDoneAt: estimateDoneAt ? estimateDoneAt.toISOString() : null,
      };
      if (editing) {
        await auth.client.updateWorklistItem(editing.id, {
          ...payload,
          reminderNotified: editing.reminderNotified,
          completionResult: editing.completionResult,
          confirmSnoozeUntil: editing.confirmSnoozeUntil,
        });
      } else {
        await auth.client.createWorklistItem(payload);
      }
      closeModal();
      resetForm();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }, [
    auth,
    editing,
    estimateDoneAt,
    icon,
    load,
    name,
    note,
    reminderAt,
  ]);

  const handleDelete = useCallback(
    (item: WorklistItemPayload, closeSwipe?: () => void) => {
      if (auth.status !== "authenticated") return;
      Alert.alert("删除工作清单", "确定删除这个任务吗？", [
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
                await auth.client.deleteWorklistItem(item.id);
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

  return (
    <View style={[styles.flex, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={navigation.goBack} hitSlop={10}>
          <Text style={styles.back}>返回</Text>
        </TouchableOpacity>
        <Text style={styles.title}>工作清单</Text>
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
          <RefreshControl refreshing={refreshing} onRefresh={() => void load()} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            {refreshing ? (
              <ActivityIndicator color={ACCENT} />
            ) : (
              <Text style={styles.emptyText}>暂无工作清单</Text>
            )}
          </View>
        }
        renderItem={({ item }) => {
          const { label, variant } = completionUi(item);
          return (
            <SwipeableDeleteRow onDeleteRequest={(closeSwipe) => handleDelete(item, closeSwipe)}>
              <View style={styles.card}>
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => openEdit(item)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.itemIcon}>{item.icon || "📋"}</Text>
                  <View style={styles.itemBody}>
                    <Text style={styles.itemName} numberOfLines={2} ellipsizeMode="tail">
                      {item.name}
                    </Text>
                    {item.note ? (
                      <Text style={styles.note} numberOfLines={2} ellipsizeMode="tail">
                        {item.note}
                      </Text>
                    ) : null}
                    {item.reminderAt ? (
                      <Text style={styles.meta} numberOfLines={1} ellipsizeMode="tail">
                        提醒 {formatScheduleLabel(new Date(item.reminderAt))}
                      </Text>
                    ) : null}
                    {item.estimateDoneAt ? (
                      <Text style={styles.meta} numberOfLines={1} ellipsizeMode="tail">
                        预计完成 {formatScheduleLabel(new Date(item.estimateDoneAt))}
                      </Text>
                    ) : null}
                  </View>
                  <View
                    style={[
                      styles.statusPill,
                      variant === "done" && styles.statusPillDone,
                      variant === "todo" && styles.statusPillTodo,
                      variant === "incomplete" && styles.statusPillIncomplete,
                    ]}
                  >
                    <View
                      style={[
                        styles.statusDot,
                        variant === "done" && styles.statusDotDone,
                        variant === "todo" && styles.statusDotTodo,
                        variant === "incomplete" && styles.statusDotIncomplete,
                      ]}
                    />
                    <Text
                      style={[
                        styles.statusPillText,
                        variant === "done" && styles.statusPillTextDone,
                        variant === "todo" && styles.statusPillTextTodo,
                        variant === "incomplete" && styles.statusPillTextIncomplete,
                      ]}
                      numberOfLines={1}
                    >
                      {label}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </SwipeableDeleteRow>
          );
        }}
      />

      <TouchableOpacity
        style={[styles.fab, { bottom: 94 + insets.bottom, right: 20 }]}
        onPress={openNew}
        activeOpacity={0.9}
        accessibilityLabel="新增任务"
      >
        <Text style={styles.fabPlus}>+</Text>
      </TouchableOpacity>

      <Modal
        visible={modalOpen}
        animationType="fade"
        transparent
        onRequestClose={closeModal}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={closeModal} />
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.modalKb}
            pointerEvents="box-none"
          >
            <View style={[styles.modalSheet, { paddingBottom: 16 + insets.bottom }]}>
            <Text style={styles.modalTitle}>{editing ? "编辑任务" : "新增任务"}</Text>
            <ScrollView
              style={styles.modalScroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.fieldLabel}>图标</Text>
              <TouchableOpacity
                style={[styles.selectedIconRow, styles.selectedIconPressable]}
                onPress={() => setIconPickerVisible((v) => !v)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={iconPickerVisible ? "收起图标库" : "展开图标库"}
              >
                <View style={[styles.iconCell, styles.selectedIconCell]}>
                  <Text style={styles.iconCellText}>{icon || "📋"}</Text>
                </View>
                <Text style={styles.selectedIconHint}>
                  {iconPickerVisible ? "再次点击收起图标库" : "点击图标展开库"}
                </Text>
                <Text style={styles.iconChevron}>{iconPickerVisible ? "▲" : "▼"}</Text>
              </TouchableOpacity>
              {iconPickerVisible ? (
                <View style={styles.iconGrid}>
                  {TASK_ICON_CHOICES.map((em) => (
                    <TouchableOpacity
                      key={em}
                      style={[styles.iconCell, icon === em && styles.iconCellSelected]}
                      onPress={() => {
                        setIcon(em);
                        setIconPickerVisible(false);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.iconCellText}>{em}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}

              <Text style={styles.fieldLabel}>清单名称</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="必填"
                placeholderTextColor="#aaa"
              />

              <Text style={styles.fieldLabel}>提醒时间（仅时刻）</Text>
              <TouchableOpacity
                style={styles.timeRow}
                onPress={() => {
                  setIconPickerVisible(false);
                  setPicker(picker === "reminder" ? "none" : "reminder");
                }}
              >
                <Text style={styles.timeRowText}>
                  {reminderAt ? formatScheduleLabel(reminderAt) : "点击选择时间（可选）"}
                </Text>
              </TouchableOpacity>
              {picker === "reminder" ? (
                <View style={styles.pickerWrap}>
                  <DateTimePicker
                    value={reminderAt ?? new Date()}
                    mode="time"
                    is24Hour
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    onValueChange={(_e, d) => {
                      if (!d) return;
                      setReminderAt(applyPickerTime(reminderAt, d));
                      if (Platform.OS === "android") setPicker("none");
                    }}
                    onDismiss={() => setPicker("none")}
                  />
                  {Platform.OS === "ios" ? (
                    <TouchableOpacity style={styles.pickerDone} onPress={() => setPicker("none")}>
                      <Text style={styles.pickerDoneText}>完成</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : null}
              <TouchableOpacity onPress={() => setReminderAt(null)} style={styles.clearLink}>
                <Text style={styles.clearLinkText}>清除提醒时间</Text>
              </TouchableOpacity>

              <Text style={styles.fieldLabel}>估计完成时间（仅时刻）</Text>
              <TouchableOpacity
                style={styles.timeRow}
                onPress={() => {
                  setIconPickerVisible(false);
                  setPicker(picker === "estimate" ? "none" : "estimate");
                }}
              >
                <Text style={styles.timeRowText}>
                  {estimateDoneAt ? formatScheduleLabel(estimateDoneAt) : "点击选择时间（可选）"}
                </Text>
              </TouchableOpacity>
              {picker === "estimate" ? (
                <View style={styles.pickerWrap}>
                  <DateTimePicker
                    value={estimateDoneAt ?? new Date()}
                    mode="time"
                    is24Hour
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    onValueChange={(_e, d) => {
                      if (!d) return;
                      setEstimateDoneAt(applyPickerTime(estimateDoneAt, d));
                      if (Platform.OS === "android") setPicker("none");
                    }}
                    onDismiss={() => setPicker("none")}
                  />
                  {Platform.OS === "ios" ? (
                    <TouchableOpacity style={styles.pickerDone} onPress={() => setPicker("none")}>
                      <Text style={styles.pickerDoneText}>完成</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : null}
              <TouchableOpacity onPress={() => setEstimateDoneAt(null)} style={styles.clearLink}>
                <Text style={styles.clearLinkText}>清除预计完成时间</Text>
              </TouchableOpacity>

              <Text style={styles.fieldLabel}>备注</Text>
              <TextInput
                style={[styles.input, styles.noteInput]}
                value={note}
                onChangeText={setNote}
                placeholder="可选"
                placeholderTextColor="#aaa"
                multiline
              />
            </ScrollView>

            <TouchableOpacity
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={() => void handleSaveModal()}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>保存</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
              <Text style={styles.cancelBtnText}>取消</Text>
            </TouchableOpacity>
          </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
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
  list: { padding: 16 },
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
  note: { color: "#636E72", marginTop: 4, fontSize: 14 },
  meta: { color: "#95A5A6", fontSize: 12, marginTop: 4 },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    maxWidth: 100,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusDotTodo: { backgroundColor: ACCENT },
  statusDotDone: { backgroundColor: "#16a34a" },
  statusDotIncomplete: { backgroundColor: "#E17055" },
  statusPillTodo: {
    backgroundColor: "rgba(107, 91, 149, 0.08)",
    borderColor: "rgba(107, 91, 149, 0.35)",
  },
  statusPillDone: {
    backgroundColor: "rgba(22, 163, 74, 0.1)",
    borderColor: "rgba(22, 163, 74, 0.4)",
  },
  statusPillIncomplete: {
    backgroundColor: "rgba(225, 112, 85, 0.1)",
    borderColor: "rgba(225, 112, 85, 0.45)",
  },
  statusPillText: { fontSize: 12, fontWeight: "800" },
  statusPillTextTodo: { color: ACCENT },
  statusPillTextDone: { color: "#15803d" },
  statusPillTextIncomplete: { color: "#C2410C" },
  selectedIconRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  selectedIconPressable: {
    borderWidth: 1,
    borderColor: "#E0D8CF",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
  },
  /** 与 iconCell 同尺寸，保证选中图标与库内图标等大 */
  selectedIconCell: { marginRight: 12 },
  selectedIconHint: { flex: 1, fontSize: 13, color: "#95A5A6", paddingRight: 8 },
  iconChevron: {
    fontSize: 12,
    color: ACCENT,
    fontWeight: "800",
  },
  iconGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  iconCell: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E0D8CF",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  iconCellSelected: {
    borderColor: ACCENT,
    borderWidth: 2,
    backgroundColor: "rgba(107, 91, 149, 0.08)",
  },
  iconCellText: { fontSize: 22 },
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
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  modalKb: {
    justifyContent: "flex-end",
    maxHeight: "100%",
  },
  modalSheet: {
    backgroundColor: "#FDFCF9",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    maxHeight: "88%",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#2D3436",
    marginBottom: 12,
    textAlign: "center",
  },
  modalScroll: { maxHeight: 420 },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#636E72",
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: "#DFD8CF",
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: "#2D3436",
    backgroundColor: "#fff",
  },
  noteInput: { minHeight: 88, textAlignVertical: "top" },
  timeRow: {
    borderWidth: 1,
    borderColor: "#DFD8CF",
    borderRadius: 12,
    padding: 14,
    backgroundColor: "#fff",
  },
  timeRowText: { fontSize: 15, color: "#2D3436" },
  pickerWrap: { marginTop: 8, alignItems: "stretch" },
  pickerDone: {
    alignSelf: "center",
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 24,
  },
  pickerDoneText: { color: ACCENT, fontWeight: "800", fontSize: 16 },
  clearLink: { marginTop: 6, marginBottom: 4 },
  clearLinkText: { fontSize: 13, color: "#95A5A6" },
  saveBtn: {
    marginTop: 16,
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  cancelBtn: { marginTop: 10, paddingVertical: 10, alignItems: "center" },
  cancelBtnText: { color: "#636E72", fontSize: 15, fontWeight: "600" },
});
