<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

$key = env('GEMINI_API_KEY');
$url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-latest:generateContent?key=$key";

$payload = [
    'contents' => [
        [
            'parts' => [
                ['text' => 'Hello, say "Test Success"']
            ]
        ]
    ]
];

$response = \Illuminate\Support\Facades\Http::post($url, $payload);
echo $response->body();
