$ErrorActionPreference = 'Stop'

$composeFile = Join-Path $PSScriptRoot 'compose.yml'
$envFile = Join-Path $PSScriptRoot '.env'

function New-HexSecret {
    param([int]$ByteCount = 32)
    $bytes = New-Object byte[] $ByteCount
    $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $generator.GetBytes($bytes)
    } finally {
        $generator.Dispose()
    }
    return [BitConverter]::ToString($bytes).Replace('-', '').ToLowerInvariant()
}

if (-not (Test-Path $envFile)) {
    @(
        "POSTGRES_PASSWORD=$(New-HexSecret)"
        "MINIO_ROOT_USER=$(New-HexSecret -ByteCount 12)"
        "MINIO_ROOT_PASSWORD=$(New-HexSecret)"
        "JWT_SECRET=$(New-HexSecret)"
    ) | Set-Content -Path $envFile -Encoding Ascii
    Write-Host "Created isolated test credentials in $envFile"
}

docker compose version | Out-Host
if ($LASTEXITCODE -ne 0) { throw 'Docker Compose is unavailable. Install or start Docker Desktop first.' }

docker compose -p yclawhubtest --env-file $envFile -f $composeFile up --build -d
if ($LASTEXITCODE -ne 0) { throw 'Docker Compose startup failed.' }

docker compose -p yclawhubtest --env-file $envFile -f $composeFile ps
if ($LASTEXITCODE -ne 0) { throw 'Cannot read Docker Compose status.' }

$healthy = $false
for ($attempt = 0; $attempt -lt 40; $attempt++) {
    try {
        $response = Invoke-WebRequest -Uri 'http://localhost:18080/api/v1/health' -UseBasicParsing -TimeoutSec 3
        if ($response.StatusCode -eq 200) {
            $healthy = $true
            break
        }
    } catch {
        Start-Sleep -Seconds 3
    }
}
if (-not $healthy) {
    throw 'Backend health check did not pass. Inspect: docker compose -p yclawhubtest --env-file deploy/windows-test/.env -f deploy/windows-test/compose.yml logs backend schema-upgrade migrate'
}

Write-Host 'Frontend: http://localhost:13000'
Write-Host 'Backend health: http://localhost:18080/api/v1/health'
Write-Host 'MinIO console: http://localhost:19001'
