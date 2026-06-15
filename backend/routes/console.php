<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('expirations:process')->dailyAt('08:00')->timezone('Africa/Tunis');
Schedule::command('stock:alert')->dailyAt('08:00')->timezone('Africa/Tunis');
Schedule::command('capacity:alert')->dailyAt('08:00')->timezone('Africa/Tunis');
Schedule::command('consumable-requests:send-reminders')->dailyAt('09:00')->timezone('Africa/Tunis');
