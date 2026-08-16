param(
  [string]$BaseUrl = "http://localhost:4000"
)

$response = Invoke-WebRequest -Uri "$BaseUrl/api/health/ready" -UseBasicParsing -TimeoutSec 10
if ($response.StatusCode -ne 200) { throw "Readiness check failed with HTTP $($response.StatusCode)" }
$payload = $response.Content | ConvertFrom-Json
if ($payload.status -ne "ready" -or -not $payload.checks.database) { throw "Readiness payload is not healthy" }
Write-Output "EVOQ readiness: ready"
