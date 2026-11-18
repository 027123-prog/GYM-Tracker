[CmdletBinding()]
param(
    [string]$Sdk = $env:ANDROID_HOME,
    [string]$Jdk = $env:JAVA_HOME,
    [ValidateRange(1, 2100000000)][int]$VersionCode,
    [switch]$DebugWebView
)

$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
$version = (Get-Content -Raw -LiteralPath (Join-Path $project 'package.json') | ConvertFrom-Json).version
if (!$VersionCode) {
    $parts = [version]$version
    $VersionCode = 1000000 * $parts.Major + 1000 * $parts.Minor + $parts.Build
}
$localTools = Join-Path $env:LOCALAPPDATA 'WandkalenderBuild'
if (!$Sdk) { $Sdk = Join-Path $localTools 'build-sdk' }
if (!$Jdk) {
    $Jdk = (Get-ChildItem -LiteralPath $localTools -Directory -Filter 'jdk-*' -ErrorAction SilentlyContinue |
        Select-Object -First 1).FullName
}
if (!$Jdk) { throw 'Bitte JDK 17 über -Jdk oder JAVA_HOME angeben.' }
$env:JAVA_HOME = $Jdk
$tools = Join-Path $Sdk 'build-tools/35.0.0'
$platform = Join-Path $Sdk 'platforms/android-35/android.jar'
if (!(Test-Path -LiteralPath $platform) -or !(Test-Path -LiteralPath (Join-Path $tools 'aapt2.exe'))) {
    throw 'Android SDK Platform 35 und Build Tools 35.0.0 werden benötigt.'
}

function Invoke-Tool([string]$File, [string[]]$ToolArgs) {
    & $File @ToolArgs
    if ($LASTEXITCODE -ne 0) { throw "$File fehlgeschlagen (Exitcode $LASTEXITCODE)." }
}

$source = Join-Path $PSScriptRoot 'src/main'
$build = Join-Path $PSScriptRoot 'build'
$work = Join-Path $build ([guid]::NewGuid().ToString())
$classes = Join-Path $work 'classes'
$assets = Join-Path $work 'assets'
$dex = Join-Path $work 'dex'
$out = Join-Path $build 'out'
New-Item -Force -ItemType Directory -Path $classes, $assets, $dex, $out | Out-Null

Push-Location -LiteralPath $project
try {
    $nodeExe = Join-Path $project '.tools/node-v20.18.0-win-x64/node.exe'
    if (!(Test-Path -LiteralPath $nodeExe)) { $nodeExe = (Get-Command node.exe).Source }
    Invoke-Tool $nodeExe @('./node_modules/vite/bin/vite.js', 'build', '--mode', 'android',
        '--outDir', (Join-Path $assets 'www'), '--emptyOutDir')

    $resources = Join-Path $work 'res.zip'
    $baseApk = Join-Path $work 'base.apk'
    $aligned = Join-Path $work 'aligned.apk'
    $signed = Join-Path $work 'signed.apk'
    Invoke-Tool (Join-Path $tools 'aapt2.exe') @('compile', '--dir', (Join-Path $source 'res'), '-o', $resources)
    $linkFlags = @('link', '-o', $baseApk, '--manifest', (Join-Path $source 'AndroidManifest.xml'),
        '-I', $platform, '--min-sdk-version', '30', '--target-sdk-version', '35',
        '--version-code', $VersionCode, '--version-name', $version)
    if ($DebugWebView) { $linkFlags += '--debug-mode' }
    Invoke-Tool (Join-Path $tools 'aapt2.exe') ($linkFlags + $resources)

    $javaSources = (Get-ChildItem -LiteralPath (Join-Path $source 'java') -Recurse -Filter '*.java').FullName
    Invoke-Tool (Join-Path $Jdk 'bin/javac.exe') (@('-encoding', 'UTF-8', '-source', '17', '-target', '17',
        '-XDstringConcat=inline', '-cp', $platform, '-d', $classes) + $javaSources)
    $intermediate = Join-Path $work 'classes.jar'
    Invoke-Tool (Join-Path $Jdk 'bin/jar.exe') @('--create', '--file', $intermediate, '-C', $classes, '.')
    Invoke-Tool (Join-Path $tools 'd8.bat') @('--release', '--lib', $platform, '--min-api', '30', '--output', $dex, $intermediate)
    Invoke-Tool (Join-Path $Jdk 'bin/jar.exe') @('--update', '--file', $baseApk, '-C', $dex, 'classes.dex',
        '-C', $work, 'assets')
    Invoke-Tool (Join-Path $tools 'zipalign.exe') @('-f', '4', $baseApk, $aligned)

    $signingDir = Join-Path $env:LOCALAPPDATA 'HardGainWAF/signing'
    New-Item -Force -ItemType Directory -Path $signingDir | Out-Null
    $keystore = Join-Path $signingDir 'hardgainwaf.p12'
    $savedPassword = Join-Path $signingDir 'password.dpapi'
    if ((Test-Path -LiteralPath $keystore) -ne (Test-Path -LiteralPath $savedPassword)) {
        throw 'APK-Schlüssel oder Passwortdatei fehlt. Signaturdateien aus der Sicherung wiederherstellen.'
    }
    if (!(Test-Path -LiteralPath $savedPassword)) {
        $random = New-Object byte[] 32
        [System.Security.Cryptography.RandomNumberGenerator]::Fill($random)
        ConvertTo-SecureString ([Convert]::ToBase64String($random)) -AsPlainText -Force |
            ConvertFrom-SecureString | Set-Content -LiteralPath $savedPassword
        [Array]::Clear($random, 0, $random.Length)
    }
    $secure = (Get-Content -Raw -LiteralPath $savedPassword).Trim() | ConvertTo-SecureString
    $env:HARDGAINWAF_APK_PASSWORD = [pscredential]::new('apk', $secure).GetNetworkCredential().Password
    try {
        if (!(Test-Path -LiteralPath $keystore)) {
            Invoke-Tool (Join-Path $Jdk 'bin/keytool.exe') @('-genkeypair', '-keystore', $keystore,
                '-storepass:env', 'HARDGAINWAF_APK_PASSWORD', '-alias', 'hardgainwaf', '-keyalg', 'RSA',
                '-keysize', '3072', '-validity', '10000', '-dname', 'CN=HardGainWAF')
        }
        Invoke-Tool (Join-Path $tools 'apksigner.bat') @('sign', '--ks', $keystore, '--ks-key-alias',
            'hardgainwaf', '--ks-pass', 'env:HARDGAINWAF_APK_PASSWORD', '--out', $signed, $aligned)
        Invoke-Tool (Join-Path $tools 'apksigner.bat') @('verify', '--verbose', $signed)
        $name = if ($DebugWebView) { "HardGainWAF-$version-qa.apk" } else { "HardGainWAF-$version.apk" }
        $apk = Join-Path $out $name
        Copy-Item -LiteralPath $signed -Destination $apk -Force
        Get-Item -LiteralPath $apk
    } finally {
        Remove-Item Env:HARDGAINWAF_APK_PASSWORD -ErrorAction SilentlyContinue
    }
} finally {
    Pop-Location
    $absoluteWork = (Resolve-Path -LiteralPath $work).Path
    $absoluteBuild = (Resolve-Path -LiteralPath $build).Path.TrimEnd('\') + '\'
    if ($absoluteWork.StartsWith($absoluteBuild, [StringComparison]::OrdinalIgnoreCase)) {
        Remove-Item -LiteralPath $absoluteWork -Recurse -Force
    }
}
