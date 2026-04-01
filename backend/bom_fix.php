<?php
$p = 'app/Http/Controllers/API/DocumentController.php';
$b = file_get_contents($p);
if (substr($b, 0, 3) === "\xEF\xBB\xBF") {
    file_put_contents($p, substr($b, 3));
    echo "BOM removed\n";
} else {
    echo "No BOM\n";
}
