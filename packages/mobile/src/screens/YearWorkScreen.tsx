import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { computeYearWorkHeatmap } from "@time-manger/shared";
import type { WorklistItemPayload } from "@time-manger/shared";
import { useAuth } from "../hooks/useAuth";
import { useTopInset } from "../hooks/useScreenInsets";

type Props = {
  navigation: { goBack: () => void };
};

const ACCENT = "#6B5B95";
const LEVEL_COLORS: Record<number, string> = {
  [-1]: "transparent",
  1: "#E8E4DE",
  2: "#C5B8E8",
  3: "#8B7AB8",
  4: "#6B5B95",
};

const MONTH_LABELS = [
  "1月",
  "2月",
  "3月",
  "4月",
  "5月",
  "6月",
  "7月",
  "8月",
  "9月",
  "10月",
  "11月",
  "12月",
];

export function YearWorkScreen({ navigation }: Props) {
  const { auth } = useAuth();
  const topInset = useTopInset();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [items, setItems] = useState<WorklistItemPayload[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const yearOptions = useMemo(
    () => Array.from({ length: 5 }, (_, i) => currentYear - i),
    [currentYear]
  );

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

  const heatmap = useMemo(
    () => computeYearWorkHeatmap(items, selectedYear),
    [items, selectedYear]
  );

  const cellSize = 10;
  const gridWidth = heatmap.weekColumns * (cellSize + 2);

  return (
    <View style={[styles.flex, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={navigation.goBack} hitSlop={10}>
          <Text style={styles.back}>返回</Text>
        </TouchableOpacity>
        <Text style={styles.title}>今年工作总鉴</Text>
        <View style={styles.headerSpacer} />
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.summary}>
          {heatmap.year} 年共记录 <Text style={styles.summaryStrong}>{heatmap.totalPlans}</Text>{" "}
          个清单项，覆盖 <Text style={styles.summaryStrong}>{heatmap.activeDays}</Text> 天。
        </Text>
        <Text style={styles.hint}>数据与桌面端同步（按提醒/预计完成时间统计）。</Text>

        {loading ? (
          <ActivityIndicator color={ACCENT} style={{ marginTop: 24 }} />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ width: gridWidth + 28 }}>
              <View style={[styles.monthRow, { width: gridWidth }]}>
                {heatmap.monthMarkers.map((m) => (
                  <Text
                    key={`${m.month}-${m.weekIndex}`}
                    style={[styles.monthLabel, { left: m.weekIndex * (cellSize + 2) }]}
                  >
                    {MONTH_LABELS[m.month]}
                  </Text>
                ))}
              </View>
              <View style={[styles.grid, { width: gridWidth, height: 7 * (cellSize + 2) }]}>
                {heatmap.cells.map((cell) => (
                  <View
                    key={cell.key}
                    style={[
                      styles.cell,
                      {
                        width: cellSize,
                        height: cellSize,
                        left: cell.weekIndex * (cellSize + 2),
                        top: cell.day * (cellSize + 2),
                        backgroundColor: LEVEL_COLORS[cell.level] ?? LEVEL_COLORS[1],
                        opacity: cell.inCurrentYear ? 1 : 0.25,
                      },
                    ]}
                  />
                ))}
              </View>
            </View>
          </ScrollView>
        )}

        <View style={styles.yearRow}>
          {yearOptions.map((y) => (
            <TouchableOpacity
              key={y}
              style={[styles.yearBtn, y === selectedYear && styles.yearBtnActive]}
              onPress={() => setSelectedYear(y)}
            >
              <Text style={[styles.yearBtnText, y === selectedYear && styles.yearBtnTextActive]}>
                {y}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
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
  },
  errorText: { color: "#c53030", fontSize: 13 },
  scroll: { padding: 16, paddingBottom: 40 },
  summary: { fontSize: 15, lineHeight: 22, color: "#2D3436" },
  summaryStrong: { fontWeight: "800", color: ACCENT },
  hint: { fontSize: 12, color: "#95A5A6", marginTop: 6, marginBottom: 16 },
  monthRow: { height: 18, marginBottom: 4, position: "relative" },
  monthLabel: {
    position: "absolute",
    fontSize: 10,
    color: "#95A5A6",
  },
  grid: { position: "relative", marginBottom: 20 },
  cell: { position: "absolute", borderRadius: 2 },
  yearRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  yearBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E0D8CF",
    backgroundColor: "#fff",
  },
  yearBtnActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  yearBtnText: { fontWeight: "700", color: "#636E72" },
  yearBtnTextActive: { color: "#fff" },
});
