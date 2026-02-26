<?php

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Http\Request;
use App\Http\Controllers\API\AuthController;

$controller = new AuthController();
$request = Request::create('/api/login', 'POST', [
    'email' => 'emna@gmail.com',
    'password' => '12345678',
]);

$response = $controller->login($request);

if ($response instanceof \Illuminate\Http\JsonResponse) {
    echo "Status: " . $response->getStatusCode() . "\n";
    echo $response->getContent() . "\n";
} else {
    var_dump($response);
}
