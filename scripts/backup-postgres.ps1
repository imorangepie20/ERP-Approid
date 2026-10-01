#requires -Version 5.1

<#
.SYNOPSIS
Creates a checksummed PostgreSQL custom-format backup from the Compose database.

.DESCRIPTION
Runs pg_dump inside the postgres Compose service and copies the binary dump to the
host without passing it through PowerShell's text pipeline. A SHA-256 sidecar file
is written next to the dump.

.PARAMETER OutputDirectory
Directory that receives the .dump and .sha256 files. Defaults to ./backups.

.PARAMETER Database
Database to back up. Defaults to POSTGRES_DB from the postgres service.

.PARAMETER DatabaseUser
Database role used by pg_dump. Defaults to POSTGRES_USER from the postgres service.

.PARAMETER DryRun
Validates the Compose service and prints the planned output without creating a backup.

.EXAMPLE
.\scripts\backup-postgres.ps1

.EXAMPLE
.\scripts\backup-postgres.ps1 -OutputDirectory D:\erp-backups
#>
[CmdletBinding()]
param(
    [string]$OutputDirectory = "",
    [string]$Database = "",
    [string]$DatabaseUser = "",
    [string]$EnvFile = "",
    [string[]]$ComposeArgs = @(),
    [string]$ProjectName = "",
    [string]$ComposeService = "postgres",
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
if (-not $OutputDirectory) {
    $OutputDirectory = Join-Path $repositoryRoot "backups"
}
$OutputDirectory = [IO.Path]::GetFullPath($OutputDirectory)

function Invoke-Compose {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    $baseArguments = @("compose")
    if ($ProjectName) {
        $baseArguments += @("--project-name", $ProjectName)
    }
    if ($EnvFile) {
        $baseArguments += @("--env-file", $EnvFile)
    }
    $baseArguments += $ComposeArgs

    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $output = & docker @baseArguments @Arguments 2>&1
        $exitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousPreference
    }
    if ($exitCode -ne 0) {
        throw "docker compose $($Arguments -join ' ') failed:`n$($output -join [Environment]::NewLine)"
    }
    return @($output | Where-Object { -not $_.ToString().StartsWith("WARNING:") })
}

function Invoke-Docker {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $output = & docker @Arguments 2>&1
        $exitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousPreference
    }
    if ($exitCode -ne 0) {
        throw "docker $($Arguments -join ' ') failed:`n$($output -join [Environment]::NewLine)"
    }
    return $output
}

function Get-ContainerEnvironmentValue {
    param([Parameter(Mandatory = $true)][string]$Name)

    $value = Invoke-Compose -Arguments @("exec", "-T", $ComposeService, "printenv", $Name) |
        Select-Object -Last 1
    if (-not $value -or -not $value.ToString().Trim()) {
        throw "Compose service '$ComposeService' does not define $Name."
    }
    return $value.ToString().Trim()
}

Push-Location $repositoryRoot
$containerBackupPath = ""
try {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw "Docker CLI is not available on PATH."
    }
    Invoke-Compose -Arguments @("config", "--quiet") | Out-Null

    $containerIdOutput = Invoke-Compose -Arguments @("ps", "--quiet", $ComposeService) |
        Select-Object -Last 1
    if (-not $containerIdOutput) {
        throw "Compose service '$ComposeService' is not running."
    }
    $containerId = $containerIdOutput.ToString().Trim()
    if (-not $Database) {
        $Database = Get-ContainerEnvironmentValue -Name "POSTGRES_DB"
    }
    if (-not $DatabaseUser) {
        $DatabaseUser = Get-ContainerEnvironmentValue -Name "POSTGRES_USER"
    }
    if ($Database -notmatch '^[A-Za-z0-9_.-]{1,63}$') {
        throw "Database must contain only letters, digits, dots, underscores, or hyphens (maximum 63 characters)."
    }
    if ($DatabaseUser -notmatch '^[A-Za-z0-9_.-]{1,63}$') {
        throw "DatabaseUser contains unsupported characters."
    }

    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $backupName = "$Database-$timestamp.dump"
    $backupPath = Join-Path $OutputDirectory $backupName
    $checksumPath = "$backupPath.sha256"

    if ($DryRun) {
        Write-Host "[DRY RUN] Would create PostgreSQL custom-format backup: $backupPath"
        Write-Host "[DRY RUN] Would create SHA-256 checksum: $checksumPath"
        return
    }

    $containerBackupPath = "/tmp/erp-approid-$([Guid]::NewGuid().ToString('N')).dump"
    New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
    Invoke-Compose -Arguments @(
        "exec", "-T", $ComposeService,
        "pg_dump", "-U", $DatabaseUser, "-d", $Database,
        "--format=custom", "--no-owner", "--no-privileges",
        "--file=$containerBackupPath"
    ) | Out-Null

    Invoke-Docker -Arguments @("cp", "${containerId}:$containerBackupPath", $backupPath) | Out-Null
    if (-not (Test-Path -LiteralPath $backupPath -PathType Leaf)) {
        throw "Backup copy did not create '$backupPath'."
    }
    $backupFile = Get-Item -LiteralPath $backupPath
    if ($backupFile.Length -le 0) {
        throw "Backup '$backupPath' is empty."
    }

    $hash = (Get-FileHash -LiteralPath $backupPath -Algorithm SHA256).Hash.ToLowerInvariant()
    Set-Content -LiteralPath $checksumPath -Value "$hash  $backupName" -Encoding Ascii

    Write-Host "[PASS] PostgreSQL backup created: $backupPath"
    Write-Host "[PASS] SHA-256 checksum created: $checksumPath"
    [pscustomobject]@{
        BackupFile = $backupPath
        ChecksumFile = $checksumPath
        Sha256 = $hash
        Database = $Database
        SizeBytes = $backupFile.Length
    }
}
finally {
    if ($containerBackupPath) {
        try {
            Invoke-Compose -Arguments @("exec", "-T", $ComposeService, "rm", "-f", $containerBackupPath) |
                Out-Null
        }
        catch {
            Write-Warning "Could not remove temporary container backup '$containerBackupPath': $($_.Exception.Message)"
        }
    }
    Pop-Location
}
