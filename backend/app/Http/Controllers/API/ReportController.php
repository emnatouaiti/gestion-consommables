<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\StockMovement;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    public function exportStock(Request $request)
    {
        $products = Product::with(['category', 'unit'])->get();

        $response = new StreamedResponse(function () use ($products) {
            $handle = fopen('php://output', 'w');
            
            // Add UTF-8 BOM for Excel compatibility
            fputs($handle, "\xEF\xBB\xBF");
            
            fputcsv($handle, [
                'ID',
                'Titre',
                'Reference',
                'Categorie',
                'Quantite en Stock',
                'Seuil Min',
                'Seuil Max',
                'Prix Achat',
                'Status'
            ], ';');

            foreach ($products as $product) {
                // Calculate implicit status
                $status = 'Normal';
                if ($product->stock_quantity == 0) {
                    $status = 'Ruputre';
                } elseif ($product->seuil_min && $product->stock_quantity < $product->seuil_min) {
                    $status = 'Faible';
                }

                fputcsv($handle, [
                    $product->id,
                    $product->title,
                    $product->reference,
                    $product->category ? $product->category->title : 'N/A',
                    $product->stock_quantity,
                    $product->seuil_min,
                    $product->seuil_max,
                    $product->purchase_price,
                    $status
                ], ';');
            }

            fclose($handle);
        });

        $response->headers->set('Content-Type', 'text/csv; charset=utf-8');
        $response->headers->set('Content-Disposition', 'attachment; filename="rapport_stock_' . date('Y-m-d') . '.csv"');

        return $response;
    }

    public function exportMovements(Request $request)
    {
        $movements = StockMovement::with(['creator', 'lines.product', 'supplier'])->latest()->get();

        $response = new StreamedResponse(function () use ($movements) {
            $handle = fopen('php://output', 'w');
            
            // Add UTF-8 BOM
            fputs($handle, "\xEF\xBB\xBF");
            
            fputcsv($handle, [
                'ID',
                'Reference',
                'Type',
                'Status',
                'Cree Par',
                'Fournisseur',
                'Date',
                'Produits (Lignes)'
            ], ';');

            foreach ($movements as $m) {
                $linesDesc = $m->lines->map(function ($line) {
                    $pt = $line->product ? $line->product->title : 'Produit inconnu';
                    return $pt . ' (x' . $line->quantity . ')';
                })->implode(', ');

                fputcsv($handle, [
                    $m->id,
                    $m->reference,
                    $m->movement_type ?? $m->type,
                    $m->status,
                    $m->creator ? ($m->creator->nomprenom ?: $m->creator->name) : 'N/A',
                    $m->supplier ? $m->supplier->name : 'N/A',
                    $m->created_at->format('Y-m-d H:i:s'),
                    $linesDesc
                ], ';');
            }

            fclose($handle);
        });

        $response->headers->set('Content-Type', 'text/csv; charset=utf-8');
        $response->headers->set('Content-Disposition', 'attachment; filename="rapport_mouvements_' . date('Y-m-d') . '.csv"');

        return $response;
    }
}
