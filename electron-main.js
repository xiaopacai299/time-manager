import { app, BrowserWindow, Tray, Menu } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let mainWindow;
function createMainWindow() {
   mainWindow = new BrowserWindow({
       width: 800,
       height: 600,
       webPreferences: {
           preload: path.join(__dirname, 'preload.js'),
           contextIsolation: true,
       },
   });
   mainWindow.loadURL('http://localhost:5173');
}
app.whenReady().then(createMainWindow);