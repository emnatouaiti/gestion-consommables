$lines = Get-Content 'c:\Users\THINKPAD-P50\gestion-consommables\frontend\src\app\features\dashboard\dashboard.component.ts'
$newLines = $lines[0..232] + $lines[307..($lines.Length-1)]
$newLines | Set-Content 'c:\Users\THINKPAD-P50\gestion-consommables\frontend\src\app\features\dashboard\dashboard.component.ts'
