param([string]$src, [string]$dst)
# Resize images to max 1600px; JPEG q80 if opaque, PNG if has alpha.
Add-Type -AssemblyName System.Drawing
New-Item -ItemType Directory -Force -Path $dst | Out-Null
$files = Get-ChildItem -Recurse $src -File -Filter *.png
foreach ($f in $files) {
  $rel = $f.Directory.Name
  if ($rel -eq ([System.IO.Path]::GetFileName($src)) -or $rel -like "*P0*" -or $rel -like "*图片*") { $name = "p_" + [System.IO.Path]::GetFileNameWithoutExtension($f.Name) }
  else { $name = ($rel -replace '[^0-9A-Za-z\-]', '-') + "_" + [System.IO.Path]::GetFileNameWithoutExtension($f.Name) }
  # derive P-based short name from folder: find Pxx token
  if ($f.Directory.Name -match 'P(\d+[A-B]?)') {
    $name = "p" + $matches[1].ToLower()
    if ($f.Directory.Name -match 'P(\d+)-(\d)') { $name = "p" + $matches[1] + "-" + $matches[2] }
    elseif ($f.Directory.Parent.Name -match 'P(\d+[A-B]?)') { $name = "p" + $matches[1].ToLower() }
  }
  $img = [System.Drawing.Image]::FromFile($f.FullName)
  $maxDim = 1600
  $scale = [Math]::Min(1, [double]$maxDim / [Math]::Max($img.Width, $img.Height))
  $w = [int]($img.Width * $scale); $h = [int]($img.Height * $scale)
  $bmp = New-Object System.Drawing.Bitmap($w, $h)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($img, 0, 0, $w, $h)
  $hasAlpha = ($img.Flags -band 0x40000) -ne 0
  $ext = $(if ($hasAlpha) { ".png" } else { ".jpg" })
  $target = Join-Path $dst ($name + $ext)
  if (Test-Path $target) { $target = Join-Path $dst ($name + "-b" + $ext) }
  if ($hasAlpha) {
    $bmp.Save($target, [System.Drawing.Imaging.ImageFormat]::Png)
  } else {
    $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
    $ep = New-Object System.Drawing.Imaging.EncoderParameters(1)
    $ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, 80L)
    $bmp.Save($target, $codec, $ep)
  }
  $g.Dispose(); $bmp.Dispose(); $img.Dispose()
  Write-Output ("done " + $name + " -> " + $w + "x" + $h)
}
Write-Output "ALL DONE"
