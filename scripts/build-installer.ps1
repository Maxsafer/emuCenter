# Build the EmuCenter Windows installer (NSIS .exe).
# Run from anywhere:  powershell -ExecutionPolicy Bypass -File scripts\build-installer.ps1
#
# The finished artifact is copied into the repo's installers\ dir if it
# exists, or into $env:INSTALLERS_DIR if set (point it at the NAS copy).
#
# Windows gotcha (from CLAUDE.md): if `npm ci` in backend\ fails building
# vigemclient, rebuild it with upstream node-gyp:
#     cd backend\node_modules\vigemclient && npx node-gyp@11 rebuild
$ErrorActionPreference = "Stop"

Set-Location (Join-Path $PSScriptRoot "..")
$Root = Get-Location

$nodeMajor = [int](node -p "process.versions.node.split('.')[0]")
if ($nodeMajor -lt 20) { throw "Node 20+ required (found: $(node -v))" }

$version = node -p "require('./package.json').version"
Write-Host "==> Building EmuCenter $version for Windows"

Write-Host "==> Cleaning previous build output"
Remove-Item -Recurse -Force web-build, release, .expo -ErrorAction SilentlyContinue

Write-Host "==> Installing dependencies (root)"
npm ci
if ($LASTEXITCODE -ne 0) { throw "npm ci (root) failed" }

Write-Host "==> Installing dependencies (backend) - vigemclient MUST build here (virtual controller)"
Push-Location backend
npm ci
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "npm ci (backend) failed - see vigemclient note in the header" }
Pop-Location

# vigemclient is an OPTIONAL dependency: when its node-gyp build fails (the
# electron-forked node-gyp wants the usually-absent ClangCL toolset), npm ci
# SUCCEEDS and silently drops the module - and the installer would ship
# without the virtual controller. Detect that and rebuild with upstream
# node-gyp, failing loudly if it still cannot be produced.
$vigem = Join-Path $Root "backend\node_modules\vigemclient"
if (-not (Test-Path (Join-Path $vigem "build\Release\vigemclient.node"))) {
    Write-Host "==> vigemclient missing after npm ci - rebuilding with upstream node-gyp"
    if (-not (Test-Path $vigem)) {
        Push-Location backend
        npm install --ignore-scripts
        Pop-Location
    }
    # Build against ELECTRON's headers, not the system Node's: the packaged
    # backend runs under Electron-as-node, and a system-Node build of this
    # addon has been seen to hard-crash it at load (2026-08-30). The
    # Electron-header build also loads fine under plain Node for dev mode.
    # Keep the target in sync with the electron version in package.json.
    $electronVersion = node -p "require('./package.json').devDependencies.electron.replace('^','')"
    Push-Location $vigem
    npx --yes node-gyp@11 rebuild --target=$electronVersion --arch=x64 --disturl=https://electronjs.org/headers
    Pop-Location
    if (-not (Test-Path (Join-Path $vigem "build\Release\vigemclient.node"))) {
        throw "vigemclient failed to build - the installer would ship without the virtual controller"
    }
}

Write-Host "==> Type check"
npx tsc --noEmit
if ($LASTEXITCODE -ne 0) { throw "tsc failed" }

Write-Host "==> Building installer"
npm run dist
if ($LASTEXITCODE -ne 0) { throw "npm run dist failed" }

$artifact = Get-ChildItem "release\*.exe" | Select-Object -First 1
if (-not $artifact) { throw "No .exe artifact found in release\" }
$sum = (Get-FileHash $artifact.FullName -Algorithm MD5).Hash
Write-Host "==> Built: $($artifact.FullName) ($([math]::Round($artifact.Length/1MB,1)) MB, md5 $sum)"

$dest = if ($env:INSTALLERS_DIR) { $env:INSTALLERS_DIR } else { Join-Path $Root "installers" }
if (Test-Path $dest) {
    Copy-Item $artifact.FullName $dest
    $copied = Join-Path $dest $artifact.Name
    $sum2 = (Get-FileHash $copied -Algorithm MD5).Hash
    if ($sum -ne $sum2) { throw "Copy verification FAILED for $copied" }
    Write-Host "==> Delivered to $copied (md5 verified)"
    Write-Host "    Reminder: delete the previous version's artifact from installers\."
} else {
    Write-Host "==> installers\ not found and INSTALLERS_DIR unset - artifact left in release\."
}
