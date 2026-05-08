# Implementation Summary: Responsable Depot Management

## Overview
This implementation adds depot (warehouse) management for "Responsable" users and updates the consumable request approval workflow to notify only the responsible who has the requested products in their depot.

## Changes Made

### 1. Database Schema Updates

#### New Migration: `2026_05_08_000001_add_depots_to_users_table.php`
- Added `depot_id` column to `users` table
- Foreign key relationship to `warehouses` table
- Allows null values (only required for Responsable role)

### 2. Backend Model Updates

#### `User.php`
- Added `depot_id` to fillable attributes
- Added `depot()` relationship method to access the assigned warehouse

### 3. Frontend User Form Updates

#### `user-form.component.ts`
- Added `depots` array to store available depots
- Added `selectedRole` tracking variable
- Added `updateFieldVisibility()` method to show/hide fields based on role:
  - For "Responsable": hides service, poste, siege; shows and requires depot
  - For other roles: shows service, poste, siege; hides depot
- Added `loadDepots()` method to fetch depots from warehouses API
- Updated form group to include `service`, `poste`, and `depot_id` fields
- Updated `loadUser()` to patch depot_id and call updateFieldVisibility()
- Updated `submit()` to include service, poste, and depot_id in payload

#### `user-form.component.html`
- Made "Siege" field conditional: `*ngIf="selectedRole !== 'Responsable'"`
- Added new "Dépôt" field (conditional): `*ngIf="selectedRole === 'Responsable'"`
- Depot field includes validation error messages

### 4. Approval Workflow Updates

#### `ConsumableRequestController.php`

##### Updated `notifyStockManagers()` method
- Now finds the responsable who has the requested product quantities in their depot
- Queries `product_stocks` joined with `warehouses` and `users` tables
- Only notifies responsables who:
  1. Have the product in stock (quantity > 0)
  2. Have a depot_id that matches a warehouse with stock
  3. Have the "responsable" or "agent" role
- Falls back to notifying all managers if:
  - Product not found
  - No stock found in any responsable's depot
  - No responsables found with stock

##### Additional Features (from user feedback)
- **Role-based form fields**: Role must be selected first, then form adapts
- **Depot required for Responsable AND Agent**: Both roles require depot selection instead of service/poste/siege
- **Per-product depot selection**: When confirming exit, responsable can choose depot for each product
- **Split product handling**: If products are in different depots, system separates them and notifies each responsable

##### New `notifyAllStockManagers()` method
- Fallback method to notify all stock managers
- Used when specific responsable cannot be determined

## Workflow Description

### Adding a Responsable User
1. Admin navigates to user creation form
2. Selects "Responsable" role from dropdown
3. Form automatically:
   - Hides Service, Poste, and Siège fields
   - Shows Dépôt field (required)
4. Admin selects a depot from the dropdown
5. User is created with `depot_id` set

### Consumable Request Approval Flow
1. **Director approves a request** → status becomes `approved_pending_exit`
2. **System notifies responsables**:
   - Finds which responsable has the requested product in their depot
   - Sends email and database notification ONLY to that responsable
   - If no specific responsable found, notifies all managers as fallback
3. **Responsable confirms exit**:
   - Pre-fills depot name from their assigned depot
   - Must select storage location for each product
   - Confirms the physical outlet

## Key Benefits

1. **Targeted Notifications**: Only the responsable with available stock receives notifications, reducing noise
2. **Clear Responsibility**: Each request is handled by the responsable who actually has the products
3. **Depot Management**: Responsables are explicitly linked to their depots
4. **Role-Based UI**: Form adapts based on selected role, showing only relevant fields

## Testing Recommendations

1. Create a Responsable user and verify:
   - Service/Poste/Siege fields are hidden
   - Depot field is visible and required
   - Depot dropdown populates correctly

2. Create a consumable request and verify:
   - Director can approve
   - Only the responsable with stock receives notification
   - Responsable can confirm exit with pre-filled depot info

3. Test edge cases:
   - Product not in any depot → all managers notified
   - Multiple responsables with stock → all relevant responsables notified
   - Responsable without depot → fallback to all managers

## Files Modified

- `backend/database/migrations/2026_05_08_000001_add_depots_to_users_table.php` (new)
- `backend/app/Models/User.php`
- `frontend/src/app/features/admin/user-form/user-form.component.ts`
- `frontend/src/app/features/admin/user-form/user-form.component.html`
- `backend/app/Http/Controllers/ConsumableRequestController.php`

## Database Changes

```sql
-- New column added to users table
ALTER TABLE users ADD COLUMN depot_id BIGINT UNSIGNED NULL;
ALTER TABLE users ADD CONSTRAINT users_depot_id_foreign 
    FOREIGN KEY (depot_id) REFERENCES warehouses(id) ON DELETE SET NULL;