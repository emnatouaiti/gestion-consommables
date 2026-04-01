<?php
$storedFile = 'C:\\Users\\THINKPAD-P50\\gestion-consommables\\backend\\storage\\app\\public\\documents\\iE9dqdkL2g6IBM762slSkr1WKfgqcLKBjGd36xJz.png';

if (!file_exists($storedFile)) {
    echo "File not found.\n";
    exit(1);
}

echo "File exists: YES\n";
echo "File size: " . filesize($storedFile) . " bytes\n\n";

// Test direct OCR
$cmd = '"C:\\Program Files\\Tesseract-OCR\\tesseract.exe" "' . $storedFile . '" stdout -l fra+eng --psm 6 --oem 1 2>&1';
echo "Command: " . $cmd . "\n\n";

$output = shell_exec($cmd);
$outLen = strlen(trim($output));

echo "OCR Output Length: " . $outLen . " characters\n";
if ($outLen > 0) {
    echo "First 300 chars:\n" . substr(trim($output), 0, 300) . "\n";
}
?>
