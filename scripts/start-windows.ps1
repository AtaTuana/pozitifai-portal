# start.bat entry point. Windows PowerShell 5.1 compatible; no global policy changes.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$portalArguments = @($args)
$portalRoot = Split-Path -Parent $PSScriptRoot

try {
    foreach ($argument in $portalArguments) {
        if ($argument -notin @('--no-open', '--prepare-only', '--configure', '--check-tools')) {
            throw '[START004] Secenekler: --no-open, --prepare-only, --configure, --check-tools.'
        }
    }
    . (Join-Path $PSScriptRoot 'windows-runtimes.ps1')
    . (Join-Path $PSScriptRoot 'windows-settings.ps1')
    Write-Host 'PozitifAI Portal baslatiliyor...'
    $settings = Read-PortalConfiguration $portalRoot
    if (-not $env:PORTAL_PYTHON) {
        $configuredPython = Get-PortalSetting $settings 'PORTAL_PYTHON'
        if ($configuredPython) { $env:PORTAL_PYTHON = $configuredPython }
    }
    $tools = Ensure-PortalRuntimes -Root $portalRoot -CheckOnly:('--check-tools' -in $portalArguments)
    if ('--check-tools' -in $portalArguments) { exit 0 }
    Set-Location -LiteralPath $portalRoot
    if ('--prepare-only' -notin $portalArguments) {
        Initialize-PortalSettings -Root $portalRoot -Node $tools.Node -Settings $settings -Configure:('--configure' -in $portalArguments)
    }
    $nodeArguments = @($portalArguments | Where-Object { $_ -in @('--no-open', '--prepare-only') })
    & $tools.Node (Join-Path $PSScriptRoot 'start.mjs') @nodeArguments
    exit $LASTEXITCODE
} catch {
    $message = $_.Exception.Message
    if ($message -match '^\[(START\d+|LLM\d+)\]') { Write-Host $message -ForegroundColor Red }
    else { Write-Host '[START013] Baslatma tamamlanamadi. Interneti, klasor erisimini ve Windows izinlerini kontrol edin. docs/troubleshooting.md dosyasini inceleyin.' -ForegroundColor Red }
    exit 1
}
