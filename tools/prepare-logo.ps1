$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$build = Join-Path $root 'build'
New-Item -ItemType Directory -Force -Path $build | Out-Null
$source = Join-Path $build 'logo.png'
$iconPng = Join-Path $build 'icon.png'
$iconIco = Join-Path $build 'icon.ico'
$url = 'https://i.imgur.com/P5SoPEh.png'
if (-not (Test-Path $source)) {
    Write-Host '[NOVA] Downloading your transparent logo from Imgur...'
    try {
        $tmp = "$source.download"
        Invoke-WebRequest -Uri $url -OutFile $tmp -UseBasicParsing -MaximumRedirection 8 -TimeoutSec 25 -Headers @{'User-Agent'='Mozilla/5.0';'Accept'='image/png,image/*;q=0.9,*/*;q=0.8'}
        Move-Item -Force -Path $tmp -Destination $source
    } catch {
        Remove-Item "$source.download" -ErrorAction SilentlyContinue
        throw "Cannot download the Imgur logo. Open $url in your browser, save the transparent PNG to $source, then try again. Details: $_"
    }
}
Add-Type -AssemblyName System.Drawing
# Validate image before replacing any app assets.
try { $original = [System.Drawing.Image]::FromFile($source) }
catch { throw "Your logo at $source is not a valid image. Save the PNG directly from $url (not an HTML page)." }
try {
    if ($original.Width -lt 16 -or $original.Height -lt 16) { throw 'Logo dimensions are too small' }
    Copy-Item -Force -Path $source -Destination $iconPng
    $sizes = @(16,24,32,48,64,128,256)
    $frames = @()
    foreach($size in $sizes) {
        $bmp = [System.Drawing.Bitmap]::new($size,$size,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $gfx = [System.Drawing.Graphics]::FromImage($bmp)
        try {
            $gfx.Clear([System.Drawing.Color]::Transparent)
            $gfx.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
            $gfx.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $gfx.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
            $gfx.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            $scale = [Math]::Min([double]$size/$original.Width,[double]$size/$original.Height)
            $dw=[int][Math]::Round($original.Width*$scale)
            $dh=[int][Math]::Round($original.Height*$scale)
            $dx=[int][Math]::Floor(($size-$dw)/2)
            $dy=[int][Math]::Floor(($size-$dh)/2)
            $gfx.DrawImage($original,[System.Drawing.Rectangle]::new($dx,$dy,$dw,$dh))
            $stream=[System.IO.MemoryStream]::new()
            try {
                $bmp.Save($stream,[System.Drawing.Imaging.ImageFormat]::Png)
                $frames+=@{size=$size;bytes=$stream.ToArray()}
            } finally { $stream.Dispose() }
        } finally { $gfx.Dispose();$bmp.Dispose() }
    }
    # ICO is an ICONDIR followed by individual PNG icon images (Windows Vista+).
    $writer=[System.IO.BinaryWriter]::new([System.IO.File]::Create($iconIco))
    try {
        $writer.Write([UInt16]0)
        $writer.Write([UInt16]1)
        $writer.Write([UInt16]$frames.Count)
        $offset=6+16*$frames.Count
        foreach($frame in $frames) {
            $dim = if($frame.size -eq 256){0}else{$frame.size}
            $writer.Write([byte]$dim)
            $writer.Write([byte]$dim)
            $writer.Write([byte]0)
            $writer.Write([byte]0)
            $writer.Write([UInt16]1)
            $writer.Write([UInt16]32)
            $writer.Write([UInt32]$frame.bytes.Length)
            $writer.Write([UInt32]$offset)
            $offset += $frame.bytes.Length
        }
        foreach($frame in $frames){$writer.Write([byte[]]$frame.bytes)}
    } finally { $writer.Dispose() }
} finally { $original.Dispose() }
Write-Host '[NOVA] Logo ready for tabs, start page, Windows app, EXE, and taskbar.'
