$repo = Split-Path -Parent $PSScriptRoot
$node = (Get-Command node -ErrorAction Stop).Source
$stdout = Join-Path $PSScriptRoot 'kyrovia-supervisor-launch.out.log'
$stderr = Join-Path $PSScriptRoot 'kyrovia-supervisor-launch.err.log'

Start-Process `
  -FilePath $node `
  -ArgumentList '.tunnel\start-kyrovia-supervisor.js' `
  -WorkingDirectory $repo `
  -WindowStyle Hidden `
  -RedirectStandardOutput $stdout `
  -RedirectStandardError $stderr
