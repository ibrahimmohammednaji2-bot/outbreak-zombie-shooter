# Keeps Zombie Attack reachable from the internet.
#
# Builds the game, serves it, opens a Cloudflare tunnel, and writes the public
# address to public-url.txt. If either process dies it cleans up and starts
# again, so a crash or a dropped connection recovers on its own.
#
# Note: a quick tunnel gets a NEW random address every time it starts, so the
# URL changes after a reboot. A fixed address needs a Cloudflare account and a
# named tunnel, or a host like Vercel.

$root = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $root

$log = Join-Path $root "online.log"
$tunnelLog = Join-Path $root "tunnel.log"
$urlFile = Join-Path $root "public-url.txt"

function Write-Log($msg) {
  "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $msg" | Out-File -Append -FilePath $log -Encoding utf8
}

function Clear-Port($port) {
  $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  foreach ($c in $conns) {
    Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue
  }
}

Write-Log "watchdog started"

while ($true) {
  try {
    Clear-Port 4173
    Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

    Write-Log "building"
    & npm run build 2>&1 | Out-File -Append -FilePath $log -Encoding utf8

    $preview = Start-Process -FilePath "cmd.exe" `
      -ArgumentList "/c npx vite preview --port 4173 --strictPort --host" `
      -PassThru -WindowStyle Hidden

    Start-Sleep -Seconds 6

    if (Test-Path $tunnelLog) { Remove-Item $tunnelLog -Force -ErrorAction SilentlyContinue }
    $tunnel = Start-Process -FilePath "cmd.exe" `
      -ArgumentList "/c npx --yes cloudflared tunnel --url http://localhost:4173 > `"$tunnelLog`" 2>&1" `
      -PassThru -WindowStyle Hidden

    # wait for the tunnel to publish an address
    $url = $null
    for ($i = 0; $i -lt 60 -and -not $url; $i++) {
      Start-Sleep -Seconds 2
      if (Test-Path $tunnelLog) {
        $hit = Select-String -Path $tunnelLog -Pattern "https://[a-z0-9-]+\.trycloudflare\.com" -AllMatches -ErrorAction SilentlyContinue
        if ($hit) { $url = $hit.Matches[0].Value }
      }
    }

    if ($url) {
      Set-Content -Path $urlFile -Value $url -Encoding utf8
      Write-Log "live at $url"
    } else {
      Write-Log "tunnel did not report an address; restarting"
    }

    # hold here until something falls over
    while (-not $preview.HasExited -and -not $tunnel.HasExited) { Start-Sleep -Seconds 10 }
    Write-Log "a process exited; cycling"

    foreach ($p in @($preview, $tunnel)) {
      if ($p -and -not $p.HasExited) { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue }
    }
  } catch {
    Write-Log "error: $($_.Exception.Message)"
  }

  Start-Sleep -Seconds 8
}
