; electron-builder 会合并此文件。customInit 在向导早期执行，先于「检测应用是否运行」。
; 用于结束旧版 Time Pet（含 Electron 子进程），避免覆盖文件时被占用而提示「无法关闭请手动关闭」。
!macro customInit
  nsExec::ExecToLog 'cmd.exe /c taskkill /F /IM "${APP_EXECUTABLE_FILENAME}" /T'
  Sleep 800
!macroend
