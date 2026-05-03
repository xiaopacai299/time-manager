import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Dimensions,
} from "react-native";
import Svg, { Path, Circle } from "react-native-svg";
import { useAuth } from "../hooks/useAuth";
import { useTopInset } from "../hooks/useScreenInsets";
import type { TimeRecordPayload } from "@time-manger/shared";

type Props = {
  navigation: { goBack: () => void };
};

const { width: SCREEN_W } = Dimensions.get("window");
const ACCENT = "#6B5B95";
const BG = "#EDE6DC";
const INK = "#2C3E50";

/** 柔和配色，用于饼图与条形图统一 */
const PALETTE = [
  "#6B5B95",
  "#C9A227",
  "#2980B9",
  "#27AE60",
  "#E17055",
  "#8E44AD",
  "#16A085",
  "#D35400",
  "#2C3E50",
  "#7F8C8D",
];

function formatMs(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return "<1m";
}

function todayDate(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** 角度从顶部顺时针 0–360，映射到圆周点（SVG y 向下） */
function pointOnCircle(cx: number, cy: number, r: number, angleFromTopDeg: number) {
  const rad = (angleFromTopDeg / 360) * 2 * Math.PI - Math.PI / 2;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/** 中心出发的扇形（外弧顺时针） */
function pieSlicePath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const p1 = pointOnCircle(cx, cy, r, startDeg);
  const p2 = pointOnCircle(cx, cy, r, endDeg);
  const sweep = endDeg - startDeg;
  const large = sweep > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${p1.x} ${p1.y} A ${r} ${r} 0 ${large} 1 ${p2.x} ${p2.y} Z`;
}

function DonutChart({
  records,
  totalMs,
  size,
}: {
  records: TimeRecordPayload[];
  totalMs: number;
  size: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size * 0.38;
  const rInner = size * 0.22;

  if (totalMs <= 0 || records.length === 0) {
    return (
      <View style={[styles.donutEmpty, { width: size, height: size }]}>
        <Text style={styles.donutEmptyText}>暂无数据</Text>
      </View>
    );
  }

  const slices: { path: string; color: string; key: string }[] = [];
  let singleColor: string | null = null;

  if (records.length === 1) {
    singleColor = PALETTE[0]!;
  } else {
    const raw = records.map((r) => (r.durationMs / totalMs) * 360);
    const sum = raw.reduce((a, b) => a + b, 0);
    const angles = [...raw];
    if (angles.length > 0) {
      angles[angles.length - 1]! += 360 - sum;
    }
    let acc = 0;
    records.forEach((rec, i) => {
      const sweep = angles[i] ?? 0;
      const start = acc;
      const end = acc + sweep;
      if (sweep >= 0.02) {
        slices.push({
          key: rec.id,
          color: PALETTE[i % PALETTE.length]!,
          path: pieSlicePath(cx, cy, rOuter, start, end),
        });
      }
      acc = end;
    });
  }

  return (
    <View style={{ width: size, height: size, position: "relative", alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size}>
        {singleColor != null ? (
          <Circle cx={cx} cy={cy} r={rOuter} fill={singleColor} />
        ) : (
          slices.map((s) => (
            <Path key={s.key} d={s.path} fill={s.color} stroke="rgba(255,255,255,0.35)" strokeWidth={1} />
          ))
        )}
        <Circle cx={cx} cy={cy} r={rInner} fill="#F5F0E8" />
        <Circle cx={cx} cy={cy} r={rInner - 1} stroke="rgba(107,91,149,0.15)" strokeWidth={1} fill="none" />
      </Svg>
      <View style={styles.donutCenterOverlay} pointerEvents="none">
        <Text style={styles.donutCenterLabel}>今日</Text>
        <Text style={styles.donutCenterValue} numberOfLines={1}>
          {formatMs(totalMs)}
        </Text>
      </View>
    </View>
  );
}

export function AppStatsScreen({ navigation }: Props) {
  const { auth } = useAuth();
  const [records, setRecords] = useState<TimeRecordPayload[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const topInset = useTopInset();

  const load = useCallback(async () => {
    if (auth.status !== "authenticated") return;
    setLoading(true);
    setError(null);
    try {
      const { records: rows } = await auth.client.listTimeRecordsByDate(todayDate());
      setRecords(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [auth]);

  useEffect(() => {
    void load();
  }, [load]);

  const sorted = useMemo(
    () => [...records].sort((a, b) => b.durationMs - a.durationMs),
    [records]
  );
  const total = useMemo(() => records.reduce((s, r) => s + r.durationMs, 0), [records]);
  const maxMs = useMemo(() => sorted[0]?.durationMs ?? 1, [sorted]);

  const chartSize = Math.min(SCREEN_W - 56, 280);

  return (
    <View style={[styles.root, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={navigation.goBack} hitSlop={12}>
          <Text style={styles.back}>返回</Text>
        </TouchableOpacity>
        <Text style={styles.title}>应用统计</Text>
        <View style={styles.headerSpacer} />
      </View>

      {error ? (
        <View style={styles.errBanner}>
          <Text style={styles.errText}>{error}</Text>
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={ACCENT} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.intro}>
          <View style={styles.introLine} />
          <Text style={styles.introText}>今日各应用时长 · 图表一览</Text>
          <View style={styles.introLine} />
        </View>

        {loading && records.length === 0 ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={ACCENT} />
          </View>
        ) : records.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>还没有记录</Text>
            <Text style={styles.emptySub}>桌面端同步或产生今日时间数据后，下拉即可刷新</Text>
          </View>
        ) : (
          <>
            <View style={styles.chartCard}>
              <Text style={styles.sectionTitle}>时长占比</Text>
              <Text style={styles.sectionSub}>环形图 · 面积代表各应用占比</Text>
              <View style={styles.donutWrap}>
                <DonutChart records={sorted} totalMs={total} size={chartSize} />
              </View>
              <View style={styles.legend}>
                {sorted.map((rec, i) => {
                  const pct = total > 0 ? Math.round((rec.durationMs / total) * 100) : 0;
                  return (
                    <View key={rec.id} style={styles.legendRow}>
                      <View style={[styles.legendSwatch, { backgroundColor: PALETTE[i % PALETTE.length]! }]} />
                      <Text style={styles.legendName} numberOfLines={1}>
                        {rec.appName}
                      </Text>
                      <Text style={styles.legendPct}>{pct}%</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            <View style={styles.chartCard}>
              <Text style={styles.sectionTitle}>应用排行</Text>
              <Text style={styles.sectionSub}>横向对比 · 最长者为满格</Text>
              {sorted.map((rec, i) => {
                const w = maxMs > 0 ? (rec.durationMs / maxMs) * 100 : 0;
                const color = PALETTE[i % PALETTE.length]!;
                return (
                  <View key={rec.id} style={styles.barBlock}>
                    <View style={styles.barHead}>
                      <Text style={styles.barName} numberOfLines={1}>
                        {rec.appName}
                      </Text>
                      <Text style={styles.barDuration}>{formatMs(rec.durationMs)}</Text>
                    </View>
                    <View style={styles.barTrack}>
                      <View style={[styles.barGlow, { width: `${w}%`, backgroundColor: color }]} />
                    </View>
                    <Text style={styles.barKey} numberOfLines={1}>
                      {rec.appKey}
                    </Text>
                  </View>
                );
              })}
            </View>
          </>
        )}

        <View style={styles.footerPad} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#D8CFC4",
  },
  back: { color: ACCENT, fontWeight: "700", fontSize: 16 },
  title: { fontSize: 18, fontWeight: "800", color: INK, letterSpacing: 0.5 },
  headerSpacer: { width: 40 },
  errBanner: { backgroundColor: "#FFF5F5", padding: 10 },
  errText: { color: "#C53030", fontSize: 13, textAlign: "center" },
  scroll: { paddingBottom: 40 },
  intro: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    paddingHorizontal: 24,
    gap: 12,
  },
  introLine: { flex: 1, height: 1, backgroundColor: "rgba(44,62,80,0.12)" },
  introText: {
    fontSize: 12,
    color: "#7F8C8D",
    letterSpacing: 2,
    fontWeight: "700",
  },
  loadingBox: { paddingVertical: 80, alignItems: "center" },
  emptyCard: {
    marginHorizontal: 20,
    padding: 32,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.75)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
  },
  emptyTitle: { fontSize: 17, fontWeight: "800", color: INK, marginBottom: 8 },
  emptySub: { fontSize: 14, color: "#95A5A6", textAlign: "center", lineHeight: 22 },
  chartCard: {
    marginHorizontal: 16,
    marginBottom: 18,
    padding: 20,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.88)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.95)",
    shadowColor: "#2C3E50",
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: INK,
    marginBottom: 4,
  },
  sectionSub: {
    fontSize: 12,
    color: "#95A5A6",
    marginBottom: 16,
  },
  donutWrap: { alignItems: "center", marginVertical: 8 },
  donutEmpty: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "rgba(107,91,149,0.25)",
  },
  donutEmptyText: { color: "#95A5A6", fontSize: 14 },
  donutCenterOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  donutCenterLabel: {
    fontSize: 11,
    color: "#7F8C8D",
    letterSpacing: 2,
    fontWeight: "700",
  },
  donutCenterValue: {
    fontSize: 20,
    fontWeight: "800",
    color: ACCENT,
    marginTop: 2,
  },
  legend: { marginTop: 8 },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  legendSwatch: { width: 10, height: 10, borderRadius: 3, marginRight: 10 },
  legendName: { flex: 1, fontSize: 14, fontWeight: "600", color: INK },
  legendPct: { fontSize: 13, fontWeight: "800", color: ACCENT, width: 40, textAlign: "right" },
  barBlock: { marginBottom: 18 },
  barHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 8,
  },
  barName: { flex: 1, fontSize: 14, fontWeight: "700", color: INK, marginRight: 8 },
  barDuration: { fontSize: 13, fontWeight: "800", color: ACCENT },
  barTrack: {
    height: 12,
    borderRadius: 8,
    backgroundColor: "rgba(44,62,80,0.06)",
    overflow: "hidden",
  },
  barGlow: {
    height: "100%",
    borderRadius: 8,
    minWidth: 4,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  barKey: { fontSize: 11, color: "#BDC3C7", marginTop: 6 },
  footerPad: { height: 24 },
});
