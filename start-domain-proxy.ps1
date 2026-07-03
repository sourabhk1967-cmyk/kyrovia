$repo = Split-Path -Parent $MyInvocation.MyCommand.Path
$caddy = (Get-Command caddy -ErrorAction SilentlyContinue).Source
$wingetCaddy = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Links\caddy.exe'

if (-not $caddy -and (Test-Path -LiteralPath $wingetCaddy)) {
  $caddy = $wingetCaddy
}

if (-not $caddy) {
  Write-Error "Caddy is not installed. Install it with: winget install CaddyServer.Caddy"
  exit 1
}

Set-Location $repo
& $caddy run --config "$repo\Caddyfile" --adapter caddyfile
