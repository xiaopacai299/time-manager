/** 与 @time-manger/shared 的 APP_DISPLAY_NAME 保持一致 */
export const APP_NAME = '橘子ING';
export const APP_ICON = '/icon.png';

/** 下载链接：构建安装包后把文件放到 public/downloads/ 并更新 href */
export const DOWNLOAD_LINKS = {
  windows: {
    label: 'Windows 桌面版',
    hint: 'Windows 10 / 11 · 64 位',
    href: '',
  },
  android: {
    label: 'Android 版',
    hint: '与桌面端数据同步',
    href: '',
  },
};

export const NAV_ITEMS = [
  { id: 'showcase', label: '界面' },
  { id: 'features', label: '功能' },
  { id: 'advantages', label: '亮点' },
  { id: 'sync', label: '多端' },
  { id: 'download', label: '下载' },
];

export const SHOWCASE_BENTO = [
  {
    src: '/screenshots/worklist-matrix.png',
    alt: '四象限工作清单',
    label: '今日计划',
    size: 'hero',
  },
  {
    src: '/screenshots/memo-calendar.png',
    alt: '备忘录月历',
    label: '备忘录',
    size: 'tall',
  },
  {
    src: '/screenshots/usage-stats.png',
    alt: '使用统计',
    label: '使用统计',
    size: 'wide',
  },
  {
    src: '/screenshots/ai-chat.png',
    alt: 'AI 对话',
    label: 'AI 对话',
    size: 'square',
  },
];

export const SHOWCASE_SPOTLIGHTS = [
  {
    id: 'matrix',
    tag: '工作清单',
    title: '四象限矩阵',
    image: '/screenshots/worklist-matrix.png',
    alt: '工作清单',
    align: 'left',
    inset: {
      src: '/screenshots/worklist-add.png',
      alt: '添加工作清单',
      caption: '添加清单',
    },
  },
  {
    id: 'memo',
    tag: '备忘录',
    title: '月历备忘',
    image: '/screenshots/memo-calendar.png',
    alt: '备忘录月历',
    align: 'right',
  },
  {
    id: 'year',
    tag: '年度总览',
    title: '年度热力图',
    image: '/screenshots/year-heatmap.png',
    alt: '年度工作总览',
    align: 'left',
  },
  {
    id: 'stats',
    tag: '时间统计',
    title: '应用使用统计',
    image: '/screenshots/usage-stats.png',
    alt: '使用统计',
    align: 'right',
  },
  {
    id: 'ai',
    tag: 'AI · 阅读',
    title: 'AI 对话与阅读',
    image: '/screenshots/ai-chat.png',
    alt: 'AI 对话',
    align: 'left',
    secondary: {
      src: '/screenshots/reader.png',
      alt: '阅读模式',
      caption: '阅读模式',
    },
  },
];

export const FEATURE_GROUPS = [
  {
    tag: '陪伴',
    items: [
      { icon: '🐱', title: '透明宠物窗口' },
      { icon: '💬', title: '气泡提醒' },
      { icon: '🎭', title: '多种互动形态' },
    ],
  },
  {
    tag: '效率',
    items: [
      { icon: '🎯', title: '四象限工作清单' },
      { icon: '📅', title: '备忘录月历' },
      { icon: '📊', title: '应用时间统计' },
      { icon: '🔥', title: '年度工作总览' },
    ],
  },
  {
    tag: '记录',
    items: [
      { icon: '✍️', title: '私密日记' },
      { icon: '🤖', title: '宠物 AI 对话' },
      { icon: '📎', title: '收藏夹与便签' },
      { icon: '📖', title: '阅读模式' },
    ],
  },
];

export const ADVANTAGES = [
  { icon: '🪶', title: '低打扰陪伴' },
  { icon: '🔗', title: '多端同步' },
  { icon: '⚡', title: '本地即时响应' },
];

export const SYNC_PLATFORMS = [
  { icon: '🖥️', name: 'Windows 桌面' },
  { icon: '📱', name: 'Android / iOS' },
  { icon: '☁️', name: '云端同步' },
];
