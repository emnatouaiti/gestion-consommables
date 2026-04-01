<?php
// Test the most recently uploaded document
$storedFile = 'C:\\Users\\THINKPAD-P50\\gestion-consommables\\backend\\storage\\app\\public\\documents\\thvH5aAh7mPmamddRYTuBjJkFGNaN fJKHj11qOMc.png';

if (!file_exists($storedFile)) {
    echo "File not found: $storedFile\n";
    exit(1);
}

echo "Testing OCR on stored file:\n";
echo "Path: " . $storedFile . "\n";
echo "File size: " . filesize($storedFile) . " bytes\n\n";

$cmd = '"C:\\Program Files\\Tesseract-OCR\\tesseract.exe" "' . $storedFile . '" stdout -l fra+eng --psm 6 --oem 1 2>&1';
$output = shell_exec($cmd);

echo "OCR Output Length: " . strlen(trim($output)) . " characters\n";
echo "Output:\n";
echo trim($output) . "\n\n";

if (strlen(trim($output)) === 0) {
    echo "ERROR: No text extracted from stored file!\n";
} else {
    echo "SUCCESS: Text extracted from stored file\n";
}
