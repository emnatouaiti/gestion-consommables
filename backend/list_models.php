<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

$key = env('GEMINI_API_KEY');
$url = "https://generativelanguage.googleapis.com/v1beta/models?key=$key";
$json = file_get_contents($url);
$data = json_decode($json, true);

if (isset($data['models'])) {
    foreach ($data['models'] as $model) {
        if (strpos($model['name'], 'gemini') !== false) {
            echo $model['name'] . "\n";
        }
    }
} else {
    echo $json;
}
