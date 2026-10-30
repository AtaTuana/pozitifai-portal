# Interactive first-run settings. Credentials are read only when actually missing.
Set-StrictMode -Version Latest

function Read-PortalConfiguration {
    param([string]$Root)
    $path = Join-Path $Root '.local\runtime.json'
    if (-not (Test-Path -LiteralPath $path)) { return @{} }
    try {
        $document = Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($document.version -ne 1 -or $document.settings -isnot [PSCustomObject]) { throw 'Invalid configuration' }
        $settings = @{}
        foreach ($property in $document.settings.PSObject.Properties) {
            if ($property.Value -isnot [string]) { throw 'Invalid setting' }
            $settings[$property.Name] = $property.Value
        }
        return $settings
    } catch {
        throw '[START009] .local/runtime.json okunamadi. Dosya bicimini kontrol edin; gizli icerigini paylasmayin.'
    }
}

function Get-PortalSetting {
    param([hashtable]$Settings, [string]$Name)
    $value = [Environment]::GetEnvironmentVariable($Name, 'Process')
    if ($null -ne $value) { return $value }
    if ($Settings.ContainsKey($Name)) { return $Settings[$Name] }
    return ''
}

function Read-PortalField {
    param([string]$Label, [string]$Current, [switch]$Secret, [switch]$Optional)
    while ($true) {
        $prompt = $Label
        if ($Current) { $prompt += ' (Enter: mevcut degeri koru)' }
        elseif ($Optional) { $prompt += ' (Enter: simdilik atla)' }
        if ($Secret) {
            $secure = Read-Host $prompt -AsSecureString
            try { $value = [Net.NetworkCredential]::new('', $secure).Password }
            finally { $secure.Dispose() }
        } else {
            $value = (Read-Host $prompt).Trim()
        }
        if (-not $value) { $value = $Current }
        if ($value -or $Optional) { return $value }
        Write-Host 'Bu alan gerekli. Neon baglanti ekranindaki degeri girin.'
    }
}

function Initialize-PortalSettings {
    param([string]$Root, [string]$Node, [hashtable]$Settings, [switch]$Configure)
    Write-Host 'Neon veritabani ayarlari kontrol ediliyor...'
    $labels = [ordered]@{
        PGHOST = 'Neon Host (yalniz sunucu adi, baglanti URLsi degil)'
        PGDATABASE = 'Neon Database'
        PGUSER = 'Neon Role / User'
        PGPASSWORD = 'Neon veritabani sifresi'
    }
    foreach ($entry in $labels.GetEnumerator()) {
        $value = Get-PortalSetting $Settings $entry.Key
        if ($Configure -or -not $value) {
            $value = Read-PortalField -Label $entry.Value -Current $value -Secret:($entry.Key -eq 'PGPASSWORD')
        }
        [Environment]::SetEnvironmentVariable($entry.Key, $value, 'Process')
    }
    if ($env:PGHOST -notmatch '^[a-zA-Z0-9][a-zA-Z0-9.\-]*$') {
        throw '[START012] Host alanina tam URL veya psql komutu degil, yalniz Neon sunucu adini girin.'
    }
    $defaults = @{ PGPORT = '5432'; PGSSLMODE = 'require'; PGCHANNELBINDING = 'require'; PGCONNECT_TIMEOUT = '15' }
    foreach ($entry in $defaults.GetEnumerator()) {
        $value = Get-PortalSetting $Settings $entry.Key
        if (-not $value) { $value = $entry.Value }
        [Environment]::SetEnvironmentVariable($entry.Key, $value, 'Process')
    }
    $key = Get-PortalSetting $Settings 'OPENAI_API_KEY'
    if ($Configure -or -not $key) {
        Write-Host 'OpenAI anahtari ret analizi icindir. Anahtar yoksa portal yine acilir.'
        $key = Read-PortalField -Label 'OpenAI API anahtari' -Current $key -Secret -Optional
    }
    [Environment]::SetEnvironmentVariable('OPENAI_API_KEY', $key.Trim(), 'Process')
    $model = Get-PortalSetting $Settings 'OPENAI_MODEL'
    if (-not $model) { $model = 'gpt-6-luna' }
    [Environment]::SetEnvironmentVariable('OPENAI_MODEL', $model, 'Process')
    & $Node (Join-Path $Root 'scripts\setup-local.mjs') | Out-Host
    if ($LASTEXITCODE -ne 0) { throw '[START009] Ayarlar kaydedilemedi. Yukaridaki aciklamayi kontrol edin.' }
    Write-Host 'Neon baglantisi kullanilacak. Mevcut portal hesabinla giris yapabilirsin.'
}
