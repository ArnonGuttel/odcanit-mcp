#Requires -Version 5.1
<#
  Interactive setup for odcanit-mcp on Windows. No Node.js or other
  dependencies required -- odcanit-mcp.exe is a standalone binary.
  Run this once per machine that will host the MCP server for a firm.
  It collects your Odcanit SQL Server details, tests the connection using
  the bundled odcanit-mcp.exe, and registers it in Claude Desktop's config.

  Looks for odcanit-mcp.exe next to this script first (the flat layout of
  the release zip this script ships in: Setup.bat, setup-windows.ps1, and
  odcanit-mcp.exe all in one folder), falling back to dist-bin\odcanit-mcp.exe
  one level up (the source repo's `npm run build:exe` output layout, for
  running this script directly out of scripts\ during development).

  Pass -Uninstall to remove the 'odcanit' entry from Claude Desktop's config
  instead (skips the DB steps entirely):
    powershell -ExecutionPolicy Bypass -File scripts\setup-windows.ps1 -Uninstall

  Setup.bat and Uninstall.bat in this same folder are double-click wrappers
  around the two invocations above, for users who don't want to open
  PowerShell manually.
#>

param(
    [switch]$Uninstall
)

$ErrorActionPreference = 'Stop'

function Write-Step($msg) {
    Write-Host ""
    Write-Host "==> $msg" -ForegroundColor Cyan
}

function Fail($msg) {
    Write-Host ""
    Write-Host "ERROR: $msg" -ForegroundColor Red
    exit 1
}

function Read-NonEmpty($prompt) {
    do {
        $value = (Read-Host $prompt).Trim()
        if ([string]::IsNullOrWhiteSpace($value)) {
            Write-Host "This field can't be empty." -ForegroundColor Yellow
        }
    } while ([string]::IsNullOrWhiteSpace($value))
    return $value
}

function Read-Port($prompt, $default) {
    do {
        $portInput = (Read-Host "$prompt (press Enter for default $default)").Trim()
        if ([string]::IsNullOrWhiteSpace($portInput)) {
            return $default
        }
        $parsed = 0
        $isValid = [int]::TryParse($portInput, [ref]$parsed) -and $parsed -ge 1 -and $parsed -le 65535
        if (-not $isValid) {
            Write-Host "Port must be a number between 1 and 65535." -ForegroundColor Yellow
        }
    } while (-not $isValid)
    return "$parsed"
}

function Read-YesNo($prompt, $default) {
    $suffix = if ($default) { "Y/n" } else { "y/N" }
    do {
        $value = (Read-Host "$prompt ($suffix)").Trim().ToLower()
        if ([string]::IsNullOrWhiteSpace($value)) {
            return $default
        }
        if ($value -eq 'y' -or $value -eq 'yes') {
            return $true
        }
        if ($value -eq 'n' -or $value -eq 'no') {
            return $false
        }
        Write-Host "Please answer y or n." -ForegroundColor Yellow
    } while ($true)
}

function Get-ClaudeConfigPath {
    # Store-installed (MSIX) Claude Desktop sandboxes filesystem access, so it
    # reads/writes its config under a per-package virtualized AppData folder
    # instead of the classic %APPDATA%\Claude used by non-Store installs.
    # Detect which applies rather than assuming the classic path.
    $packagesRoot = Join-Path $env:LOCALAPPDATA "Packages"
    $msixDirs = @()
    if (Test-Path $packagesRoot) {
        $msixDirs = @(Get-ChildItem -Path $packagesRoot -Directory -Filter "Claude_*" -ErrorAction SilentlyContinue |
            ForEach-Object { Join-Path $_.FullName "LocalCache\Roaming\Claude" })
    }

    if ($msixDirs.Count -eq 0) {
        return Join-Path (Join-Path $env:APPDATA "Claude") "claude_desktop_config.json"
    }

    $existing = @($msixDirs | Where-Object { Test-Path (Join-Path $_ "claude_desktop_config.json") })
    $configDir = if ($existing.Count -gt 0) { $existing[0] } else { $msixDirs[0] }
    if ($msixDirs.Count -gt 1) {
        Write-Host "Multiple Claude Store packages found -- using $configDir" -ForegroundColor Yellow
    }
    return Join-Path $configDir "claude_desktop_config.json"
}

