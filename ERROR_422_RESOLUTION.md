# 422 Error Resolution: Consumable Request Approval Issue

## Problem Description
**Error**: `Failed to load resource: the server responded with a status of 422 (Unprocessable Content)`  
**Endpoint**: `/api/consumable-requests/22/approve`  
**Message**: "Erreur lors du traitement du lot" (Error processing the batch)

## Root Cause Analysis
Request #22 has status **`rejected`**, but the approval endpoint only accepts requests with these statuses:
- `pending` 
- `validated_by_manager`
- `partiellement_accepte`

When trying to approve a request with an invalid status (like `rejected`), the backend returns 422 with an unclear error message.

### Database State (Request #22)
```json
{
  "id": 22,
  "status": "rejected",
  "reject_reason": "jhnjkh",
  "created_at": "2026-03-11 07:59:09",
  "updated_at": "2026-05-02 18:43:57"
}
```

## Workflow Context
The request approval workflow in your system:
1. **Stock Manager** (Responsable de stock): `pending` → `validated_by_manager`
2. **Director** (Directeur): Can approve from:
   - `pending` (initial state)
   - `validated_by_manager` (after manager review)  
   - `partiellement_accepte` (partial approval - some items approved, some rejected)
   - Final state: `approved_pending_exit`

**Rejected requests cannot be re-approved** - they must be handled separately.

---

## Fixes Applied

### 1. Backend: Enhanced Error Messages (ConsumableRequestController.php)
**Before:**
```php
return response()->json(['message' => 'Workflow step not applicable for your role or current status.'], 422);
```

**After:**
```php
return response()->json([
    'message' => "Cannot approve request with status '{$currentStatus}'. Valid statuses for your role ({$role}): {$validStatuses}.",
    'current_status' => $currentStatus,
    'valid_statuses' => $isManager ? ['pending'] : ['pending', 'validated_by_manager', 'partiellement_accepte'],
    'your_role' => $role,
], 422);
```

**Benefits:**
- ✅ Returns actual status of the request
- ✅ Lists valid statuses for the user's role
- ✅ Makes debugging much easier

### 2. Frontend: Expanded Approval Status Validation (consumable-request.html)
**Before:**
```html
*ngIf="canApprove && r.status === 'pending'"
```

**After:**
```html
*ngIf="canApprove && (r.status === 'pending' || r.status === 'validated_by_manager' || r.status === 'partiellement_accepte')"
```

**Benefits:**
- ✅ Approve button now visible for all valid workflow states
- ✅ Users can properly handle requests at any approval stage
- ✅ Prevents confusion when director needs to approve manager-reviewed requests

### 3. Frontend: Smart Status Validation (consumable-request.ts)
**New helper method:**
```typescript
isApprovalValid(status: string): boolean {
  const validStatuses = ['pending', 'validated_by_manager', 'partiellement_accepte'];
  return validStatuses.includes(String(status || '').toLowerCase());
}
```

**Updated openApproveModal():**
```typescript
if (!this.isApprovalValid(request?.status)) {
  this.message = `Cannot approve request with status '${request?.status}'. Valid statuses: pending, validated_by_manager, partiellement_accepte.`;
  return;
}
```

**Benefits:**
- ✅ Prevents users from attempting to approve invalid requests
- ✅ Shows clear feedback when status is not approvable
- ✅ Validates before API call to improve UX

### 4. Frontend: Detailed Error Messages
**Enhanced error handling in both confirmApprove() and confirmApprovePartial():**

```typescript
error: (err: any) => {
  const apiError = err?.error?.message;
  const currentStatus = err?.error?.current_status;
  const validStatuses = err?.error?.valid_statuses;
  
  if (currentStatus && validStatuses) {
    this.message = `Statut invalide: ${currentStatus}. Statuts acceptes: ${validStatuses.join(', ') || 'none'}.`;
  } else if (apiError) {
    this.message = apiError;
  } else {
    this.message = 'Erreur lors du traitement du lot.';
  }
}
```

**Benefits:**
- ✅ Shows the actual status of the request
- ✅ Lists valid statuses to guide the user
- ✅ Much better debugging information

---

## Testing the Fix

### Test Case 1: Reject with Clear Feedback
```bash
# This should now show detailed error message
curl -X PUT "http://localhost:8000/api/consumable-requests/22/approve" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"approved_quantity": 50}'
```

**Expected Response:**
```json
{
  "message": "Cannot approve request with status 'rejected'. Valid statuses for your role (directeur): pending, validated_by_manager, partiellement_accepte.",
  "current_status": "rejected",
  "valid_statuses": ["pending", "validated_by_manager", "partiellement_accepte"],
  "your_role": "directeur"
}
```

### Test Case 2: Frontend Status Validation
- Try to click approve on a rejected request
- Should see: "Cannot approve request with status 'rejected'. Valid statuses: pending, validated_by_manager, partiellement_accepte."
- No API call made (caught client-side)

### Test Case 3: Normal Workflow
1. Create request (status = `pending`)
2. Manager approves (status = `validated_by_manager`)
3. Director can now approve (button shows because status is in valid list)

---

## Files Modified
1. `backend/app/Http/Controllers/ConsumableRequestController.php` - Enhanced error message
2. `frontend/src/app/consumable-request/consumable-request.html` - Expanded status validation
3. `frontend/src/app/consumable-request/consumable-request.ts` - Added validation logic and error handling

## Next Steps
1. Test the changes in your development environment
2. Verify database has no rejected requests in pending approval state
3. If needed, clean up any orphaned rejected requests from the workflow
4. Deploy to staging for UAT

## Related Statuses to Watch
Request statuses in your system:
- `draft` - Initial unsaved state
- `pending` - Awaiting manager/director approval
- `validated_by_manager` - Manager has approved, waiting for director
- `partiellement_accepte` - Partial approval (mix of approved/rejected items)
- `approved_pending_exit` - Approved, ready for physical exit
- `approved` - Fully processed
- `rejected` - Denied (cannot be re-approved)

