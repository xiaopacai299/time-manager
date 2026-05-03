import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTopInset } from "../hooks/useScreenInsets";
import { useAuth } from "../hooks/useAuth";
import type { RootStackParamList } from "../navigation/RootNavigator";

const ACCENT = "#6B5B95";

type Props = NativeStackScreenProps<RootStackParamList, "DiaryCompose">;

export function DiaryComposeScreen({ navigation, route }: Props) {
  const { auth } = useAuth();
  const insets = useSafeAreaInsets();
  const topInset = useTopInset();
  const p = route.params ?? {};
  const diaryId = p.diaryId;
  const initialDate = p.initialDate;
  const initialContent = p.initialContent;
  const isEdit = Boolean(diaryId);

  const [content, setContent] = useState(initialContent ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setContent(initialContent ?? "");
  }, [diaryId, initialContent]);

  const handleSave = useCallback(async () => {
    if (auth.status !== "authenticated") return;
    const trimmed = content.trim();
    if (!trimmed) {
      Alert.alert("提示", "请先写下日记内容");
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    setSaving(true);
    setError(null);
    try {
      if (isEdit && diaryId && initialDate) {
        await auth.client.updateDiary(diaryId, {
          date: initialDate,
          content: trimmed,
        });
      } else {
        await auth.client.createDiary({ date: today, content: trimmed });
      }
      navigation.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }, [auth, content, diaryId, initialDate, isEdit, navigation]);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.flex, { paddingTop: topInset }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
            <Text style={styles.back}>返回</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{isEdit ? "编辑日记" : "新增日记"}</Text>
          <View style={styles.headerSpacer} />
        </View>

        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollInner}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {isEdit && initialDate ? (
            <Text style={styles.meta}>日期 {initialDate}</Text>
          ) : (
            <Text style={styles.meta}>将保存为 {new Date().toISOString().slice(0, 10)} 的日记</Text>
          )}
          <Text style={styles.fieldLabel}>内容</Text>
          <TextInput
            style={[styles.input, styles.noteInput]}
            value={content}
            onChangeText={setContent}
            placeholder="写下今天的日记..."
            placeholderTextColor="#aaa"
            multiline
            textAlignVertical="top"
          />
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: 16 + insets.bottom }]}>
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={() => void handleSave()}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>保存</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
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
  scroll: { flex: 1 },
  scrollInner: { padding: 16, paddingBottom: 24 },
  meta: {
    fontSize: 13,
    color: "#95A5A6",
    marginBottom: 12,
    textAlign: "center",
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#636E72",
    marginBottom: 8,
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
  noteInput: { minHeight: 220, textAlignVertical: "top" },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: "#FAF8F5",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E8E4DE",
  },
  saveBtn: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveBtnDisabled: { opacity: 0.7 },
  saveBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
