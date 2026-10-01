#requires -Version 5.1

<#
.SYNOPSIS
Safely restores a checksummed PostgreSQL custom-format backup into Compose.

.DESCRIPTION
The default target is a newly named database. Existing databases are never replaced
unless -ReplaceTargetDatabase is supplied. Restoring over POSTGRES_DB additionally
requires -AllowSourceDatabaseOverwrite, making live/source replacement an explicit
two-switch operation.

.PARAMETER BackupFile
Path to a pg_dump custom-format .dump file.

.PARAMETER TargetDatabase
New database name. Defaults to <source>_restore_<timestamp>_<suffix>.

.PARAMETER ReplaceTargetDatabase
Drops an existing target before restore.

.PARAMETER AllowSourceDatabaseOverwrite
Allows TargetDatabase to equal the Compose POSTGRES_DB. This switch alone does not
drop anything; -ReplaceTargetDatabase is also required when the source exists.

.PARAMETER SkipChecksumVerification
Explicitly permits restore without a valid SHA-256 sidecar. Avoid in routine operation.

.PARAMETER DryRun
Validates input and safety gates, then prints the planned restore without mutation.

.EXAMPLE
.\scripts\restore-postgres.ps1 -BackupFile .\backups\erp_approid-20261001-120000.dump
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$BackupFile,
    [string]$ChecksumFile = "",
    [string]$TargetDatabase = "",
    [string]$DatabaseUser = "",
    [string]$EnvFile = "",
    [string[]]$ComposeArgs = @(),
    [string]$ProjectName = "",
    [string]$ComposeService = "postgres",
    [string]$ApplicationService = "backend-spring",
    [switch]$ReplaceTargetDatabase,
    [switch]$AllowSourceDatabaseOverwrite,
    [switch]$SkipChecksumVerification,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

