<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\ConsumableRequest;
use App\Models\Document;
use App\Models\Product;
use Illuminate\Support\Str;

class SyncRequestDocuments extends Command
{
    protected $signature = 'app:sync-request-documents';
    protected $description = 'Synchronize existing consumable request PDFs into the documents table';

    public function handle()
    {
        $requests = ConsumableRequest::whereNotNull('pdf_path')->get()->groupBy('batch_code');
        $count = 0;

        foreach ($requests as $batchCode => $group) {
            $first = $group->first();
            $filePath = $first->pdf_path;

            foreach ($group as $req) {
                $productId = $req->product_id;

                // Fallback resolution if product_id is null
                if (!$productId && $req->item_name) {
                    $productId = Product::where('title', 'like', $req->item_name)
                        ->orWhere('reference', 'like', $req->item_name)
                        ->orWhereRaw('LOWER(title) = ?', [mb_strtolower($req->item_name, 'UTF-8')])
                        ->value('id');

                    if ($productId) {
                        $req->update(['product_id' => $productId]);
                    }
                }

                if ($productId) {
                    $indStatus = strtolower((string)$req->status);
                    $docType = 'demande';
                    $titlePrefix = 'Demande de consommables';

                    if ($indStatus === 'approved') {
                        $docType = 'bon_sortie';
                        $titlePrefix = 'Bon de sortie';
                    } elseif ($indStatus === 'rejected') {
                        $docType = 'refus';
                        $titlePrefix = 'Refus de demande';
                    } elseif ($indStatus === 'approved_pending_exit') {
                        $docType = 'demande_approuvee';
                        $titlePrefix = 'Demande approuvee';
                    } elseif ($indStatus === 'partiellement_accepte') {
                        $docType = 'demande_partielle';
                        $titlePrefix = 'Approbation partielle';                    }

                    $title = $titlePrefix . ' - ' . ($req->item_name ?: 'Produit') . ' (' . ($batchCode ?: 'REQ-' . $req->id) . ')';

                    Document::updateOrCreate(
                        [
                            'path' => $filePath,
                            'product_id' => $productId,
                            'type' => $docType
                        ],
                        [
                            'user_id' => $req->user_id,
                            'title' => $title,
                            'direction' => 'out',
                            'status' => 'applied',
                        ]
                    );
                    $count++;
                }
            }
        }

        $this->info("Successfully synchronized $count document entries.");
    }
}
