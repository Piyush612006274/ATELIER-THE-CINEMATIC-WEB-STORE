param(
  [string]$ArchivePath = (Join-Path $PSScriptRoot 'ATELIER_V21_source.zip')
)

$ErrorActionPreference = 'Stop'
$root = [System.IO.Path]::GetFullPath($PSScriptRoot)
$watcher = [System.IO.FileSystemWatcher]::new($root)
$watcher.IncludeSubdirectories = $true
$watcher.NotifyFilter = [System.IO.NotifyFilters]::FileName -bor [System.IO.NotifyFilters]::LastWrite -bor [System.IO.NotifyFilters]::DirectoryName
$watcher.EnableRaisingEvents = $true
$script:pending = $false
$script:lastChange = [DateTime]::UtcNow
$script:archive = $ArchivePath

$onChange = {
  $changedPath = $Event.SourceEventArgs.FullPath
  if ($changedPath -notmatch '[\\/](\.git|\.next|node_modules|dist|build|coverage|\.turbo|\.cache|\.vercel|\.output|browser-qa-results)([\\/]|$)' -and
      $changedPath -notmatch '\.(zip|log|tsbuildinfo)$' -and
      [System.IO.Path]::GetFileName($changedPath) -notin @('update-project-zip.ps1', 'watch-project-zip.ps1')) {
    $script:pending = $true
    $script:lastChange = [DateTime]::UtcNow
  }
}

$subscriptions = @(
  Register-ObjectEvent $watcher Created -Action $onChange
  Register-ObjectEvent $watcher Changed -Action $onChange
  Register-ObjectEvent $watcher Deleted -Action $onChange
  Register-ObjectEvent $watcher Renamed -Action $onChange
)
Write-Output "Watching $root; updating $ArchivePath"
try {
  while ($true) {
    Start-Sleep -Milliseconds 750
    if ($script:pending -and ([DateTime]::UtcNow - $script:lastChange).TotalSeconds -ge 2) {
      $script:pending = $false
      try {
        & (Join-Path $root 'update-project-zip.ps1') -ArchivePath $script:archive | Out-Null
      } catch {
        Start-Sleep -Seconds 2
        $script:pending = $true
        $script:lastChange = [DateTime]::UtcNow.AddSeconds(-3)
      }
    }
  }
} finally {
  $watcher.EnableRaisingEvents = $false
  $subscriptions | ForEach-Object { Unregister-Event -SubscriptionId $_.Id -ErrorAction SilentlyContinue }
  $watcher.Dispose()
}
