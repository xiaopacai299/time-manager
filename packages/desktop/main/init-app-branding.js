/**
 * 必须在 app.whenReady() 之前执行：Windows 任务栏名称、分组与跳转列表依赖于此。
 */
import { app } from 'electron';
import { APP_DISPLAY_NAME, APP_USER_MODEL_ID } from '@time-manger/shared';
import { registerWindowsTaskbarIdentity } from './windows-taskbar.js';

if (process.platform === 'win32') {
  app.setAppUserModelId(APP_USER_MODEL_ID);
  registerWindowsTaskbarIdentity();
}

app.setName(APP_DISPLAY_NAME);

if (process.platform === 'win32') {
  app.setAboutPanelOptions({
    applicationName: APP_DISPLAY_NAME,
    applicationVersion: app.getVersion(),
  });
}
