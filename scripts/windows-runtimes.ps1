# Runtime discovery and installation only. Dot-sourcing this file installs nothing.
Set-StrictMode -Version Latest

function Update-PortalPath {
    $paths = @($env:Path, [Environment]::GetEnvironmentVariable('Path', 'Machine'), [Environment]::GetEnvironmentVariable('Path', 'User'))
    $env:Path = ($paths | Where-Object { $_ }) -join ';'
}

function Invoke-PortalProbe {
    param([string]$Executable, [string]$Arguments)
    # Never open Store aliases or wait indefinitely for a broken runtime.
    if (-not $Executable -or $Executable -match '\\WindowsApps\\') { return $null }
    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = New-Object System.Diagnostics.ProcessStartInfo
    $process.StartInfo.FileName = $Executable
    $process.StartInfo.Arguments = $Arguments
    $process.StartInfo.UseShellExecute = $false
    $process.StartInfo.CreateNoWindow = $true
    $process.StartInfo.RedirectStandardOutput = $true
    $process.StartInfo.RedirectStandardError = $true
    try {
        if (-not $process.Start()) { return $null }
        $output = $process.StandardOutput.ReadToEndAsync()
        $errors = $process.StandardError.ReadToEndAsync()
        if (-not $process.WaitForExit(5000)) {
            $process.Kill()
            return $null
        }
        if ($process.ExitCode -eq 0) { return $output.Result.Trim() }
    } catch {
        return $null
    } finally {
        $process.Dispose()
    }
    return $null
}

function Find-PortalNode {
    $candidates = @((Get-Command node.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Source))
    foreach ($folder in @($env:ProgramFiles, ${env:ProgramFiles(x86)}, $env:LOCALAPPDATA)) {
        if ($folder) { $candidates += Join-Path $folder 'nodejs\node.exe' }
    }
    foreach ($candidate in ($candidates | Where-Object { $_ } | Select-Object -Unique)) {
        $version = Invoke-PortalProbe $candidate '--version'
        if ($version -match '^v(\d+)\.(\d+)\.\d+$') {
            $major = [int]$Matches[1]
            $minor = [int]$Matches[2]
            if ($major -gt 22 -or ($major -eq 22 -and $minor -ge 12)) {
                $npm = Join-Path (Split-Path -Parent $candidate) 'npm.cmd'
                if (Test-Path -LiteralPath $npm -PathType Leaf) { return $candidate }
            }
        }
    }
    return $null
}

function Find-PortalPython {
    param([string]$Root)
    $probe = '-c "import sys, venv, ensurepip; print(sys.executable); sys.exit(0 if (3,11) <= sys.version_info[:2] < (3,15) else 1)"'
    $candidates = @($env:PORTAL_PYTHON)
    foreach ($name in @('python.exe', 'python3.exe')) {
        $candidates += Get-Command $name -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Source
    }
    foreach ($registry in @('HKCU:\Software\Python\PythonCore', 'HKLM:\Software\Python\PythonCore', 'HKLM:\Software\WOW6432Node\Python\PythonCore')) {
        foreach ($version in (Get-ChildItem -LiteralPath $registry -ErrorAction SilentlyContinue)) {
            $install = Get-Item -LiteralPath ($version.PSPath + '\InstallPath') -ErrorAction SilentlyContinue
            if ($install) {
                $folder = $install.GetValue('')
                if ($folder) { $candidates += Join-Path $folder 'python.exe' }
            }
        }
    }
    foreach ($candidate in ($candidates | Where-Object { $_ } | Select-Object -Unique)) {
        $result = Invoke-PortalProbe $candidate $probe
        if ($result -and (Test-Path -LiteralPath $result -PathType Leaf)) { return $result }
    }
    $launcher = Get-Command py.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($launcher) {
        foreach ($version in @('3.12', '3.13', '3.14', '3.11')) {
            $result = Invoke-PortalProbe $launcher.Source ("-$version " + $probe)
            if ($result -and (Test-Path -LiteralPath $result -PathType Leaf)) { return $result }
        }
    }
    # An existing working environment can start without reinstalling a global Python.
    $existing = Join-Path $Root '.venv\Scripts\python.exe'
    if (Invoke-PortalProbe $existing $probe) { return $existing }
    return $null
}

function Get-PortalWinget {
    Update-PortalPath
    $command = Get-Command winget.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($command) { return $command.Source }
    Write-Host 'Windows paket yoneticisi hazirlaniyor...'
    try {
        # Microsoft's documented bootstrap, restricted to the current user.
        [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
        Install-PackageProvider -Name NuGet -Scope CurrentUser -Force -ErrorAction Stop | Out-Null
        Install-Module -Name Microsoft.WinGet.Client -Repository PSGallery -Scope CurrentUser -Force -ErrorAction Stop | Out-Null
        Import-Module Microsoft.WinGet.Client -ErrorAction Stop
        Repair-WinGetPackageManager -ErrorAction Stop | Out-Null
        Update-PortalPath
        $command = Get-Command winget.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($command) { return $command.Source }
    } catch {
        # Do not bypass machine policies or dump package-manager exception details.
    }
    throw '[START010] Windows paket yoneticisi hazirlanamadi. Interneti ve kurum izinlerini kontrol edin; gerekirse Microsoft App Installer kurulumunu tamamlayip yeniden acin.'
}

function Install-PortalRuntime {
    param([ValidateSet('node', 'python')][string]$Kind)
    $winget = Get-PortalWinget
    $package = if ($Kind -eq 'node') { 'OpenJS.NodeJS.LTS' } else { 'Python.Python.3.13' }
    Write-Host "$package kuruluyor. Windows izin isterse onaylayin."
    $arguments = @('install', '--id', $package, '--exact', '--source', 'winget', '--silent', '--accept-package-agreements', '--accept-source-agreements', '--disable-interactivity')
    if ($Kind -eq 'python') { $arguments += @('--scope', 'user') }
    & $winget @arguments | Out-Host
    $result = $LASTEXITCODE
    if ($result -eq 3010) {
        throw '[START011] Kurulum Windows yeniden baslatmasi istiyor. Yeniden baslattiktan sonra start.bat dosyasini acin.'
    }
    if ($result -ne 0) {
        throw '[START011] Program kurulumu tamamlanamadi. Yukaridaki kurulum mesajini, interneti ve Windows iznini kontrol edip tekrar acin.'
    }
    Update-PortalPath
}

function Ensure-PortalRuntimes {
    param([string]$Root, [switch]$CheckOnly)
    Update-PortalPath
    $node = Find-PortalNode
    if (-not $node -and -not $CheckOnly) {
        Install-PortalRuntime node
        $node = Find-PortalNode
    }
    if (-not $node) { throw '[START001] Node.js 22.12+ ve npm bulunamadi; Node.js kurulumunu kontrol edin.' }
    $python = Find-PortalPython $Root
    if (-not $python -and -not $CheckOnly) {
        Install-PortalRuntime python
        $python = Find-PortalPython $Root
    }
    if (-not $python) { throw '[START006] Python 3.11-3.14 bulunamadi; Python kurulumunu kontrol edin.' }
    $env:Path = (Split-Path -Parent $node) + ';' + $env:Path
    $env:PORTAL_PYTHON = $python
    Write-Host 'Node.js, npm ve Python hazir.'
    return @{ Node = $node; Python = $python }
}
