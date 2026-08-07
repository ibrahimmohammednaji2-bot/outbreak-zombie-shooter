' Launches the Zombie Attack online watchdog with no console window.
' A copy of this file lives in the Startup folder so it runs at logon.
' Delete it from there to stop the game going online automatically.
CreateObject("WScript.Shell").Run _
  "powershell -NoProfile -ExecutionPolicy Bypass -File ""c:\Users\m\Documents\zombie-shooter\serve-online.ps1""", 0, False
