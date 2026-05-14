<?php
require 'vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$tables = DB::select('SHOW TABLES');
foreach ($tables as $table) {
    $tableName = array_values((array)$table)[0];
    if (strpos($tableName, 'site') !== false || strpos($tableName, 'ist') !== false || strpos($tableName, 'floor') !== false || strpos($tableName, 'room') !== false) {
        echo "Found table: $tableName\n";
    }
}