if ($Uninstall) {
    Write-Step "Removing odcanit from Claude Desktop config"
    $configPath = Get-ClaudeConfigPath
    $configDir = Split-Path -Parent $configPath

    if (-not (Test-Path $configPath)) {
        Write-Host "No Claude Desktop config found at $configPath -- nothing to remove."
        exit 0
    }

    $raw = Get-Content $configPath -Raw
    if (-not $raw -or -not $raw.Trim()) {
        Write-Host "Claude Desktop config is empty -- nothing to remove."
        exit 0
    }

    $config = $raw | ConvertFrom-Json
    $hasServers = $config.PSObject.Properties.Name -contains 'mcpServers'
    $hasOdcanit = $hasServers -and ($config.mcpServers.PSObject.Properties.Name -contains 'odcanit')

    if (-not $hasOdcanit) {
        Write-Host "No 'odcanit' entry found in Claude Desktop config -- nothing to remove."
        exit 0
    }

    Write-Host "This will update: $configPath"
    if (-not (Read-YesNo "Continue?" $true)) {
        Write-Host "Cancelled."
        exit 0
    }

    $config.mcpServers.PSObject.Properties.Remove('odcanit')

    $json = $config | ConvertTo-Json -Depth 10
    [System.IO.File]::WriteAllText($configPath, $json, (New-Object System.Text.UTF8Encoding($false)))

    Write-Step "Done"
    Write-Host "Removed 'odcanit' from $configPath. Restart Claude Desktop to apply." -ForegroundColor Green
    exit 0
}

# 1. Locate the standalone server binary
Write-Step "Locating odcanit-mcp.exe"
$flatExePath = Join-Path $PSScriptRoot "odcanit-mcp.exe"
$repoExePath = Join-Path (Split-Path -Parent $PSScriptRoot) "dist-bin\odcanit-mcp.exe"
if (Test-Path $flatExePath) {
    $exePath = $flatExePath
} elseif (Test-Path $repoExePath) {
    $exePath = $repoExePath
} else {
    Fail "odcanit-mcp.exe not found next to this script or at $repoExePath. Download the latest release zip and run Setup.bat from within it."
}
Write-Host "Found $exePath"

# 2. Collect Odcanit SQL Server connection details
Write-Step "Odcanit SQL Server connection details"
Write-Host "Get these from whoever administers your Odcanit / SQL Server (usually your IT contact)."

$dbHost = Read-NonEmpty "SQL Server host"
$dbInstance = (Read-Host "Named instance (press Enter to skip, e.g. 'odcanit' if your host is written as HOST\odcanit)").Trim()
$dbName = Read-NonEmpty "Database name"
$dbUser = Read-NonEmpty "Username"

do {
    $dbPasswordSecure = Read-Host "Password" -AsSecureString
    $dbPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
        [Runtime.InteropServices.Marshal]::SecureStringToBSTR($dbPasswordSecure)
    )
    if ([string]::IsNullOrWhiteSpace($dbPassword)) {
        Write-Host "This field can't be empty." -ForegroundColor Yellow
    }
} while ([string]::IsNullOrWhiteSpace($dbPassword))

$dbPort = $null
if ([string]::IsNullOrWhiteSpace($dbInstance)) {
    $dbPort = Read-Port "Port" "1433"
} else {
    Write-Host "Named instance set -- skipping port (resolved dynamically via SQL Server Browser, UDP 1434)."
}

$trustCert = Read-YesNo "Does the SQL Server use a self-signed certificate? (say yes if the connection test below fails with a certificate error)" $false

$enableWrites = Read-YesNo "Enable write operations? (leave disabled unless you specifically need write-capable tools)" $false

