#Requires -Version 5.1
<#
  Interactive setup for odcanit-mcp on Windows.
  Run this once per machine that will host the MCP server for a firm.
  It installs dependencies, collects your Odcanit SQL Server details,
  tests the connection, and registers the server in Claude Desktop's config.

  Pass -Uninstall to remove the 'odcanit' entry from Claude Desktop's config
  instead (skips the Node/npm/DB steps entirely):
    powershell -ExecutionPolicy Bypass -File scripts\setup-windows.ps1 -Uninstall
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

if ($Uninstall) {
    Write-Step "Removing odcanit from Claude Desktop config"
    $configDir = Join-Path $env:APPDATA "Claude"
    $configPath = Join-Path $configDir "claude_desktop_config.json"

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

    $config.mcpServers.PSObject.Properties.Remove('odcanit')

    $json = $config | ConvertTo-Json -Depth 10
    [System.IO.File]::WriteAllText($configPath, $json, (New-Object System.Text.UTF8Encoding($false)))

    Write-Step "Done"
    Write-Host "Removed 'odcanit' from $configPath. Restart Claude Desktop to apply." -ForegroundColor Green
    exit 0
}

$repoRoot = Split-Path -Parent $PSScriptRoot

# 1. Check Node.js
Write-Step "Checking Node.js"
$nodeVersion = $null
try {
    $nodeVersion = (node --version) 2>$null
} catch {
    Fail "Node.js was not found. Install Node.js 18 or newer from https://nodejs.org and re-run this script."
}
$major = [int]($nodeVersion.TrimStart('v').Split('.')[0])
if ($major -lt 18) {
    Fail "Node.js $nodeVersion found, but 18+ is required. Install a newer version from https://nodejs.org."
}
Write-Host "Found Node.js $nodeVersion"

# 2. Install and build
Write-Step "Installing dependencies"
Push-Location $repoRoot
try {
    npm install
    if ($LASTEXITCODE -ne 0) { Fail "npm install failed." }

    Write-Step "Building the server"
    npm run build
    if ($LASTEXITCODE -ne 0) { Fail "npm run build failed." }
} finally {
    Pop-Location
}

# 3. Collect Odcanit SQL Server connection details
Write-Step "Odcanit SQL Server connection details"
Write-Host "Get these from whoever administers your Odcanit / SQL Server (usually your IT contact)."

$dbHost = Read-NonEmpty "SQL Server host"
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

$dbPort = Read-Port "Port" "1433"

$env:ODCANIT_DB_HOST = $dbHost
$env:ODCANIT_DB_NAME = $dbName
$env:ODCANIT_DB_USER = $dbUser
$env:ODCANIT_DB_PASSWORD = $dbPassword
$env:ODCANIT_DB_PORT = $dbPort

# 4. Test the connection
Write-Step "Testing the connection"
$testScript = Join-Path $repoRoot "scripts\test-connection.mjs"
node $testScript
if ($LASTEXITCODE -ne 0) {
    Fail "Could not connect to the database with the details provided. Double-check them and re-run this script."
}
Write-Host "Connection succeeded."

# 5. Write Claude Desktop config
Write-Step "Registering the server with Claude Desktop"
$configDir = Join-Path $env:APPDATA "Claude"
$configPath = Join-Path $configDir "claude_desktop_config.json"

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

$indexPath = Join-Path $repoRoot "dist\index.js"
$odcanitEntry = [PSCustomObject]@{
    command = "node"
    args    = @($indexPath)
    env     = [PSCustomObject]@{
        ODCANIT_DB_HOST     = $dbHost
        ODCANIT_DB_NAME     = $dbName
        ODCANIT_DB_USER     = $dbUser
        ODCANIT_DB_PASSWORD = $dbPassword
        ODCANIT_DB_PORT     = $dbPort
    }
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
