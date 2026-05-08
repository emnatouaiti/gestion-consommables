# Implementation: Depot-Filtered Notifications and Auto-Selection

## Overview
This document describes the implementation of two key features:
1. **Depot-filtered notifications**: When an agent makes a stock movement, only the responsible of the same depot receives notifications
2. **Automatic depot and location selection**: When applying OCR to documents, the depot is automatically selected based on the user's assigned depot, and available rooms/locations can be found automatically

## Changes Made

### 1. StockMovementController (`backend/app/Http/Controllers/StockMovementController.php`)

#### Modified Notification Logic in `store()` method
- Added import for `StockMovementNotification`
- Modified the notification logic to filter responsables by depot:
  - If the creator is an agent (not admin), only notify responsables of the same depot
  - Admins without depot restriction are always notified
  - The depot is determined from the source or destination warehouse location

```php
// Notifications - Filter by depot for agents, notify all responsables for admins
if ($user && $user->depot_id && !$this->userHasAnyRole($user, ['administrateur'])) {
    // Get the depot of the movement (from source or destination location)
    $movementDepotId = null;
    if ($movement->source_warehouse_location_id) {
        $loc = \App\Models\WarehouseLocation::with('room.warehouse')->find($movement->source_warehouse_location_id);
        if ($loc) {
            $movementDepotId = $loc->room->warehouse_id;
        }
    } elseif ($movement->destination_warehouse_location_id) {
        $loc = \App\Models\WarehouseLocation::with('room.warehouse')->find($movement->destination_warehouse_location_id);
        if ($loc) {
            $movementDepotId = $loc->room->warehouse_id;
        }
    }

    // Filter responsables by depot
    $query->where(function ($q) use ($movementDepotId) {
        $q->where('depot_id', $movementDepotId)
          ->orWhereNull('depot_id'); // Include admins without depot restriction
    });
}
```

### 2. DocumentController (`backend/app/Http/Controllers/API/DocumentController.php`)

#### Auto-select Warehouse in `store()` method
- When uploading a document via OCR, if no warehouse_id is provided, the system automatically uses the user's assigned depot (`depot_id`)

```php
$user = $request->user();

// Auto-select warehouse (depot) based on user's depot if not provided
$warehouseId = $request->warehouse_id;
if (!$warehouseId && $user && $user->depot_id) {
    $warehouseId = $user->depot_id;
}

// ... later in Document::create()
$document = Document::create([
    // ...
    'warehouse_id' => $warehouseId,
    // ...
]);
```

#### Modified Notification Logic in `apply()` method
- Similar to StockMovementController, notifications are now filtered by depot
- Only responsables of the same depot as the user receive notifications

#### New Endpoint: `findAvailableLocation()`
- **Route**: `GET /api/admin/warehouse/available-location`
- **Purpose**: Find an available warehouse location based on capacity
- **Parameters**:
  - `warehouse_id` (optional): If not provided, uses user's depot
  - `quantity` (optional): Required capacity units (default: 1)
- **Returns**: Available location or cabinet with enough capacity

#### New Endpoint: `getAvailableLocations()`
- **Route**: `GET /api/admin/warehouse/available-locations`
- **Purpose**: Get all available locations and cabinets for a warehouse
- **Parameters**:
  - `warehouse_id` (optional): If not provided, uses user's depot
- **Returns**: List of all available locations and cabinets

### 3. Routes (`backend/routes/api.php`)

Added new routes for available location endpoints:
```php
// Available location endpoints for auto-selection
Route::get('admin/warehouse/available-location', [DocumentController::class, 'findAvailableLocation']);
Route::get('admin/warehouse/available-locations', [DocumentController::class, 'getAvailableLocations']);
```

## Usage Examples

### 1. Finding an Available Location
```bash
GET /api/admin/warehouse/available-location?quantity=10
```
Response:
```json
{
    "found": true,
    "location": {
        "id": 1,
        "name": "Emplacement A1",
        "code": "LOC-2026-0001",
        "room_id": 1,
        "room_name": "Salle 1",
        "warehouse_id": 1,
        "warehouse_name": "Dépôt Principal",
        "current_units": 5,
        "capacity_units": 100
    },
    "quantity_requested": 10
}
```

### 2. Getting All Available Locations
```bash
GET /api/admin/warehouse/available-locations
```
Response:
```json
{
    "warehouse_id": 1,
    "locations": [
        {
            "id": 1,
            "name": "Emplacement A1",
            "code": "LOC-2026-0001",
            "room_id": 1,
            "room_name": "Salle 1",
            "current_units": 5,
            "capacity_units": 100,
            "available_units": 95
        }
    ],
    "cabinets": [],
    "total_locations": 1,
    "total_cabinets": 0
}
```

## Database Schema Reference

### User Model
- `depot_id`: Foreign key to `warehouses` table (user's assigned depot)

### Warehouse Structure
- `warehouses`: Main depot/warehouse
- `warehouse_rooms`: Rooms within a warehouse (salle)
- `warehouse_locations`: Specific locations within a room (emplacement)
- `warehouse_cabinets`: Cabinets within a room (armoire)

## Benefits

1. **Improved Notification Relevance**: Responsables only receive notifications for movements in their depot
2. **Reduced Noise**: Admins of other depots are not bothered with irrelevant notifications
3. **Automatic Depot Selection**: Agents don't need to manually select their depot when uploading documents
4. **Smart Location Assignment**: System can automatically find available storage locations based on capacity
5. **Better Workflow**: OCR-to-stock workflow is streamlined with automatic selections

## Testing Recommendations

1. Create users with different `depot_id` values
2. Test stock movement creation and verify only same-depot responsables receive notifications
3. Test OCR document upload and verify `warehouse_id` is auto-selected
4. Test available location endpoints with different quantities