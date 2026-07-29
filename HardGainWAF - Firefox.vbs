Set shell = CreateObject("WScript.Shell")
scriptPath = Replace(WScript.ScriptFullName, "HardGainWAF - Firefox.vbs", "launch_firefox.ps1")
command = "powershell.exe -ExecutionPolicy Bypass -File """ & scriptPath & """"
shell.Run command, 0, False
