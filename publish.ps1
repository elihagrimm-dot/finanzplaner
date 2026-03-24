param(
  [string]$Message
)

$ErrorActionPreference = "Stop"

try {
  git rev-parse --is-inside-work-tree | Out-Null
} catch {
  Write-Host "Dieses Verzeichnis ist kein Git-Repository." -ForegroundColor Red
  exit 1
}

$changes = git status --porcelain
if (-not $changes) {
  Write-Host "Keine Aenderungen zum Veroeffentlichen." -ForegroundColor Yellow
  exit 0
}

if ([string]::IsNullOrWhiteSpace($Message)) {
  $Message = Read-Host "Commit-Nachricht"
}

if ([string]::IsNullOrWhiteSpace($Message)) {
  $Message = "Update " + (Get-Date -Format "yyyy-MM-dd HH:mm")
}

Write-Host "1/3: Aenderungen hinzufuegen..."
git add .

Write-Host "2/3: Commit erstellen..."
git commit -m "$Message"

Write-Host "3/3: Zu GitHub pushen..."
git push

Write-Host "Fertig. Deine Aenderungen sind online und Netlify deployed automatisch." -ForegroundColor Green
