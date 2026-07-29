Set shell = CreateObject("WScript.Shell")
scriptPath = Replace(WScript.ScriptFullName, "Gym Tracker - Firefox.vbs", "launch_firefox.ps1")
command = "powershell.exe -ExecutionPolicy Bypass -File """ & scriptPath & """"
shell.Run command, 0, False
