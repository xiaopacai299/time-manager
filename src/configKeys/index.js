/**
 * 前端宠物窗口相关阈值（毫秒）
 */

// 1. 作用：连续使用当前会话达到该时长后，`PetBubble` 使用橙黄边框主题（`remind`），温和提醒注意休息。
// 2. 使用：`src/components/PetBubble/PetBubble.jsx`。
export const REMIND_CONTINUOUS_MS = 25 * 60 * 1000

// 1. 作用：连续使用达到该时长后，`PetBubble` 使用鲜红主题（`long-work`）；同阈值用于宠物 mood `long-work`，见 `src/hooks/usePetMood.js`。
// 2. 使用：`src/components/PetBubble/PetBubble.jsx`；`src/hooks/usePetMood.js`。
export const LONG_WORK_CONTINUOUS_MS = 50 * 60 * 1000

// 1. 作用：今日累计空闲休息达到该时长后，气泡文案为「休息完成…」并可走草绿主题（与 `isOnBreak` 等分支共同决定最终样式）；同阈值用于宠物 mood `rest`。
// 2. 使用：`src/components/PetBubble/PetBubble.jsx`；`src/hooks/usePetMood.js`。
export const BREAK_COMPLETED_CELEBRATION_MS = 5 * 60 * 1000
