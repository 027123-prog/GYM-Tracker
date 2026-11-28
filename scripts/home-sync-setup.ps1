[CmdletBinding()]
param([switch]$FirewallOnly, [switch]$AllowFirewallPrompt)

$ErrorActionPreference = 'Stop'
$projectDir = (Get-Item -LiteralPath (Join-Path $PSScriptRoot '..')).FullName
$node = Join-Path $projectDir '.tools\node-v20.18.0-win-x64\node.exe'
$launcher = Join-Path $projectDir 'launch_firefox.ps1'
$engine = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$ruleName = 'HardGainWAF-HomeSync-TLS'
if (!(Test-Path -LiteralPath $node -PathType Leaf)) { throw "Node fehlt: $node" }
$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator)

function Set-HomeFirewall {
    $rule = Get-NetFirewallRule -Name $ruleName -ErrorAction SilentlyContinue
    $argsRule = @{Profile='Private'; Direction='Inbound'; Action='Allow'; Enabled='True';
        Program=$node; Protocol='TCP'; LocalPort=4176; RemoteAddress='LocalSubnet'; EdgeTraversalPolicy='Block'}
    if ($rule) { Set-NetFirewallRule -Name $ruleName @argsRule | Out-Null }
    else { New-NetFirewallRule -Name $ruleName -DisplayName 'HardGainWAF Heim-WLAN' @argsRule | Out-Null }
}

if ($FirewallOnly) {
    if (!$admin) { throw 'Diese Firewallregel erfordert Administratorrechte.' }
    Set-HomeFirewall
    return
}

$privateDir = Join-Path $env:LOCALAPPDATA 'HardGainWAF\home-sync'
$folder = New-Item -ItemType Directory -Path $privateDir -Force
if (($folder.Attributes -band [IO.FileAttributes]::ReparsePoint) -or
    ($folder.Parent.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
    throw 'Der lokale Abgleichordner darf nicht umgeleitet sein.'
}
$acl = Get-Acl -LiteralPath $privateDir
$acl.SetAccessRuleProtection($true, $false)
foreach ($sid in @([Security.Principal.WindowsIdentity]::GetCurrent().User.Value,'S-1-5-18','S-1-5-32-544')) {
    $account = [Security.Principal.SecurityIdentifier]::new($sid)
    $acl.SetAccessRule([Security.AccessControl.FileSystemAccessRule]::new($account,'FullControl','ContainerInherit,ObjectInherit','None','Allow'))
}
Set-Acl -LiteralPath $privateDir -AclObject $acl

$config = Join-Path $privateDir 'tls.json'
if (!(Test-Path -LiteralPath $config)) {
    if (Test-Path -LiteralPath (Join-Path $privateDir 'devices.json')) {
        throw 'Zertifikat einer bestehenden Kopplung fehlt. Den privaten Abgleichordner aus der Sicherung wiederherstellen.'
    }
    $cert = New-SelfSignedCertificate -DnsName $env:COMPUTERNAME -CertStoreLocation 'Cert:\CurrentUser\My' -Type SSLServerAuthentication -KeyAlgorithm RSA -KeyLength 2048 -KeyExportPolicy Exportable -NotAfter (Get-Date).AddYears(10)
    $tmpPfx = Join-Path $privateDir ("cert-" + [Guid]::NewGuid() + '.tmp')
    $tmpConfig = Join-Path $privateDir ("tls-" + [Guid]::NewGuid() + '.tmp')
    $random = [Security.Cryptography.RandomNumberGenerator]::Create()
    $sha = [Security.Cryptography.SHA256]::Create()
    try {
        $bytes = New-Object byte[] 32
        $random.GetBytes($bytes)
        $phrase = [Convert]::ToBase64String($bytes)
        $secure = ConvertTo-SecureString $phrase -AsPlainText -Force
        Export-PfxCertificate -Cert $cert -FilePath $tmpPfx -Password $secure -CryptoAlgorithmOption AES256_SHA256 | Out-Null
        $pin = [BitConverter]::ToString($sha.ComputeHash($cert.RawData)).Replace('-','').ToLowerInvariant()
        $encoded = [Convert]::ToBase64String([IO.File]::ReadAllBytes($tmpPfx))
        [IO.File]::WriteAllText($tmpConfig, (@{pfx=$encoded;passphrase=$phrase;pin=$pin} | ConvertTo-Json -Compress))
        [IO.File]::Move($tmpConfig, $config)
    } finally {
        $random.Dispose()
        $sha.Dispose()
        if (Test-Path -LiteralPath $tmpPfx) { Remove-Item -LiteralPath $tmpPfx }
        if (Test-Path -LiteralPath $tmpConfig) { Remove-Item -LiteralPath $tmpConfig }
        Remove-Item -LiteralPath ('Cert:\CurrentUser\My\' + $cert.Thumbprint) -DeleteKey
    }
}

$startup = [Environment]::GetFolderPath('Startup')
if (!$startup) { throw 'Autostartordner nicht verfügbar.' }
$shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $startup 'HardGainWAF Heimabgleich.lnk'))
$shortcut.TargetPath = $engine
$shortcut.Arguments = '-NoProfile -WindowStyle Hidden -ExecutionPolicy RemoteSigned -File "' + $launcher + '" -ServerOnly'
$shortcut.WorkingDirectory = $projectDir
$shortcut.WindowStyle = 7
$shortcut.Save()

# Replace only the earlier static server owned by this same working copy.
$identity = $null
try { $identity = Invoke-RestMethod 'http://127.0.0.1:4175/.well-known/gym-tracker-server' -TimeoutSec 2 } catch {}
if ($identity -and !$identity.homeSync) {
    $owned = Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort 4175 -State Listen -ErrorAction Stop
    $process = Get-CimInstance Win32_Process -Filter ("ProcessId=" + [int]$identity.pid)
    if ($identity.protocol -ne 'gym-tracker-dist-v2' -or $identity.origin -ne 'http://127.0.0.1:4175' -or
        $identity.root -ine $projectDir -or $owned.OwningProcess -ne $identity.pid -or
        $process.ExecutablePath -ine $node -or $process.CommandLine -notmatch '\bserve-dist\.mjs\b') {
        throw 'Port 4175 ist bereits belegt. Der bestehende Prozess wurde beibehalten.'
    }
    Stop-Process -Id $process.ProcessId -ErrorAction Stop
    Wait-Process -Id $process.ProcessId -Timeout 5 -ErrorAction SilentlyContinue
}
& $launcher -ServerOnly
$running = Invoke-RestMethod 'http://127.0.0.1:4175/.well-known/gym-tracker-server' -TimeoutSec 3
if (!$running.homeSync) { throw 'Abgleichdienst startet nicht. Siehe .tools\gym-tracker-server.err.log.' }

if ($admin) { Set-HomeFirewall }
elseif ($AllowFirewallPrompt) {
    $elevated = Start-Process -FilePath $engine -Verb RunAs -WindowStyle Hidden -ArgumentList ('-NoProfile -ExecutionPolicy RemoteSigned -File "' + $PSCommandPath + '" -FirewallOnly') -Wait -PassThru
    if ($elevated.ExitCode -ne 0) { throw 'Die Windows-Firewallregel wurde nicht eingerichtet.' }
} else {
    Write-Output 'Der Dienst ist eingerichtet. Für eingehende Handyverbindungen wird die private Firewallregel benötigt. Diese Datei bei Bedarf erhöht mit -FirewallOnly starten.'
}
Write-Output 'PC-App: http://127.0.0.1:4175/   Kopplung: Einstellungen > Heim-WLAN'
