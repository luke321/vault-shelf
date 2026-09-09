<#
.SYNOPSIS
  Install the BUILT plugin into a vault the way Obsidian installs it, and nothing else.

.DESCRIPTION
  Three files. Exactly the three Obsidian downloads from a release -- main.js,
  manifest.json, styles.css -- and deliberately nothing more.

  That restraint is the point. Copying src/page.html, or the core, or an assets folder into
  the plugin directory would make the plugin work here and only here: a real install never
  puts those files anywhere, so every user outside this machine would get a plugin that could
  not find its own page. Installing only what Obsidian installs turns that class of bug into
  an immediate local failure instead of a shipped one.

  Run scripts/build-plugin.mjs first; this copies, it does not build.

.PARAMETER Vault
  Vault root. Defaults to $env:VAULT_SHELF_VAULT, then $env:OBSIDIAN_VAULT.

.PARAMETER Enable
  Also write .obsidian/community-plugins.json so the plugin is enabled on next open. Obsidian
  still asks to trust the author the first time a non-default vault is opened, and does not
  load ANY plugin until that is confirmed.

.EXAMPLE
  node scripts/build-plugin.mjs; ./scripts/install-plugin.ps1 -Vault .\demo-vault -Enable
#>
[CmdletBinding()]
param(
  [string] $Vault,
  [switch] $Enable
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot

$manifestPath = Join-Path $repo 'manifest.json'
if (-not (Test-Path $manifestPath)) { throw "no manifest.json at the repo root" }
$manifest = Get-Content -Raw -Encoding UTF8 $manifestPath | ConvertFrom-Json
$pluginId = $manifest.id

$assets = @('main.js', 'manifest.json', 'styles.css')
foreach ($a in $assets) {
  if (-not (Test-Path (Join-Path $repo $a))) {
    throw "$a is missing -- run: node scripts/build-plugin.mjs"
  }
}

if (-not $Vault) { $Vault = $env:VAULT_SHELF_VAULT }
if (-not $Vault) { $Vault = $env:OBSIDIAN_VAULT }
if (-not $Vault) { throw "No vault given. Pass -Vault <path>, or set VAULT_SHELF_VAULT." }
$vaultRoot = (Resolve-Path $Vault).Path
$dot = Join-Path $vaultRoot '.obsidian'
if (-not (Test-Path $dot)) { New-Item -ItemType Directory -Force -Path $dot | Out-Null }

$dest = Join-Path $dot "plugins/$pluginId"
New-Item -ItemType Directory -Force -Path $dest | Out-Null

$total = 0
foreach ($a in $assets) {
  $src = Join-Path $repo $a
  Copy-Item -Force -Path $src -Destination (Join-Path $dest $a)
  $bytes = (Get-Item $src).Length
  $total += $bytes
  Write-Host ("  {0,-16} {1,9:N0} bytes" -f $a, $bytes)
}

if ($Enable) {
  $listPath = Join-Path $dot 'community-plugins.json'
  $list = @()
  if (Test-Path $listPath) {
    try { $list = @(Get-Content -Raw -Encoding UTF8 $listPath | ConvertFrom-Json) } catch { $list = @() }
  }
  if ($list -notcontains $pluginId) { $list += $pluginId }
  ($list | ConvertTo-Json -Compress) | Out-File -Encoding utf8 $listPath
  Write-Host "  enabled in community-plugins.json" -ForegroundColor DarkGray
}

Write-Host ("installed {0} v{1} ({2:N0} KB) into {3}" -f `
  $pluginId, $manifest.version, ($total / 1KB), $dest) -ForegroundColor Green
Write-Host ''
Write-Host 'Obsidian asks to trust the author the first time it opens a vault it has not seen.'
Write-Host 'Until that is confirmed NO plugin loads at all -- which looks exactly like a broken'
Write-Host 'plugin and is not. Confirm it, close Settings, then run "Vault shelf: Open the library".'
