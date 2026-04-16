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
  onOpenSettings,
  onEmitPetAction,
}) {
  let tray = null;

  function buildTrayMenu() {
    const petState = getPetState();
    return Menu.buildFromTemplate([
      {
        label: petState.followMouse ? '猫捉老鼠' : '关闭猫捉老鼠',
        click: () => onToggleFollowMouse(),
      },
      {
        label: petState.chaosCat ? '停止捣乱' : '捣乱的小猫',
        click: () => onToggleChaosCat(),
      },
      {
        label: '收藏夹',
        click: () => onOpenFavorites(),
      },
      {
        label: '添加工作清单',
        click: () => onOpenWorklist(),
      },
      {
        label: '设置',
        click: () => onOpenSettings(),
      },
      {
        label: '动作测试',
        submenu: [
          { label: '休息 rest', click: () => onEmitPetAction('rest') },
          { label: '工作 work', click: () => onEmitPetAction('work') },
          { label: '提醒 remind', click: () => onEmitPetAction('remind') },
          { label: '报警 long-work', click: () => onEmitPetAction('long-work') },
        ],
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => app.quit(),
      },
    ]);
  }

  function buildPetContextMenu() {
    const petState = getPetState();
    return Menu.buildFromTemplate([
      {
        label: petState.followMouse ? '关闭猫捉老鼠' : '猫捉老鼠',
        click: () => onToggleFollowMouse(),
      },
      {
        label: petState.chaosCat ? '停止捣乱' : '捣乱的小猫',
        click: () => onToggleChaosCat(),
      },
      {
        label: '收藏夹',
        click: () => onOpenFavorites(),
      },
      {
        label: '添加工作清单',
        click: () => onOpenWorklist(),
      },
      {
        label: '设置',
        click: () => onOpenSettings(),
      },
      {
        label: '动作测试',
        submenu: [
          { label: '休息 rest', click: () => onEmitPetAction('rest') },
          { label: '工作 work', click: () => onEmitPetAction('work') },
          { label: '提醒 remind', click: () => onEmitPetAction('remind') },
          { label: '报警 long-work', click: () => onEmitPetAction('long-work') },
        ],
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
      const traySvgPath = path.join(__dirname, 'assets', 'tray-icon.svg');
      let image = nativeImage.createFromPath(trayPngPath);
      if (image.isEmpty()) {
        const traySvgRaw = fs.readFileSync(traySvgPath, 'utf8');
        const trayDataUrl = `data:image/svg+xml;base64,${Buffer.from(traySvgRaw).toString('base64')}`;
        image = nativeImage.createFromDataURL(trayDataUrl);
      }
      if (image.isEmpty()) {
        throw new Error('Tray icon image is empty for both PNG and SVG');
      }
      image = image.resize({ width: 16, height: 16 });
      tray = new Tray(image);
      tray.setToolTip('时间小精灵');
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
