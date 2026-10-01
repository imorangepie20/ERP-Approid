[CmdletBinding()]
param(
    [string]$BackendBaseUrl = "http://127.0.0.1:38080",
    [string]$FrontendBaseUrl = "http://127.0.0.1:3000",
    [string]$EnvFile = "",
    [string[]]$ComposeArgs = @(),
    [string]$ProjectName = ""
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$composeFile = Join-Path $repositoryRoot "docker-compose.yml"

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

    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $output = & docker @baseArguments @Arguments 2>&1
        $exitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }

    if ($exitCode -ne 0) {
        throw "docker compose $($Arguments -join ' ') failed:`n$($output -join [Environment]::NewLine)"
    }

    $warnings, $standardOutput = @($output).Where({ $_.ToString().StartsWith("WARNING:") }, "Split")
    foreach ($warning in $warnings) {
        Write-Warning $warning.ToString().Substring(8).Trim()
    }
    return $standardOutput
}

function Assert-Healthy {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Service
    )

    $containerIdOutput = Invoke-Compose -Arguments @("ps", "--quiet", $Service) | Select-Object -First 1
    if (-not $containerIdOutput) {
        throw "Compose service '$Service' is not running."
    }
    $containerId = $containerIdOutput.ToString().Trim()

    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $healthOutput = & docker inspect --format "{{.State.Health.Status}}" $containerId 2>&1
        $inspectExitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
    $health = ($healthOutput | Select-Object -Last 1).ToString().Trim()
    if ($inspectExitCode -ne 0 -or $health -ne "healthy") {
        throw "Compose service '$Service' is not healthy (status: '$health')."
    }
    Write-Host "[PASS] $Service is healthy"
}

Push-Location $repositoryRoot
try {
    if (-not (Test-Path -LiteralPath $composeFile -PathType Leaf)) {
        throw "Missing Compose file: $composeFile"
    }

    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        throw "Docker CLI is not available on PATH."
    }

    Invoke-Compose -Arguments @("config", "--quiet") | Out-Null
    Write-Host "[PASS] Compose configuration is valid"

    foreach ($service in @("postgres", "backend-spring", "frontend")) {
        Assert-Healthy -Service $service
    }

    $flywayQuery = 'SELECT COALESCE(MAX(version::integer), 0) FROM flyway_schema_history WHERE success = true;'
    $flywayVersion = (Invoke-Compose -Arguments @(
            "exec", "-T", "postgres", "sh", "-c",
            "psql -U `"`$POSTGRES_USER`" -d `"`$POSTGRES_DB`" -Atc '$flywayQuery'"
        ) | Select-Object -Last 1).Trim()
    if ($flywayVersion -ne "8") {
        throw "Expected Flyway version 8, received '$flywayVersion'."
    }
    Write-Host "[PASS] Flyway successfully applied through version 8"

    $healthResponse = Invoke-RestMethod `
        -Uri "$($BackendBaseUrl.TrimEnd('/'))/actuator/health" `
        -Method Get `
        -TimeoutSec 15
    if ($healthResponse.status -ne "UP") {
        throw "Actuator health did not report UP."
    }
    Write-Host "[PASS] Public Actuator health reported UP"

    $loginBody = @{ username = "admin"; password = "admin123" } | ConvertTo-Json
    $loginResponse = Invoke-RestMethod `
        -Uri "$($BackendBaseUrl.TrimEnd('/'))/api/core/auth/login" `
        -Method Post `
        -ContentType "application/json" `
        -Body $loginBody `
        -TimeoutSec 15
    if (-not $loginResponse.accessToken) {
        throw "Admin login response did not contain accessToken."
    }
    Write-Host "[PASS] Admin login returned an access token"

    $meResponse = Invoke-RestMethod `
        -Uri "$($BackendBaseUrl.TrimEnd('/'))/api/core/auth/me" `
        -Method Get `
        -Headers @{ Authorization = "Bearer $($loginResponse.accessToken)" } `
        -TimeoutSec 15
    if ($meResponse.username -ne "admin" -or -not ($meResponse.roles -contains "ADMIN")) {
        throw "Authenticated user response did not match the admin account."
    }
    Write-Host "[PASS] Authenticated /auth/me returned the current admin user"

    $metricsResponse = Invoke-RestMethod `
        -Uri "$($BackendBaseUrl.TrimEnd('/'))/actuator/metrics" `
        -Method Get `
        -Headers @{ Authorization = "Bearer $($loginResponse.accessToken)" } `
        -TimeoutSec 15
    if (-not $metricsResponse.names -or -not ($metricsResponse.names -contains "jvm.memory.used")) {
        throw "Actuator metrics response did not contain expected JVM metrics."
    }
    Write-Host "[PASS] ADMIN token can access Actuator metrics"

    $frontendResponse = Invoke-WebRequest `
        -Uri "$($FrontendBaseUrl.TrimEnd('/'))/" `
        -Method Get `
        -TimeoutSec 15 `
        -UseBasicParsing
    if ($frontendResponse.StatusCode -ne 200) {
        throw "Expected frontend HTTP 200, received $($frontendResponse.StatusCode)."
    }
    Write-Host "[PASS] Frontend returned HTTP 200"

    Write-Host "Local Compose smoke verification passed."
}
finally {
    Pop-Location
}
