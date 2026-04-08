import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function getWindowsForegroundContext() {
  const psScript = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class WinApi {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll", SetLastError=true, CharSet=CharSet.Auto)]
  public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
}
"@
$handle = [WinApi]::GetForegroundWindow()
if ($handle -eq [IntPtr]::Zero) {
  Write-Output "{""processName"":""Unknown"",""windowTitle"":""Unknown"",""processId"":0}"
  exit 0
}
$pid = 0
[void][WinApi]::GetWindowThreadProcessId($handle, [ref]$pid)
$titleBuilder = New-Object System.Text.StringBuilder 1024
[void][WinApi]::GetWindowText($handle, $titleBuilder, $titleBuilder.Capacity)
$title = $titleBuilder.ToString()
$processName = "Unknown"
try {
  $procByHandle = Get-Process | Where-Object { $_.MainWindowHandle -eq [int64]$handle } | Select-Object -First 1
  if ($null -ne $procByHandle) {
    $pid = $procByHandle.Id
    $processName = $procByHandle.ProcessName
  } else {
    $processName = (Get-Process -Id $pid -ErrorAction Stop).ProcessName
  }
} catch {}
$obj = [PSCustomObject]@{
  processName = $processName
  windowTitle = $title
  processId = $pid
}
$obj | ConvertTo-Json -Compress
`;

  const { stdout } = await execFileAsync('powershell.exe', [
    '-NoProfile',
    '-Command',
    psScript,
  ]);

  const parsed = safeJsonParse(String(stdout).trim());
  return {
    processName: parsed?.processName || 'Unknown',
    windowTitle: parsed?.windowTitle || 'Unknown',
    processId: Number(parsed?.processId || 0),
  };
}

async function getMacForegroundContext() {
  const script = `
tell application "System Events"
  set frontApp to first application process whose frontmost is true
  set appName to name of frontApp
  set winTitle to ""
  try
    set winTitle to name of front window of frontApp
  end try
  return appName & "||" & winTitle
end tell
`;
  const { stdout } = await execFileAsync('osascript', ['-e', script]);
  const [processName = 'Unknown', windowTitle = 'Unknown'] = String(stdout)
    .trim()
    .split('||');
  return {
    processName: processName || 'Unknown',
    windowTitle: windowTitle || 'Unknown',
    processId: 0,
  };
}

export async function getForegroundContext() {
  const platform = os.platform();
  try {
    if (platform === 'win32') {
      return await getWindowsForegroundContext();
    }
    if (platform === 'darwin') {
      return await getMacForegroundContext();
    }
    return { processName: 'UnsupportedPlatform', windowTitle: 'UnsupportedPlatform', processId: 0 };
  } catch {
    return { processName: 'PermissionOrRuntimeError', windowTitle: 'Unavailable', processId: 0 };
  }
}
