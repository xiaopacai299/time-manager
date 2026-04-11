/** 与主进程快照字段对齐的初始占位，用于首次渲染与桥接未就绪时。 */
export const EMPTY_SNAPSHOT = {
  dayKey: '',
  current: {
    processName: 'Waiting',
    windowTitle: 'Collecting data...',
    idleSeconds: 0,
    isOnBreak: false,
    enteredAt: Date.now(),
  },
  perAppToday: [],
  continuousUseMs: 0,
  breakCompletedMs: 0,
  transitions: [],
}
