/** 下载链接：构建安装包后把文件放到 public/downloads/ 并更新此处 */
export const DOWNLOAD_LINKS = {
  windows: {
    label: 'Windows 桌面版',
    hint: 'Windows 10 / 11 · 64 位',
    /** 例如 '/downloads/work-master-setup.exe'，留空则显示构建指引 */
    href: '',
    buildNote: '在仓库根目录执行 pnpm desktop:build，安装包位于 packages/desktop/release/',
  },
  android: {
    label: 'Android 版',
    hint: '与桌面端账号数据同步',
    href: '',
    buildNote: '执行 pnpm mobile:build:android:apk 生成 APK 后放到 public/downloads/',
  },
};

export const NAV_ITEMS = [
  { id: 'features', label: '功能' },
  { id: 'advantages', label: '亮点' },
  { id: 'sync', label: '多端' },
  { id: 'download', label: '下载' },
];

export const FEATURE_GROUPS = [
  {
    tag: '陪伴',
    title: '桌面宠物，低打扰地留在你身边',
    items: [
      {
        icon: '🐱',
        title: '透明宠物窗口',
        desc: '常驻桌面、可拖拽置顶；支持鼠标穿透与 Alt 临时交互，不挡工作区。',
      },
      {
        icon: '💬',
        title: '智能气泡提醒',
        desc: '连续专注过久提醒休息，完成休息正向反馈，并展示当前专注应用。',
      },
      {
        icon: '🎭',
        title: '多种形态与互动',
        desc: '跟随鼠标、随机乱跑等趣味模式；双击打开详细统计面板。',
      },
    ],
  },
  {
    tag: '效率',
    title: '时间、任务与备忘，一套打通',
    items: [
      {
        icon: '📊',
        title: '应用时间统计',
        desc: '自动记录前台应用时长、连续使用与休息累计，今日排行一目了然。',
      },
      {
        icon: '🎯',
        title: '四象限工作清单',
        desc: '紧急/重要矩阵管理待办，支持今日视图、提醒通知与完成追踪。',
      },
      {
        icon: '📅',
        title: '备忘录月历',
        desc: '月历视图、法定节假日与天气预览；点击日期即可添加备忘。',
      },
      {
        icon: '🔥',
        title: '年度工作总鉴',
        desc: '全年工作热力图，回顾节奏与高产时段，辅助复盘与规划。',
      },
    ],
  },
  {
    tag: '沉淀',
    title: '记录、阅读与 AI，扩展你的第二大脑',
    items: [
      {
        icon: '✍️',
        title: '私密日记',
        desc: '独立日记窗口，密码保护；与服务端同步，手机端也可查看编辑。',
      },
      {
        icon: '🤖',
        title: '宠物 AI 对话',
        desc: '专属对话窗口，可配置技能与背景；在专注间隙快速提问与整理思路。',
      },
      {
        icon: '📎',
        title: '收藏夹与便签链接',
        desc: '常用文件/站点快捷入口，便签式链接分类，一键打开。',
      },
      {
        icon: '📖',
        title: '阅读模式',
        desc: '内置阅读窗口，可调背景与自动滚动，适合长文沉浸阅读。',
      },
    ],
  },
];

export const ADVANTAGES = [
  {
    icon: '✨',
    title: '高级感玻璃 UI',
    desc: '与产品一致的毛玻璃、光斑与柔和立体按钮，桌面与窗口风格统一。',
  },
  {
    icon: '🪶',
    title: '陪伴而非打扰',
    desc: '宠物形态让时间管理「看得见但不烦人」，适合长期挂在副屏或角落。',
  },
  {
    icon: '🔗',
    title: '多端增量同步',
    desc: '桌面 + 手机共用账号与 SyncEngine，工作清单、日记、备忘与时间记录保持一致。',
  },
  {
    icon: '🧩',
    title: '模块化可扩展',
    desc: 'Electron 主进程按模块拆分，持续迭代 AI、监听页、年度总鉴等能力。',
  },
  {
    icon: '🔒',
    title: '数据在云端',
    desc: 'PostgreSQL + 标准 REST 同步接口；日记等敏感能力按架构支持加密扩展。',
  },
  {
    icon: '⚡',
    title: '本地优先体验',
    desc: '统计与提醒在本地即时响应，同步在后台完成，日常操作流畅。',
  },
];

export const SYNC_PLATFORMS = [
  { icon: '🖥️', name: 'Windows 桌面', desc: 'Electron 宠物 + 多窗口能力' },
  { icon: '📱', name: 'Android / iOS', desc: 'Expo 移动端，外出也能看统计与清单' },
  { icon: '☁️', name: '同步服务', desc: 'Node 服务 + Prisma，增量 push / pull' },
];
