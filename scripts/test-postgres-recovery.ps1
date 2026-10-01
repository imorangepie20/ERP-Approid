#requires -Version 5.1

<#
.SYNOPSIS
Runs an isolated PostgreSQL backup and recovery drill against the Compose database.

.DESCRIPTION
Creates a temporary custom-format backup, restores it into a uniquely named temporary
database, verifies Flyway V8 plus core table accessibility and row counts, and always
drops the temporary database in a finally block.

.PARAMETER ExpectedFlywayVersion
Flyway version that must exist successfully in the restored schema. Defaults to 8.

.PARAMETER DryRun
Prints the isolated drill plan without creating a backup or database.

.EXAMPLE
.\scripts\test-postgres-recovery.ps1
#>
[CmdletBinding()]
param(
    [string]$ExpectedFlywayVersion = "8",
    [string]$EnvFile = "",
    [string[]]$ComposeArgs = @(),
    [string]$ProjectName = "",
    [string]$ComposeService = "postgres",
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$backupScript = Join-Path $PSScriptRoot "backup-postgres.ps1"
$restoreScript = Join-Path $PSScriptRoot "restore-postgres.ps1"

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
$temporaryDirectory = ""
$temporaryDatabase = ""
$databaseUser = ""
try {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw "Docker CLI is not available on PATH."
    }
    Invoke-Compose -Arguments @("config", "--quiet") | Out-Null
    $sourceDatabase = Get-ContainerEnvironmentValue -Name "POSTGRES_DB"
    $databaseUser = Get-ContainerEnvironmentValue -Name "POSTGRES_USER"
    $suffix = [Guid]::NewGuid().ToString("N").Substring(0, 8)
    $temporaryDatabase = "erp_recovery_drill_$(Get-Date -Format 'yyyyMMddHHmmss')_$suffix"

    if ($DryRun) {
        Write-Host "[DRY RUN] Would back up '$sourceDatabase' in PostgreSQL custom format with SHA-256."
        Write-Host "[DRY RUN] Would restore into isolated database '$temporaryDatabase'."
        Write-Host "[DRY RUN] Would verify Flyway V$ExpectedFlywayVersion and core table row counts."
        Write-Host "[DRY RUN] Would drop '$temporaryDatabase' in a finally block."
        return
    }

    $temporaryDirectory = Join-Path ([IO.Path]::GetTempPath()) "erp-approid-recovery-$suffix"
    New-Item -ItemType Directory -Path $temporaryDirectory -Force | Out-Null

    $sharedParameters = @{
        EnvFile = $EnvFile
        ComposeArgs = $ComposeArgs
        ProjectName = $ProjectName
        ComposeService = $ComposeService
    }
    $backupResult = & $backupScript @sharedParameters -OutputDirectory $temporaryDirectory |
        Select-Object -Last 1
    if (-not $backupResult -or -not $backupResult.BackupFile) {
        throw "Backup script did not return a backup file."
    }

    $restoreResult = & $restoreScript @sharedParameters `
        -BackupFile $backupResult.BackupFile `
        -ChecksumFile $backupResult.ChecksumFile `
        -TargetDatabase $temporaryDatabase |
        Select-Object -Last 1
    if (-not $restoreResult -or $restoreResult.TargetDatabase -ne $temporaryDatabase) {
        throw "Restore script did not restore the expected temporary database."
    }

    $flywayQuery = "SELECT CASE WHEN EXISTS (SELECT 1 FROM flyway_schema_history WHERE version = '$ExpectedFlywayVersion' AND success = true) THEN 'ok' ELSE 'missing' END;"
    $flywayResult = (Invoke-Compose -Arguments @(
            "exec", "-T", $ComposeService,
            "psql", "-U", $databaseUser, "-d", $temporaryDatabase, "-Atc", $flywayQuery
        ) | Select-Object -Last 1).ToString().Trim()
    if ($flywayResult -ne "ok") {
        throw "Restored database does not contain successful Flyway version $ExpectedFlywayVersion."
    }
    Write-Host "[PASS] Restored database contains successful Flyway V$ExpectedFlywayVersion"

    $rowCountQuery = @(
        "SELECT 'roles', count(*) FROM roles"
        "UNION ALL SELECT 'users', count(*) FROM users"
        "UNION ALL SELECT 'items', count(*) FROM items"
        "UNION ALL SELECT 'partners', count(*) FROM partners"
        "UNION ALL SELECT 'sales_orders', count(*) FROM sales_orders"
        "UNION ALL SELECT 'work_orders', count(*) FROM work_orders"
        "UNION ALL SELECT 'purchase_orders', count(*) FROM purchase_orders"
        "UNION ALL SELECT 'inventory_transactions', count(*) FROM inventory_transactions"
        "UNION ALL SELECT 'audit_logs', count(*) FROM audit_logs"
        "ORDER BY 1;"
    ) -join " "
    $rowCountOutput = @(Invoke-Compose -Arguments @(
            "exec", "-T", $ComposeService,
            "psql", "-U", $databaseUser, "-d", $temporaryDatabase,
            "-At", "-F", "|", "-c", $rowCountQuery
        ))
    if ($rowCountOutput.Count -ne 9) {
        throw "Expected row counts for 9 core tables, received $($rowCountOutput.Count)."
    }
    $counts = @{}
    foreach ($line in $rowCountOutput) {
        $parts = $line.ToString().Trim() -split '\|', 2
        if ($parts.Count -ne 2 -or $parts[1] -notmatch '^\d+$') {
            throw "Unexpected core table row-count output: '$line'."
        }
        $counts[$parts[0]] = [long]$parts[1]
        Write-Host "[PASS] $($parts[0]) readable; rows=$($parts[1])"
    }
    if ($counts["roles"] -lt 1 -or $counts["users"] -lt 1) {
        throw "Restored database is missing required role or user seed rows."
    }

    Write-Host "PostgreSQL recovery drill passed for isolated database '$temporaryDatabase'."
}
finally {
    if (-not $DryRun -and $temporaryDatabase -and $databaseUser) {
        try {
            Invoke-Compose -Arguments @(
                "exec", "-T", $ComposeService,
                "dropdb", "-U", $databaseUser, "--if-exists", "--force", $temporaryDatabase
            ) | Out-Null
            Write-Host "[PASS] Removed recovery drill database '$temporaryDatabase'"
        }
        catch {
            Write-Warning "Could not remove recovery drill database '$temporaryDatabase': $($_.Exception.Message)"
        }
    }
    if ($temporaryDirectory -and (Test-Path -LiteralPath $temporaryDirectory)) {
        Remove-Item -LiteralPath $temporaryDirectory -Recurse -Force
    }
    Pop-Location
}
