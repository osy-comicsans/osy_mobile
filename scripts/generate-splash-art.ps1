# Generates the OSY wordmark from the bundled Gabarito font, without runtime fonts.
# Run from the project root on Windows; committed SVG paths are the vector source.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$projectPath = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$artPath = Join-Path $projectPath 'assets/brand'
[System.IO.Directory]::CreateDirectory($artPath) | Out-Null
$fonts = New-Object System.Drawing.Text.PrivateFontCollection
$fonts.AddFontFile((Join-Path $projectPath 'assets/fonts/Gabarito_700Bold.ttf'))
$family = $fonts.Families[0]
$fontStyle = if ($family.IsStyleAvailable([System.Drawing.FontStyle]::Bold)) { [System.Drawing.FontStyle]::Bold } else { [System.Drawing.FontStyle]::Regular }
$outline = New-Object System.Drawing.Drawing2D.GraphicsPath
$outline.AddString('OSY', $family, [int]$fontStyle, 224, [System.Drawing.PointF]::new(0, 0), [System.Drawing.StringFormat]::GenericTypographic)
$outline.FillMode = [System.Drawing.Drawing2D.FillMode]::Winding
$bounds = $outline.GetBounds()
$scale = 680 / $bounds.Width
$matrix = [System.Drawing.Drawing2D.Matrix]::new($scale, 0, 0, $scale, 512 - ($bounds.X + $bounds.Width / 2) * $scale, 512 - ($bounds.Y + $bounds.Height / 2) * $scale)
$outline.Transform($matrix)
$culture = [System.Globalization.CultureInfo]::InvariantCulture
function Point-Text($point) { return $point.X.ToString('0.###', $culture) + ',' + $point.Y.ToString('0.###', $culture) }
$points = $outline.PathPoints
$types = $outline.PathTypes
$commands = New-Object System.Collections.Generic.List[string]
for ($index = 0; $index -lt $points.Length; $index++) {
  switch ($types[$index] -band 7) {
    0 { $commands.Add('M' + (Point-Text $points[$index])) }
    1 { $commands.Add('L' + (Point-Text $points[$index])) }
    3 {
      $commands.Add('C' + (Point-Text $points[$index]) + ' ' + (Point-Text $points[$index + 1]) + ' ' + (Point-Text $points[$index + 2]))
      $index += 2
    }
  }
  if (($types[$index] -band 128) -ne 0) { $commands.Add('Z') }
}
$data = $commands -join ' '
foreach ($variant in @(@{ Name = 'light'; Color = '#6316DB' }, @{ Name = 'dark'; Color = '#ECE0FF' })) {
  $svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><title>OSY</title><path fill="' + $variant.Color + '" d="' + $data + '"/></svg>'
  [System.IO.File]::WriteAllText((Join-Path $artPath ('osy-splash-' + $variant.Name + '.svg')), $svg + "`n", [System.Text.UTF8Encoding]::new($false))
  $bitmap = [System.Drawing.Bitmap]::new(1024, 1024, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.Clear([System.Drawing.Color]::Transparent)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $brush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml($variant.Color))
  $graphics.FillPath($brush, $outline)
  $bitmap.Save((Join-Path $artPath ('osy-splash-' + $variant.Name + '.png')), [System.Drawing.Imaging.ImageFormat]::Png)
  $brush.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}
$matrix.Dispose()
$outline.Dispose()
$fonts.Dispose()
Write-Output 'Generated light and dark OSY splash artwork (SVG paths and transparent PNGs).'
