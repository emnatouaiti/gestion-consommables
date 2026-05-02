<?php

use App\Models\ConsumableRequest;
use App\Models\User;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;

require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);
$kernel->handle(Illuminate\Http\Request::capture());

$requests = ConsumableRequest::all()->groupBy('batch_code');

foreach ($requests as $batchCode => $group) {
    $first = $group->first();
    $user = User::find($first->user_id);
    
    if (!$user) continue;

    try {
        $data = [
            'user' => $user,
            'requests' => $group,
            'batch_code' => $batchCode,
        ];

        $pdf = Pdf::loadView('pdf.consumable_request', $data);
        $fileName = 'request_' . ($batchCode ?: $first->id) . '_' . time() . '.pdf';
        $filePath = 'requests/' . $fileName;

        Storage::disk('public')->put($filePath, $pdf->output());

        foreach ($group as $req) {
            $req->update(['pdf_path' => $filePath]);
            
            // Link to the Document table so it shows up in the product's "Documents" tab
            if ($req->product_id) {
                $statuses = $group->pluck('status')->map(fn($s) => strtolower((string)$s));
                $isApproved = $statuses->every(fn($s) => $s === 'approved');
                $isRejected = $statuses->contains('rejected');
                
                $docType = 'demande';
                if ($isApproved) {
                    $docType = 'bon_sortie';
                } elseif ($isRejected) {
                    $docType = 'refus';
                }

                $title = ($isApproved ? 'Bon de sortie' : ($isRejected ? 'Refus de demande' : 'Demande de consommables')) . ' - ' . ($batchCode ?: 'REQ-' . $req->id);

                \App\Models\Document::updateOrCreate(
                    [
                        'path' => $filePath,
                        'product_id' => $req->product_id
                    ],
                    [
                        'user_id' => $req->user_id,
                        'title' => $title,
                        'type' => $docType,
                        'direction' => 'out',
                        'status' => 'applied',
                    ]
                );
            }
        }
        echo "PDF and Document entry generated for batch " . ($batchCode ?: $first->id) . "\n";
    } catch (\Throwable $e) {
        echo "Error for batch " . ($batchCode ?: $first->id) . ": " . $e->getMessage() . "\n";
    }
}
