import React from "react";
import { View, StyleSheet } from "react-native";
import { Swipeable } from "react-native-gesture-handler";

/** 仅用于撑开右侧面板宽度以触发「完全打开」；与列表底同色，不显示删除按钮 */
const TRACK_W = 56;
const LIST_BG = "#FAF8F5";

type Props = {
  children: React.ReactNode;
  /**
   * 左滑完全打开时触发。传入 `closeRow` 请在 Alert「取消」或开始删除时调用，
   * 避免弹窗仍显示时行先被收回造成闪动。
   */
  onDeleteRequest: (closeRow: () => void) => void;
};

export function SwipeableDeleteRow({ children, onDeleteRequest }: Props) {
  return (
    <View style={styles.wrap}>
      <Swipeable
        friction={2}
        rightThreshold={36}
        overshootRight={false}
        renderRightActions={() => (
          <View style={styles.actionsOuter}>
            <View style={styles.invisibleTrack} />
          </View>
        )}
        onSwipeableOpen={(_direction, swipeable) => {
          const closeRow = () => swipeable.close();
          onDeleteRequest(closeRow);
        }}
      >
        {children}
      </Swipeable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  actionsOuter: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "stretch",
  },
  invisibleTrack: {
    width: TRACK_W,
    backgroundColor: LIST_BG,
  },
});
