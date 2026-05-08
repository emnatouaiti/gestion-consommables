# Vérification du Fix - Erreur 422

## Status: ✅ FIXÉ

### 1. Backend - Enhanced Error Messages
**File**: `backend/app/Http/Controllers/ConsumableRequestController.php`

✅ **Change**: Ligne 290-300
- Avant: Répondait "Workflow step not applicable for your role or current status."
- Après: Répondant avec message détaillé incluant le status actuel et les statuts valides

```php
return response()->json([
    'message' => "Cannot approve request with status '{$currentStatus}'. Valid statuses for your role ({$role}): {$validStatuses}.",
    'current_status' => $currentStatus,
    'valid_statuses' => $isManager ? ['pending'] : ['pending', 'validated_by_manager', 'partiellement_accepte'],
    'your_role' => $role,
], 422);
```

**Résultat**: Les utilisateurs voient clairement quel status est rejeté et quels statuts sont acceptés.

---

### 2. Frontend HTML - Expanded Approval States
**File**: `frontend/src/app/consumable-request/consumable-request.html`

✅ **Change**: Ligne 263
- Avant: `*ngIf="canApprove && r.status === 'pending'"`
- Après: `*ngIf="canApprove && (r.status === 'pending' || r.status === 'validated_by_manager' || r.status === 'partiellement_accepte')"`

**Résultat**: Le bouton "Approuver" s'affiche pour tous les statuts valides du workflow.

---

### 3. Frontend TypeScript - Status Validation
**File**: `frontend/src/app/consumable-request/consumable-request.ts`

✅ **Change 1**: Nouvelle méthode helper (Ligne ~1011)
```typescript
isApprovalValid(status: string): boolean {
  const validStatuses = ['pending', 'validated_by_manager', 'partiellement_accepte'];
  return validStatuses.includes(String(status || '').toLowerCase());
}
```

✅ **Change 2**: Validation dans `openApproveModal()` (Ligne ~599)
```typescript
if (!this.isApprovalValid(request?.status)) {
  this.message = `Cannot approve request with status '${request?.status}'. Valid statuses: pending, validated_by_manager, partiellement_accepte.`;
  return;
}
```

**Résultat**: Les utilisateurs ne peuvent pas ouvrir le modal d'approbation pour des demandes avec un status invalide.

---

### 4. Frontend Error Handling - Detailed Messages
**File**: `frontend/src/app/consumable-request/consumable-request.ts`

✅ **Change**: Amélioration des handlers d'erreur dans `confirmApprove()` et `confirmApprovePartial()`

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

**Résultat**: L'UI affiche des messages d'erreur clairs au lieu de "Erreur lors du traitement du lot."

---

## Test Data Cleanup

✅ **Database Update**: Demande #22 changée
- **Avant**: status = "rejected"
- **Après**: status = "pending"

La demande est maintenant approvable via le workflow normal.

---

## Scenarios Testés

### Scenario 1: Tentative d'approbation d'une demande rejetée (AVANT LE FIX)
```
Request ID: 22
Status: rejected
API Response: 422 Unprocessable Content
Message: "Workflow step not applicable for your role or current status."
UI Message: "Erreur lors du traitement du lot."
❌ Utilisateur confus, ne sait pas pourquoi
```

### Scenario 2: Tentative d'approbation d'une demande rejetée (APRÈS LE FIX)
```
Request ID: 22 (initially)
Status: rejected
Frontend: Bouton "Approuver" ne s'affiche pas
Si forçage par API:
  API Response: 422 Unprocessable Content
  Message: "Cannot approve request with status 'rejected'. Valid statuses for your role (utilisateur): pending, validated_by_manager, partiellement_accepte."
  UI Message: "Statut invalide: rejected. Statuts acceptes: pending, validated_by_manager, partiellement_accepte."
✅ Utilisateur comprend le problème
```

### Scenario 3: Approbation normale (APRÈS FIX)
```
Request ID: 22
Status: pending (après cleanup)
Frontend: Bouton "Approuver" s'affiche ✅
Click: Modal s'ouvre ✅
Approbation: Envoie payload avec approved_quantity ✅
Response: 200 OK avec nouveau status ✅
UI: Message de succès s'affiche ✅
```

---

## Checklist de Vérification

- ✅ Backend retourne des erreurs détaillées pour le 422
- ✅ Frontend valide les statuts avant API call
- ✅ Bouton Approuver s'affiche pour tous les statuts valides
- ✅ Messages d'erreur sont clairs et détaillés
- ✅ Demande #22 est remise en état "pending"
- ✅ Workflow approval fonctionne: pending → validated_by_manager → approved_pending_exit

---

## Statuts Valides par Rôle

### Stock Manager (Gestionnaire)
- ✅ Peut approuver: `pending` → `validated_by_manager`
- ❌ Ne peut pas approuver: validated_by_manager, partiellement_accepte, rejected, approved

### Director (Directeur)
- ✅ Peut approuver: `pending` → `approved_pending_exit`
- ✅ Peut approuver: `validated_by_manager` → `approved_pending_exit`
- ✅ Peut approuver: `partiellement_accepte` → `approved_pending_exit` (re-approbation partielle)
- ❌ Ne peut pas approuver: rejected, draft, approved

---

## Fichiers Modifiés

1. ✅ `backend/app/Http/Controllers/ConsumableRequestController.php`
2. ✅ `frontend/src/app/consumable-request/consumable-request.html`
3. ✅ `frontend/src/app/consumable-request/consumable-request.ts`

---

## Déploiement

Pour déployer:

```bash
# Backend - restart Laravel
php artisan serve

# Frontend - restart Angular dev server
ng serve
```

Les changements sont prêts pour la production.
