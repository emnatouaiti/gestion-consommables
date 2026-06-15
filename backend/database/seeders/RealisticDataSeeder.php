<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use App\Models\Category;
use App\Models\Product;
use App\Models\Warehouse;
use App\Models\WarehouseRoom;
use App\Models\WarehouseLocation;
use App\Models\WarehouseCabinet;
use App\Models\ProductStock;
use App\Models\StockMovement;
use App\Models\StockMovementLine;
use App\Models\ConsumableRequest;
use App\Models\Supplier;
use App\Models\Document;
use App\Models\Unit;
use App\Models\Marque;
use App\Models\Modele;
use Illuminate\Support\Str;

class RealisticDataSeeder extends Seeder
{
    public function run()
    {
        // 1. Truncate specific tables (ignoring foreign key checks temporarily)
        DB::statement('SET FOREIGN_KEY_CHECKS=0;');
        
        ConsumableRequest::truncate();
        Document::truncate();
        Unit::truncate();
        Marque::truncate();
        Modele::truncate();
        StockMovementLine::truncate();
        StockMovement::truncate();
        ProductStock::truncate();
        Product::truncate();
        Category::truncate();
        WarehouseLocation::truncate();
        WarehouseCabinet::truncate();
        WarehouseRoom::truncate();
        Warehouse::truncate();
        Supplier::truncate();
        
        DB::statement('SET FOREIGN_KEY_CHECKS=1;');

        // 2. Create Units
        $unitPce = Unit::create(['name' => 'Piece', 'code' => 'PCE', 'description' => 'Unite individuelle']);
        $unitBox = Unit::create(['name' => 'Boite', 'code' => 'BOX', 'description' => 'Boite de plusieurs unites']);
        $unitPkt = Unit::create(['name' => 'Paquet', 'code' => 'PKT', 'description' => 'Paquet de rame ou consommable']);
        $unitLtr = Unit::create(['name' => 'Litre', 'code' => 'LTR', 'description' => 'Volume en litres']);

        // 3. Create Marques & Modeles
        $marqueDell = Marque::create(['name' => 'Dell']);
        $marqueHP   = Marque::create(['name' => 'HP']);
        $marqueLogi = Marque::create(['name' => 'Logitech']);
        $marqueDoubleA = Marque::create(['name' => 'Double A']);
        $marqueBic  = Marque::create(['name' => 'Bic']);

        Modele::create(['name' => 'Latitude 5420', 'marque_id' => $marqueDell->id]);
        Modele::create(['name' => 'Optiplex 7080', 'marque_id' => $marqueDell->id]);
        Modele::create(['name' => 'LaserJet Pro', 'marque_id' => $marqueHP->id]);
        Modele::create(['name' => 'M185 Wireless', 'marque_id' => $marqueLogi->id]);
        Modele::create(['name' => 'A4 80g', 'marque_id' => $marqueDoubleA->id]);

        // 4. Create Suppliers
        $suppliers = [
            Supplier::create(['name' => 'TechPro Solutions', 'email' => 'contact@techpro.tn', 'phone' => '71234567']),
            Supplier::create(['name' => 'OfficePlast', 'email' => 'vente@officeplast.com', 'phone' => '73456789']),
            Supplier::create(['name' => 'Hygiene Plus', 'email' => 'info@hygieneplus.tn', 'phone' => '72123456']),
        ];

        // 5. Create Warehouses & Locations
        $mainDepot = Warehouse::create(['name' => 'Depot Principal Tunis', 'address' => 'Tunis, Charguia II']);
        $secDepot = Warehouse::create(['name' => 'Depot Secondaire Sfax', 'address' => 'Sfax, Route de Tunis']);

        // Main Depot Rooms
        $roomIT = WarehouseRoom::create(['warehouse_id' => $mainDepot->id, 'name' => 'Salle Informatique']);
        $roomOffice = WarehouseRoom::create(['warehouse_id' => $mainDepot->id, 'name' => 'Reserve Bureautique']);

        // Main Depot Locations / Cabinets
        $locLaptop = WarehouseLocation::create(['room_id' => $roomIT->id, 'name' => 'Etagere Securisee IT-1']);
        $locCables = WarehouseLocation::create(['room_id' => $roomIT->id, 'name' => 'Armoire Cables IT-2']);
        $locPaper = WarehouseLocation::create(['room_id' => $roomOffice->id, 'name' => 'Palette Papiers']);
        $cabPens = WarehouseCabinet::create(['room_id' => $roomOffice->id, 'name' => 'Armoire Fournitures A']);

        // 6. Create Categories
        $catIT = Category::create(['title' => 'Informatique', 'description' => 'Materiel informatique et accessoires']);
        $catOffice = Category::create(['title' => 'Bureautique', 'description' => 'Fournitures de bureau']);
        $catHygiene = Category::create(['title' => 'Entretien & Hygiene', 'description' => 'Produits de nettoyage et hygiene']);

        // 7. Create Products
        $products = [
            // Informatique
            Product::create([
                'categorie_id' => $catIT->id, 'title' => 'Ordinateur Portable Dell Latitude', 
                'reference' => 'DELL-LAT-001', 'stock_quantity' => 10, 'seuil_min' => 2,
                'unit_id' => $unitPce->id, 'marque' => 'Dell', 'model' => 'Latitude 5420'
            ]),
            Product::create([
                'categorie_id' => $catIT->id, 'title' => 'Souris sans fil Logitech M185', 
                'reference' => 'LOG-M185', 'stock_quantity' => 25, 'seuil_min' => 5,
                'unit_id' => $unitPce->id, 'marque' => 'Logitech', 'model' => 'M185'
            ]),
            // Bureautique
            Product::create([
                'categorie_id' => $catOffice->id, 'title' => 'Rame de papier A4 Double A', 
                'reference' => 'PAP-A4-DA', 'stock_quantity' => 150, 'seuil_min' => 20,
                'unit_id' => $unitPkt->id, 'marque' => 'Double A', 'model' => 'A4 80g'
            ]),
            Product::create([
                'categorie_id' => $catOffice->id, 'title' => 'Stylos Bic Bleus (Boite 50)', 
                'reference' => 'BIC-BLU-50', 'stock_quantity' => 40, 'seuil_min' => 5,
                'unit_id' => $unitBox->id, 'marque' => 'Bic', 'model' => 'Cristal'
            ]),
            Product::create([
                'categorie_id' => $catOffice->id, 'title' => 'Cahier spirale 200 pages', 
                'reference' => 'CAH-SPIR-200', 'stock_quantity' => 60, 'seuil_min' => 10,
                'unit_id' => $unitPce->id, 'marque' => 'Standard', 'model' => '200p'
            ]),
            // Hygiene
            Product::create([
                'categorie_id' => $catHygiene->id, 'title' => 'Gel Hydroalcoolique 500ml', 
                'reference' => 'GEL-HYD-500', 'stock_quantity' => 80, 'seuil_min' => 15,
                'unit_id' => $unitPce->id, 'marque' => 'HealthProtect', 'model' => '500ml'
            ]),
        ];

        // 8. Create Initial Stocks
        // Dell Laptops
        ProductStock::create(['product_id' => $products[0]->id, 'warehouse_location_id' => $locLaptop->id, 'quantity' => 10]);
        // Logitech Mouse
        ProductStock::create(['product_id' => $products[1]->id, 'warehouse_location_id' => $locCables->id, 'quantity' => 25]);
        // Paper A4
        ProductStock::create(['product_id' => $products[2]->id, 'warehouse_location_id' => $locPaper->id, 'quantity' => 150]);
        // Pens
        ProductStock::create(['product_id' => $products[3]->id, 'cabinet_id' => $cabPens->id, 'quantity' => 40]);
        // Notebooks
        ProductStock::create(['product_id' => $products[4]->id, 'cabinet_id' => $cabPens->id, 'quantity' => 60]);
        // Gel
        ProductStock::create(['product_id' => $products[5]->id, 'warehouse_location_id' => $locPaper->id, 'quantity' => 80]);


        // 9. Initial Entry Movements
        $mov1 = StockMovement::create([
            'movement_type' => 'in', 'reference' => 'ENT-001', 'motif' => 'Achat', 'executed_at' => now()->subDays(10),
            'supplier_id' => $suppliers[0]->id, 'depot_id' => $mainDepot->id, 'status' => 'executed'
        ]);
        StockMovementLine::create(['stock_movement_id' => $mov1->id, 'product_id' => $products[0]->id, 'quantity' => 10]);
        StockMovementLine::create(['stock_movement_id' => $mov1->id, 'product_id' => $products[1]->id, 'quantity' => 25]);

        $mov2 = StockMovement::create([
            'movement_type' => 'in', 'reference' => 'ENT-002', 'motif' => 'Achat', 'executed_at' => now()->subDays(8),
            'supplier_id' => $suppliers[1]->id, 'depot_id' => $mainDepot->id, 'status' => 'executed'
        ]);
        StockMovementLine::create(['stock_movement_id' => $mov2->id, 'product_id' => $products[2]->id, 'quantity' => 150]);
        StockMovementLine::create(['stock_movement_id' => $mov2->id, 'product_id' => $products[3]->id, 'quantity' => 40]);
        StockMovementLine::create(['stock_movement_id' => $mov2->id, 'product_id' => $products[4]->id, 'quantity' => 60]);

        $mov3 = StockMovement::create([
            'movement_type' => 'in', 'reference' => 'ENT-003', 'motif' => 'Achat', 'executed_at' => now()->subDays(5),
            'supplier_id' => $suppliers[2]->id, 'depot_id' => $mainDepot->id, 'status' => 'executed'
        ]);
        StockMovementLine::create(['stock_movement_id' => $mov3->id, 'product_id' => $products[5]->id, 'quantity' => 80]);


        // 10. Find some users to assign requests
        $users = \App\Models\User::all();
        if ($users->isEmpty()) {
            return; // Safety check
        }
        $agentUser = $users->firstWhere('nomprenom', 'Agent User') ?? $users->first();
        $asmaUser = $users->firstWhere('nomprenom', 'asma') ?? $users->first();
        
        // 11. Create Historical Requests
        
        // Request 1: Pending (to show in validation)
        $batch1 = Str::uuid();
        ConsumableRequest::create([
            'batch_code' => $batch1, 'user_id' => $agentUser->id, 'product_id' => $products[2]->id, 'item_name' => $products[2]->title,
            'requested_quantity' => 2, 'status' => 'pending'
        ]);
        ConsumableRequest::create([
            'batch_code' => $batch1, 'user_id' => $agentUser->id, 'product_id' => $products[3]->id, 'item_name' => $products[3]->title,
            'requested_quantity' => 1, 'status' => 'pending'
        ]);

        // Request 2: Approved Pending Exit (Waiting for Stock Manager)
        $batch2 = Str::uuid();
        ConsumableRequest::create([
            'batch_code' => $batch2, 'user_id' => $asmaUser->id, 'product_id' => $products[1]->id, 'item_name' => $products[1]->title,
            'requested_quantity' => 1, 'approved_quantity' => 1, 'status' => 'approved_pending_exit', 'depot_id' => $mainDepot->id
        ]);

        // Request 3: Executed (History)
        $batch3 = Str::uuid();
        ConsumableRequest::create([
            'batch_code' => $batch3, 'user_id' => $agentUser->id, 'product_id' => $products[4]->id, 'item_name' => $products[4]->title,
            'requested_quantity' => 5, 'approved_quantity' => 5, 'status' => 'approved', 'depot_id' => $mainDepot->id
        ]);
    }
}
