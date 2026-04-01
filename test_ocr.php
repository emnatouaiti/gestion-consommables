<?php
$img = 'C:\\Users\\THINKPAD-P50\\Downloads\\Gemini_Generated_Image_wzilhrwzilhrwzil.png';

if (!file_exists($img)) {
    echo "Image not found: $img\n";
    exit(1);
}

echo "Testing OCR on: " . basename($img) . "\n";
echo "File size: " . filesize($img) . " bytes\n\n";

$cmd = '"C:\\Program Files\\Tesseract-OCR\\tesseract.exe" "' . $img . '" stdout -l fra+eng --psm 6 --oem 1 2>&1';
$output = shell_exec($cmd);

echo "OCR Output Length: " . strlen(trim($output)) . " characters\n";
echo "First 300 characters:\n";
echo substr(trim($output), 0, 300) . "\n\n";

if (strlen(trim($output)) === 0) {
    echo "ERROR: No text extracted from image!\n";
} else {
    echo "SUCCESS: Text extracted from image\n";
}
