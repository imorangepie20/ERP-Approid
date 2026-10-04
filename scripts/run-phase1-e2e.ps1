param([switch]$Build, [switch]$KeepStack)

$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
# CLI project name takes precedence over COMPOSE_PROJECT_NAME in the developer's .env.
$compose = @('compose', '--project-name', 'erp-approid-e2e', '-f', (Join-Path $repo 'docker-compose.e2e.yml'))
$previousIsolation = $env:E2E_ISOLATED
$previousOutputEncoding = $OutputEncoding
function Invoke-DockerChecked([string[]]$Arguments) {
    & docker @compose @Arguments
    if ($LASTEXITCODE -ne 0) { throw "E2E Docker command failed ($LASTEXITCODE)" }
}
Push-Location $repo
try {
    $configText = & docker @compose config --format json
    if ($LASTEXITCODE -ne 0) { throw 'Cannot resolve E2E Compose configuration' }
    $config = $configText | ConvertFrom-Json
    if ($config.name -ne 'erp-approid-e2e' -or
        $config.services.'backend-spring'.environment.DB_NAME -ne 'erp_approid_e2e' -or
        $config.services.postgres.ports -or $config.services.postgres.volumes -or
        -not $config.services.postgres.tmpfs) { throw 'E2E stack is not isolated' }
    $imageOption = if ($Build) { '--build' } else { '--no-build' }
    Invoke-DockerChecked -Arguments @('up', '-d', $imageOption, '--wait', '--wait-timeout', '240')
    $OutputEncoding = [Text.UTF8Encoding]::new($false)
    Get-Content -Raw -Encoding UTF8 (Join-Path $repo 'scripts/e2e-users.sql') |
        & docker @compose exec -T postgres psql -U erp -d erp_approid_e2e -v ON_ERROR_STOP=1
    if ($LASTEXITCODE -ne 0) { throw 'Isolated role fixture failed' }
    $version = & docker @compose exec -T postgres psql -U erp -d erp_approid_e2e -Atc 'select max(version::integer) from flyway_schema_history where success'
    if ($LASTEXITCODE -ne 0 -or "$version".Trim() -ne '15') { throw 'Expected Flyway V15' }
    Set-Location (Join-Path $repo 'hud-admin-template')
    $env:E2E_ISOLATED = 'true'
    & npm.cmd run test:e2e:types
    if ($LASTEXITCODE -ne 0) { throw 'E2E TypeScript failed' }
    & npm.cmd run test:e2e
    if ($LASTEXITCODE -ne 0) { throw 'Phase 1 browser checks failed; inspect playwright-report and test-results' }
} finally {
    $env:E2E_ISOLATED = $previousIsolation
    $OutputEncoding = $previousOutputEncoding
    Pop-Location
    if (-not $KeepStack) {
        # Only ephemeral test containers/storage are removed; never development volumes.
        & docker @compose down
        if ($LASTEXITCODE -ne 0) { Write-Warning 'Isolated E2E cleanup failed' }
    }
}
