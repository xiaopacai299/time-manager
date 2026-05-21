/** 右键菜单「测试 → 生气」项（主进程用，不含图片路径） */
export const PET_ANGRY_ACTION_MENU = [
  { id: 'angry-huimou', label: '回眸' },
  { id: 'angry-duqi', label: '赌气' },
  { id: 'angry-bingjian', label: '并肩' },
  { id: 'angry-ceyan', label: '侧颜' },
  { id: 'angry-baobi', label: '抱臂' },
]

export const PET_ANGRY_ACTION_IDS = new Set(PET_ANGRY_ACTION_MENU.map((item) => item.id))