function Invoke-Compose {
    param([Parameter(Mandatory = $true)][string[]]$Arguments)

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
    param([Parameter(Mandatory = $true)][string[]]$Arguments)

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

function Assert-SafeDatabaseName {
    param([Parameter(Mandatory = $true)][string]$Name)

    if ($Name -notmatch '^[A-Za-z][A-Za-z0-9_]{0,62}$') {
        throw "Database name '$Name' is unsafe. Use a leading letter followed by letters, digits, or underscores (maximum 63 characters)."
    }
}

Push-Location $repositoryRoot
$containerBackupPath = ""
$createdTarget = $false
$restoreCompleted = $false
$isSourceTarget = $false
try {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw "Docker CLI is not available on PATH."
    }
    $BackupFile = (Resolve-Path -LiteralPath $BackupFile).Path
    if (-not $ChecksumFile) {
        $ChecksumFile = "$BackupFile.sha256"
    }

    if (-not $SkipChecksumVerification) {
        if (-not (Test-Path -LiteralPath $ChecksumFile -PathType Leaf)) {
            throw "Checksum file '$ChecksumFile' is required. Use -SkipChecksumVerification only for an explicitly accepted exception."
        }
        $checksumText = (Get-Content -LiteralPath $ChecksumFile -Raw).Trim()
        $expectedHash = ($checksumText -split '\s+')[0].ToLowerInvariant()
        if ($expectedHash -notmatch '^[a-f0-9]{64}$') {
            throw "Checksum file '$ChecksumFile' does not start with a valid SHA-256 hash."
        }
        $actualHash = (Get-FileHash -LiteralPath $BackupFile -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($actualHash -ne $expectedHash) {
            throw "SHA-256 verification failed for '$BackupFile'."
        }
        Write-Host "[PASS] SHA-256 checksum verified"
    }

    Invoke-Compose -Arguments @("config", "--quiet") | Out-Null
    $containerIdOutput = Invoke-Compose -Arguments @("ps", "--quiet", $ComposeService) |
        Select-Object -Last 1
    if (-not $containerIdOutput) {
        throw "Compose service '$ComposeService' is not running."
    }
    $containerId = $containerIdOutput.ToString().Trim()
    # The protected/live database identity must always come from the running
    # service. Never accept it from a caller because that would let a caller
    # disguise the live target and bypass the two-switch overwrite gate.
    $SourceDatabase = Get-ContainerEnvironmentValue -Name "POSTGRES_DB"
    if (-not $DatabaseUser) {
        $DatabaseUser = Get-ContainerEnvironmentValue -Name "POSTGRES_USER"
    }
    Assert-SafeDatabaseName -Name $SourceDatabase
    if ($DatabaseUser -notmatch '^[A-Za-z0-9_.-]{1,63}$') {
        throw "DatabaseUser contains unsupported characters."
    }
    if (-not $TargetDatabase) {
        $suffix = [Guid]::NewGuid().ToString("N").Substring(0, 6)
        $baseName = $SourceDatabase
        if ($baseName.Length -gt 29) {
            $baseName = $baseName.Substring(0, 29)
        }
        $TargetDatabase = "${baseName}_restore_$(Get-Date -Format 'yyyyMMddHHmmss')_$suffix"
    }
    Assert-SafeDatabaseName -Name $TargetDatabase

    $isSourceTarget = $TargetDatabase.Equals($SourceDatabase, [StringComparison]::OrdinalIgnoreCase)
    if ($isSourceTarget -and -not $AllowSourceDatabaseOverwrite) {
        throw "Refusing to restore over source database '$SourceDatabase'. Supply -AllowSourceDatabaseOverwrite and -ReplaceTargetDatabase only during an approved recovery."
    }

    $existsQuery = "SELECT 1 FROM pg_database WHERE datname = '$TargetDatabase';"
    $existsResult = Invoke-Compose -Arguments @(
            "exec", "-T", $ComposeService,
            "psql", "-U", $DatabaseUser, "-d", "postgres", "-Atc", $existsQuery
        ) | Select-Object -Last 1
    $exists = $null -ne $existsResult -and $existsResult.ToString().Trim() -eq "1"
    if ($exists -and -not $ReplaceTargetDatabase) {
        throw "Target database '$TargetDatabase' already exists. Choose a new name or explicitly supply -ReplaceTargetDatabase."
    }
    if ($isSourceTarget -and $exists -and -not ($AllowSourceDatabaseOverwrite -and $ReplaceTargetDatabase)) {
        throw "Source database overwrite requires both -AllowSourceDatabaseOverwrite and -ReplaceTargetDatabase."
    }

    if ($DryRun) {
        Write-Host "[DRY RUN] Backup: $BackupFile"
        Write-Host "[DRY RUN] Target database: $TargetDatabase"
        Write-Host "[DRY RUN] Existing target would be replaced: $($exists -and $ReplaceTargetDatabase)"
        return
    }

    if ($isSourceTarget) {
        $runningApplication = Invoke-Compose -Arguments @("ps", "--quiet", $ApplicationService) |
            Select-Object -Last 1
        if ($runningApplication -and $runningApplication.ToString().Trim()) {
            throw "Refusing source restore while application service '$ApplicationService' is running. Stop application writes before approved recovery."
        }
    }

    if ($exists) {
        Invoke-Compose -Arguments @(
            "exec", "-T", $ComposeService,
            "dropdb", "-U", $DatabaseUser, "--if-exists", "--force", $TargetDatabase
        ) | Out-Null
    }
    Invoke-Compose -Arguments @(
        "exec", "-T", $ComposeService,
        "createdb", "-U", $DatabaseUser, "--template=template0", $TargetDatabase
    ) | Out-Null
    $createdTarget = $true

    $containerBackupPath = "/tmp/erp-approid-restore-$([Guid]::NewGuid().ToString('N')).dump"
    Invoke-Docker -Arguments @("cp", $BackupFile, "${containerId}:$containerBackupPath") | Out-Null
    Invoke-Compose -Arguments @(
        "exec", "-T", $ComposeService,
        "pg_restore", "-U", $DatabaseUser, "--dbname=$TargetDatabase",
        "--no-owner", "--no-privileges", "--exit-on-error", "--single-transaction",
        $containerBackupPath
    ) | Out-Null
    $restoreCompleted = $true

    Write-Host "[PASS] Restored backup into isolated database '$TargetDatabase'"
    [pscustomobject]@{
        BackupFile = $BackupFile
        TargetDatabase = $TargetDatabase
        SourceDatabase = $SourceDatabase
    }
}
finally {
    if ($containerBackupPath) {
        try {
            Invoke-Compose -Arguments @("exec", "-T", $ComposeService, "rm", "-f", $containerBackupPath) |
                Out-Null
        }
        catch {
            Write-Warning "Could not remove temporary restore file '$containerBackupPath': $($_.Exception.Message)"
        }
    }
    if ($createdTarget -and -not $restoreCompleted -and -not $isSourceTarget) {
        try {
            Invoke-Compose -Arguments @(
                "exec", "-T", $ComposeService,
                "dropdb", "-U", $DatabaseUser, "--if-exists", "--force", $TargetDatabase
            ) | Out-Null
            Write-Warning "Removed incomplete restore database '$TargetDatabase'."
        }
        catch {
            Write-Warning "Could not remove incomplete restore database '$TargetDatabase': $($_.Exception.Message)"
        }
    }
    Pop-Location
}
