export function createMenuModule({
  Menu,
  Tray,
  nativeImage,
  path,
  fs,
  __dirname,
  app,
  getMainWindow,
  getStatsWindow,
  getPetState,
  onToggleFollowMouse,
  onToggleChaosCat,
  onOpenFavorites,
  onOpenWorklist,
  onOpenReader,
  onOpenSettings,
  onOpenLogin,
  onOpenStatsWindow,
  onOpenDiary,
  onOpenStickyLinks,
  onEmitPetAction,
  angryActionMenu = [],
  yawnActionMenu = [],
  onToggleAutoLaunch,
  appDisplayName = '橘子ING',
}) {
  let tray = null;

  function buildTrayMenu() {
    const petState = getPetState();
    const loginItemSettings = app.getLoginItemSettings();
    return Menu.buildFromTemplate([
      {
        label: '登录',
        click: () => onOpenLogin?.(),
      },
      {
        label: '游戏一下',
        submenu: [
          {
            label: petState.followMouse ?'关闭追鼠标':'追鼠标',
            click: () => onToggleFollowMouse(),
          },
          {
            label: petState.chaosCat ? '停止捣蛋鬼' : '捣蛋鬼',
            click: () => onToggleChaosCat(),
          },
        ],
      },
      {
        label: '收藏夹',
        click: () => onOpenFavorites(),
      },
      {
        label: '便签',
        click: () => onOpenStickyLinks?.(),
      },
      {
        label: '工作清单',
        click: () => onOpenWorklist(),
      },
      {
        label: '阅读',
        click: () => onOpenReader(),
      },
       {
        label: '应用时长统计',
        click: () => onOpenStatsWindow?.(),
      },
      {
        label: '写日记',
        click: () => onOpenDiary?.(),
      },
      {
        label: '设置',
        click: () => onOpenSettings(),
      },
      // {
      //   label: '动作测试',
      //   submenu: [
      //     { label: '休息 rest', click: () => onEmitPetAction('rest') },
      //     { label: '工作 work', click: () => onEmitPetAction('work') },
      //     { label: '提醒 remind', click: () => onEmitPetAction('remind') },
      //     { label: '报警 long-work', click: () => onEmitPetAction('long-work') },
      //   ],
      // },
      { type: 'separator' },
      {
        label: '开机自动启动',
        type: 'checkbox',
        checked: loginItemSettings.openAtLogin,
        click: () => onToggleAutoLaunch(),
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => app.quit(),
      },
    ]);
  }

  function buildTestSubmenu() {
    const yawnItems = yawnActionMenu.map((item) => ({
      label: item.label,
      click: () => onEmitPetAction?.(item.id),
    }))
    const angryItems = angryActionMenu.map((item) => ({
      label: item.label,
      click: () => onEmitPetAction?.(item.id),
    }))
    return [
      ...(yawnItems.length ? yawnItems : [{ label: '打哈欠', enabled: false }]),
      { type: 'separator' },
      { label: '生气', submenu: angryItems.length ? angryItems : [{ label: '（未配置）', enabled: false }] },
    ]
  }

  function buildPetContextMenu() {
    const petState = getPetState();
    const loginItemSettings = app.getLoginItemSettings();
    return Menu.buildFromTemplate([
      {
        label: '登录',
        click: () => onOpenLogin?.(),
      },
      {
        label: '游戏一下',
        submenu: [
          {
            label: petState.followMouse ? '关闭追鼠标':'追鼠标',
            click: () => onToggleFollowMouse(),
          },
          {
            label: petState.chaosCat ? '停止捣蛋鬼' : '捣蛋鬼',
            click: () => onToggleChaosCat(),
          },
        ],
      },
      {
        label: '收藏夹',
        click: () => onOpenFavorites(),
      },
      {
        label: '便签',
        click: () => onOpenStickyLinks?.(),
      },
      {
        label: '工作清单',
        click: () => onOpenWorklist(),
      },
      {
        label: '阅读',
        click: () => onOpenReader(),
      },
      {
        label: '应用时长统计',
        click: () => onOpenStatsWindow?.(),
      },
      {
        label: '写日记',
        click: () => onOpenDiary?.(),
      },
      {
        label: '设置',
        click: () => onOpenSettings(),
      },
      {
        label: '测试',
        submenu: buildTestSubmenu(),
      },
      { type: 'separator' },
      {
        label: '开机自动启动',
        type: 'checkbox',
        checked: loginItemSettings.openAtLogin,
        click: () => onToggleAutoLaunch(),
      },
      { type: 'separator' },
      { label: '退出', click: () => app.quit() },
    ]);
  }

  function refreshTrayMenu() {
    if (tray) tray.setContextMenu(buildTrayMenu());
  }

  function createTray() {
    try {
      const trayPngPath = path.join(__dirname, 'assets', 'tray-icon.png');
      let image = nativeImage.createFromPath(trayPngPath);
      if (image.isEmpty()) {
        throw new Error(`Tray icon image is empty: ${trayPngPath}`);
      }
      image = image.resize({ width: 16, height: 16 });
      tray = new Tray(image);
      tray.setToolTip(appDisplayName);
      tray.setContextMenu(buildTrayMenu());
      tray.on('click', () => {
        const statsWindow = getStatsWindow();
        if (statsWindow && !statsWindow.isDestroyed()) {
          statsWindow.show();
          statsWindow.focus();
          return;
        }
        const mainWindow = getMainWindow();
        if (!mainWindow) return;
        if (mainWindow.isVisible()) mainWindow.focus();
        else mainWindow.show();
      });
    } catch (error) {
      console.error('[tray-init-error]', error);
    }
  }

  function teardown() {
    if (!tray || tray.isDestroyed?.()) return;
    tray.destroy();
    tray = null;
  }

  function popupPetContextMenu(payload, onClosed) {
    const mainWindow = getMainWindow();
    if (!mainWindow || mainWindow.isDestroyed()) {
      if (typeof onClosed === 'function') onClosed();
      return;
    }
    const menu = buildPetContextMenu();
    menu.popup({
      window: mainWindow,
      x: Number(payload?.x) || undefined,
      y: Number(payload?.y) || undefined,
      callback: () => {
        if (typeof onClosed === 'function') onClosed();
      },
    });
  }

  return {
    setup: createTray,
    createTray,
    refreshTrayMenu,
    openContextMenu: popupPetContextMenu,
    popupPetContextMenu,
    teardown,
  };
}
