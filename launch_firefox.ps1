$ErrorActionPreference = 'Stop'

$baseDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$nodeDir = Join-Path $baseDir '.tools\node-v20.18.0-win-x64'
$nodeExe = Join-Path $nodeDir 'node.exe'
$npmCmd = Join-Path $nodeDir 'npm.cmd'
$firefoxExe = 'C:\Program Files\Mozilla Firefox\firefox.exe'
$distIndex = Join-Path $baseDir 'dist\index.html'
$pidFile = Join-Path $baseDir '.tools\gym-tracker-server.pid'
$portFile = Join-Path $baseDir '.tools\gym-tracker-server.port'
$outLog = Join-Path $baseDir '.tools\gym-tracker-server.out.log'
$errLog = Join-Path $baseDir '.tools\gym-tracker-server.err.log'
$defaultPort = 4175
$appOrigin = "http://127.0.0.1:$defaultPort"
$serverStatusUrl = "$appOrigin/.well-known/gym-tracker-server"
$serverProtocol = 'gym-tracker-dist-v2'
$expectedRoot = [System.IO.Path]::GetFullPath($baseDir).TrimEnd('\', '/')

function Test-PortOpen {
  param([int]$Port)

  $connection = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue |
    Where-Object { $_.State -eq 'Listen' } |
    Select-Object -First 1

  return $null -ne $connection
}

function Get-GymTrackerServer {
  try {
    $identity = Invoke-RestMethod `
      -Uri $serverStatusUrl `
      -Method Get `
      -TimeoutSec 2 `
      -ErrorAction Stop

    if (
      $identity.protocol -eq $serverProtocol -and
      $identity.origin -eq $appOrigin -and
      [System.IO.Path]::GetFullPath([string]$identity.root).TrimEnd('\', '/') -ieq $expectedRoot
    ) {
      $runningProcess = Get-Process -Id ([int]$identity.pid) -ErrorAction SilentlyContinue
      if ($runningProcess) {
        return $identity
      }
    }
  } catch {
    return $null
  }

  return $null
}

function Stop-PortConflict {
  $listener = Get-NetTCPConnection -LocalPort $defaultPort -ErrorAction SilentlyContinue |
    Where-Object { $_.State -eq 'Listen' } |
    Select-Object -First 1

  $processDetail = ''
  if ($listener) {
    $listenerProcess = Get-Process -Id $listener.OwningProcess -ErrorAction SilentlyContinue
    if ($listenerProcess) {
      $processDetail = "`nBelegt durch: $($listenerProcess.ProcessName) (PID $($listener.OwningProcess))"
    } else {
      $processDetail = "`nBelegt durch PID $($listener.OwningProcess)"
    }
  }

  $message = @"
HardGainWAF v2.3 kann nicht gestartet werden.

Port $defaultPort ist bereits durch einen anderen Server belegt.$processDetail
Die App verwendet aus Sicherheitsgruenden ausschliesslich:
$appOrigin

Bitte beende den fremden Prozess und starte HardGainWAF erneut.
"@

  Write-Error $message -ErrorAction Continue

  try {
    $popup = New-Object -ComObject WScript.Shell
    [void]$popup.Popup($message, 0, 'HardGainWAF v2.3', 16)
  } catch {
    # In nicht-interaktiven Umgebungen bleibt die klare Fehlermeldung im Fehlerkanal.
  }

  throw $message
}

function Invoke-Npm {
  param([Parameter(Mandatory = $true)][string[]]$Arguments)

  & $npmCmd @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "npm $($Arguments -join ' ') ist mit Exitcode $LASTEXITCODE fehlgeschlagen."
  }
}

function Needs-Build {
  if (-not (Test-Path $distIndex)) {
    return $true
  }

  $distTime = (Get-Item $distIndex).LastWriteTimeUtc
  $watchFiles = @(
    (Join-Path $baseDir 'index.html'),
    (Join-Path $baseDir 'package.json'),
    (Join-Path $baseDir 'vite.config.js'),
    (Join-Path $baseDir 'tailwind.config.js'),
    (Join-Path $baseDir 'postcss.config.js')
  )

  foreach ($file in $watchFiles) {
    if ((Test-Path $file) -and (Get-Item $file).LastWriteTimeUtc -gt $distTime) {
      return $true
    }
  }

  $newerSource = Get-ChildItem (Join-Path $baseDir 'src') -Recurse -File |
    Where-Object { $_.LastWriteTimeUtc -gt $distTime } |
    Select-Object -First 1

  return $null -ne $newerSource
}

if (-not (Test-Path $nodeExe) -or -not (Test-Path $npmCmd)) {
  throw "Portable Node-Umgebung nicht gefunden: $nodeDir"
}

$env:Path = "$nodeDir;$env:Path"

if (-not (Test-Path (Join-Path $baseDir 'node_modules'))) {
  Push-Location $baseDir
  try {
    Invoke-Npm -Arguments @('install')
  } finally {
    Pop-Location
  }
}

if (Needs-Build) {
  Push-Location $baseDir
  try {
    Invoke-Npm -Arguments @('run', 'build')
  } finally {
    Pop-Location
  }
}

$existingServer = $null
if (Test-PortOpen -Port $defaultPort) {
  $existingServer = Get-GymTrackerServer
  if (-not $existingServer) {
    Stop-PortConflict
  }
}

if (-not $existingServer) {
  if (Test-Path $outLog) { Remove-Item $outLog -Force }
  if (Test-Path $errLog) { Remove-Item $errLog -Force }

  $serverProcess = Start-Process -FilePath $nodeExe `
    -ArgumentList @('serve-dist.mjs', '--port', "$defaultPort") `
    -WorkingDirectory $baseDir `
    -WindowStyle Hidden `
    -PassThru `
    -RedirectStandardOutput $outLog `
    -RedirectStandardError $errLog

  Set-Content -Path $pidFile -Value $serverProcess.Id -Encoding ascii
  Set-Content -Path $portFile -Value $defaultPort -Encoding ascii

  $serverReady = $false
  for ($attempt = 0; $attempt -lt 40; $attempt++) {
    Start-Sleep -Milliseconds 250

    $serverProcess.Refresh()
    if ($serverProcess.HasExited) {
      break
    }

    if (Test-PortOpen -Port $defaultPort) {
      $startedServer = Get-GymTrackerServer
      if ($startedServer -and ([int]$startedServer.pid -eq $serverProcess.Id)) {
        $existingServer = $startedServer
        $serverReady = $true
        break
      }
    }
  }

  if (-not $serverReady) {
    $detectedServer = Get-GymTrackerServer
    if ($detectedServer) {
      $existingServer = $detectedServer
      $serverReady = $true
      Set-Content -Path $pidFile -Value ([int]$existingServer.pid) -Encoding ascii
      Set-Content -Path $portFile -Value $defaultPort -Encoding ascii
    }

    if ((Test-PortOpen -Port $defaultPort) -and -not $detectedServer) {
      Stop-PortConflict
    }

    if (-not $serverReady) {
      $serverError = ''
      if (Test-Path $errLog) {
        $serverError = (Get-Content $errLog -Raw -ErrorAction SilentlyContinue).Trim()
      }

      if ($serverError) {
        throw "HardGainWAF Server konnte nicht gestartet werden.`n$serverError"
      }

      throw "HardGainWAF Server antwortet nicht unter $appOrigin."
    }
  }
} else {
  Set-Content -Path $pidFile -Value ([int]$existingServer.pid) -Encoding ascii
  Set-Content -Path $portFile -Value $defaultPort -Encoding ascii
}

$appUrl = "$appOrigin/"

if (Test-Path $firefoxExe) {
  Start-Process -FilePath $firefoxExe -ArgumentList $appUrl | Out-Null
} else {
  Start-Process $appUrl | Out-Null
}