$env:ODCANIT_DB_HOST = $dbHost
$env:ODCANIT_DB_NAME = $dbName
$env:ODCANIT_DB_USER = $dbUser
$env:ODCANIT_DB_PASSWORD = $dbPassword
if ($dbInstance) {
    $env:ODCANIT_DB_INSTANCE = $dbInstance
    $env:ODCANIT_DB_PORT = $null
} else {
    $env:ODCANIT_DB_PORT = $dbPort
}
if ($trustCert) {
    $env:ODCANIT_DB_TRUST_CERT = "true"
} else {
    $env:ODCANIT_DB_TRUST_CERT = $null
}
if ($enableWrites) {
    $env:ODCANIT_DB_ENABLE_WRITES = "true"
} else {
    $env:ODCANIT_DB_ENABLE_WRITES = $null
}

# 3. Test the connection
Write-Step "Testing the connection"
& $exePath --test-connection
if ($LASTEXITCODE -ne 0) {
    Fail "Could not connect to the database with the details provided. Double-check them and re-run this script."
}
Write-Host "Connection succeeded."

# 4. Write Claude Desktop config
Write-Step "Registering the server with Claude Desktop"
$configPath = Get-ClaudeConfigPath
$configDir = Split-Path -Parent $configPath

Write-Host "This will update: $configPath"
if (-not (Read-YesNo "Continue?" $true)) {
    Write-Host "Cancelled."
    exit 0
}

if (-not (Test-Path $configDir)) {
    New-Item -ItemType Directory -Path $configDir -Force | Out-Null
}

# Uses PSObject + ConvertFrom-Json (no -AsHashtable) so this works on the
# Windows PowerShell 5.1 that ships by default, not just PowerShell 7+.
$config = $null
if (Test-Path $configPath) {
    $raw = Get-Content $configPath -Raw
    if ($raw -and $raw.Trim()) {
        $config = $raw | ConvertFrom-Json
    }
}
if (-not $config) {
    $config = New-Object PSObject
}
if (-not ($config.PSObject.Properties.Name -contains 'mcpServers')) {
    $config | Add-Member -MemberType NoteProperty -Name 'mcpServers' -Value (New-Object PSObject)
}

$envEntry = [PSCustomObject]@{
    ODCANIT_DB_HOST     = $dbHost
    ODCANIT_DB_NAME     = $dbName
    ODCANIT_DB_USER     = $dbUser
    ODCANIT_DB_PASSWORD = $dbPassword
}
if ($dbInstance) {
    $envEntry | Add-Member -MemberType NoteProperty -Name 'ODCANIT_DB_INSTANCE' -Value $dbInstance
} else {
    $envEntry | Add-Member -MemberType NoteProperty -Name 'ODCANIT_DB_PORT' -Value $dbPort
}
if ($trustCert) {
    $envEntry | Add-Member -MemberType NoteProperty -Name 'ODCANIT_DB_TRUST_CERT' -Value 'true'
}
if ($enableWrites) {
    $envEntry | Add-Member -MemberType NoteProperty -Name 'ODCANIT_DB_ENABLE_WRITES' -Value 'true'
}

$odcanitEntry = [PSCustomObject]@{
    command = $exePath
    args    = @()
    env     = $envEntry
}

if ($config.mcpServers.PSObject.Properties.Name -contains 'odcanit') {
    $config.mcpServers.odcanit = $odcanitEntry
} else {
    $config.mcpServers | Add-Member -MemberType NoteProperty -Name 'odcanit' -Value $odcanitEntry
}

# Write without a BOM (Set-Content -Encoding UTF8 on Windows PowerShell adds one,
# which can break strict JSON parsers).
$json = $config | ConvertTo-Json -Depth 10
[System.IO.File]::WriteAllText($configPath, $json, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "Wrote config to $configPath"

Write-Step "Done"
Write-Host "Restart Claude Desktop for the odcanit tools to become available." -ForegroundColor Green
