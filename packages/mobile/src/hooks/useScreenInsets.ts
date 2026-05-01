import { Platform, StatusBar } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Android 即便拿不到状态栏高度，也至少给一个最小留白，确保不和系统栏重叠。 */
const ANDROID_FALLBACK_TOP = 28;

/**
 * 跨 Android 版本可靠的顶部安全区。
 *
 * 现象：Android 15+（API 35）默认 edge-to-edge，react-native-safe-area-context
 * 在部分设备/架构下 `insets.top` 会返回 0，导致内容绘制到状态栏/刘海下。
 * 兜底：取 `insets.top`、`StatusBar.currentHeight`、固定下限三者中的最大值。
 */
export function useTopInset(): number {
  const insets = useSafeAreaInsets();
  if (Platform.OS === "android") {
    return Math.max(
      insets.top,
      StatusBar.currentHeight ?? 0,
      ANDROID_FALLBACK_TOP,
    );
  }
  return insets.top;
}

/** 底部安全区（手势条），Android 上一般为 0；保留 hook 方便统一替换。 */
export function useBottomInset(): number {
  return useSafeAreaInsets().bottom;
}
