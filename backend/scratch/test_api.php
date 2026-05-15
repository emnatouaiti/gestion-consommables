<?php
$url = 'http://localhost:8000/api/admin/documents';
$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Accept: application/json',
    'X-Requested-With: XMLHttpRequest',
    'Authorization: Bearer 1|...' // We don't have a token here easily
]);
$response = curl_exec($ch);
$info = curl_getinfo($ch);
echo "Status: " . $info['http_code'] . "\n";
echo "Response: " . $response . "\n";
curl_close($ch);
