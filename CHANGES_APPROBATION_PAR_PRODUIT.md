# Modifications - Approbation par Produit et Email de Rejet

## Résumé des Changements

### 1. Backend - Notification d'Email Rejet ✓ COMPLÉTÉ

**Fichier**: `backend/app/Http/Controllers/ConsumableRequestController.php`

**Modification**: La fonction `reject()` (ligne ~503) a été mise à jour pour envoyer une notification au demandeur:

```php
// Ajout de l'envoi d'email lors du rejet:
try {
    $this->notifyRequester($requestsToReject);
} catch (\Throwable $e) {
    Log::error('Failed to notify requester on reject', ['err' => $e->getMessage()]);
}
```

**Résultat**: Quand un directeur rejette une demande, un email est automatiquement envoyé au demandeur avec:
- Le motif du refus (si fourni)
- Les articles refusés avec leurs quantités
- Un lien pour consulter la demande

---

### 2. Frontend TypeScript - Support Approbation par Produit ✓ COMPLÉTÉ

**Fichier**: `frontend/src/app/consumable-request/consumable-request.ts`

**Modifications apportées**:

#### a) Nouvelle variable pour stocker les quantités par produit (ligne ~60):
```typescript
modalApprovedQuantities: Record<number, number> = {}; // For per-product approval quantities
```

#### b) Mise à jour de `openApproveModal()` (ligne ~596):
Initialise maintenant les quantités suggérées pour chaque produit du lot:
```typescript
// For batch items - initialize quantities map
this.modalApprovedQuantities = {};
if (Array.isArray(request?.items)) {
  for (const item of request.items) {
    const suggested = Number(item?.suggested_approved_quantity);
    this.modalApprovedQuantities[item.id] = Number.isFinite(suggested) 
      ? suggested 
      : Number(item?.requested_quantity || 0);
  }
}
```

#### c) Mise à jour de `closeApproveModal()` (ligne ~615):
```typescript
this.modalApprovedQuantities = {}; // Clear quantities map
```

#### d) Mise à jour de `confirmApprove()` (ligne ~630):
Envoie maintenant les quantités par produit pour les lots:
```typescript
if (!isBatch) {
  payload = { approved_quantity: approvedQuantity };
} else {
  // Build approved_quantities map for each item
  const quantities: Record<number, number> = {};
  let hasValidQuantities = false;
  
  for (const item of request.items) {
    const qty = Number(this.modalApprovedQuantities[item.id] ?? 0);
    if (qty > 0) {
      hasValidQuantities = true;
    }
    quantities[item.id] = qty;
  }
  
  if (!hasValidQuantities) {
    this.message = 'Veuillez approuver au moins un produit du lot.';
    return;
  }
  payload = { approved_quantities: quantities };
}
```

---

### 3. Frontend HTML - Modal d'Approbation Améliorée ⚠️ NÉCESSITE MISE À JOUR MANUELLE

**Fichier**: `frontend/src/app/consumable-request/consumable-request.html`

La section de la **MODAL: APPROBATION** (autour de ligne 414) doit être remplacée pour afficher les champs d'ajustement individuels pour chaque produit du lot.

#### Section HTML à remplacer:

Remplacez le contenu entre `<!-- MODAL: APPROBATION -->` et `</div>` (fin du modal) par:

```html
<!-- MODAL: APPROBATION -->
<div class="cr-overlay" *ngIf="selectedRequestForApproval" (click)="closeApproveModal()">
  <div class="cr-modal cr-modal--wide" (click)="$event.stopPropagation()">
    <div class="cr-modal-header">
      <h3>Validation de la demande <small *ngIf="selectedRequestForApproval?.batch_code" style="opacity: 0.7;">(Lot complet)</small></h3>
      <button class="cr-modal-close" (click)="closeApproveModal()">x</button>
    </div>

    <!-- Single Item Approval -->
    <ng-container *ngIf="!(selectedRequestForApproval?.items?.length > 1)">
      <div class="cr-approval-grid">
        <div class="cr-approval-cell">
          <span class="cr-approval-label">Article</span>
          <span class="cr-approval-value">{{ selectedRequestForApproval?.item_name }}</span>
        </div>
        <div class="cr-approval-cell">
          <span class="cr-approval-label">Demandeur</span>
          <span class="cr-approval-value">{{ selectedRequestForApproval?.requester_name || selectedRequestForApproval?.user?.nomprenom || '-' }}</span>
        </div>
        <div class="cr-approval-cell">
          <span class="cr-approval-label">Service</span>
          <span class="cr-approval-value">{{ selectedRequestForApproval?.requester_service || '-' }}</span>
        </div>
        <div class="cr-approval-cell">
          <span class="cr-approval-label">Poste</span>
          <span class="cr-approval-value">{{ selectedRequestForApproval?.requester_poste || '-' }}</span>
        </div>
        <div class="cr-approval-cell">
          <span class="cr-approval-label">Quantite demandee</span>
          <span class="cr-approval-value cr-approval-value--num">{{ selectedRequestForApproval?.requested_quantity }}</span>
        </div>
        <div class="cr-approval-cell">
          <span class="cr-approval-label">Stock disponible</span>
          <span class="cr-approval-value cr-approval-value--num">{{ selectedRequestForApproval?.available_stock ?? '-' }}</span>
        </div>
        <div class="cr-approval-cell cr-approval-cell--highlight">
          <span class="cr-approval-label">Suggestion systeme</span>
          <span class="cr-approval-value cr-approval-value--num">{{ selectedRequestForApproval?.suggested_approved_quantity ?? '-' }}</span>
        </div>
      </div>

      <div class="cr-field" style="margin-top: 1.25rem;">
        <label>Quantite a approuver</label>
        <div class="cr-qty-row">
          <input
            type="number" min="0"
            [max]="selectedRequestForApproval?.available_stock ?? selectedRequestForApproval?.requested_quantity"
            [(ngModel)]="modalApprovedQuantity"
          >
          <button type="button" class="cr-btn cr-btn--ghost" (click)="useSuggestedQuantity()">
            Utiliser suggestion
          </button>
        </div>
      </div>
    </ng-container>

    <!-- Multiple Items Approval -->
    <ng-container *ngIf="selectedRequestForApproval?.items?.length > 1">
      <div style="padding: 20px; background: var(--e-50); border-radius: 6px; margin-bottom: 20px;">
        <h4 style="margin: 0 0 15px 0; font-size: 14px; color: var(--e-800);">Approbation des produits du lot</h4>
        <div style="display: flex; flex-direction: column; gap: 15px;">
          <div *ngFor="let item of selectedRequestForApproval.items" style="padding: 12px; background: white; border: 1px solid var(--e-200); border-radius: 4px;">
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 12px; align-items: end;">
              <div>
                <label style="font-size: 12px; color: var(--e-600); display: block; margin-bottom: 4px;">Produit</label>
                <span style="font-weight: 500;">{{ item.item_name }}</span>
              </div>
              <div>
                <label style="font-size: 12px; color: var(--e-600); display: block; margin-bottom: 4px;">Demande</label>
                <span>{{ item.requested_quantity }}</span>
              </div>
              <div>
                <label style="font-size: 12px; color: var(--e-600); display: block; margin-bottom: 4px;">Stock</label>
                <span>{{ item.available_stock ?? '-' }}</span>
              </div>
              <div>
                <label style="font-size: 12px; color: var(--e-600); display: block; margin-bottom: 4px;">Approuver</label>
                <input type="number" min="0" [max]="item.available_stock ?? item.requested_quantity"
                  [(ngModel)]="modalApprovedQuantities[item.id]"
                  style="width: 100%; padding: 6px; border: 1px solid var(--e-300); border-radius: 4px;">
              </div>
            </div>
          </div>
        </div>
      </div>
    </ng-container>

    <div class="cr-modal-footer">
      <button class="cr-btn cr-btn--approve cr-btn--lg" [disabled]="approving" (click)="confirmApprove()">
        {{ approving ? 'Validation...' : 'Confirmer l\'approbation' }}
      </button>
      <button class="cr-btn cr-btn--ghost cr-btn--lg" (click)="closeApproveModal()">Annuler</button>
    </div>
  </div>
</div>
```

---

## Instructions pour Appliquer les Changements

### Changements déjà appliqués automatiquement ✓
1. **Backend** - Envoi d'email de rejet configuré
2. **TypeScript** - Logique d'approbation par produit implémentée

### Changements à appliquer manuellement ⚠️
1. **HTML** - Remplacer la section MODAL: APPROBATION

Pour appliquer le changement HTML:
1. Ouvrir `frontend/src/app/consumable-request/consumable-request.html`
2. Localiser `<!-- MODAL: APPROBATION -->`
3. Remplacer la section complète du modal par le code HTML fourni ci-dessus
4. Sauvegarder le fichier

---

## Fonctionnalités Nouvelles

### 1. Approbation par Produit
- Quand un directeur approuve un lot de plusieurs produits, il peut maintenant ajuster la quantité approuvée **pour chaque produit individuellement**
- Les suggestions du système sont pré-remplies
- Au moins un produit doit avoir une quantité > 0

### 2. Notification par Email Rejet
- Quand un directeur rejette une demande, un email est **automatiquement envoyé au demandeur**
- L'email inclut:
  - Le motif du refus (si fourni)
  - La liste des articles refusés
  - Un lien pour consulter la demande

---

## Vérification

Pour vérifier que tout fonctionne:

1. Testez l'approbation d'une demande unique (comportement existant)
2. Testez l'approbation d'un lot avec multiple produits:
   - La modal doit afficher les champs d'ajustement pour chaque produit
   - Vérifiez que les quantités suggérées sont pré-remplies
   - Modifiez les quantités et validez
3. Testez un rejet de demande:
   - Vérifiez que l'email est reçu par le demandeur

---

## Notes Techniques

- Le backend supporte déjà `approved_quantities` (map: id->quantity) depuis la fonction approve
- Le frontend envoie maintenant correctement cette map en cas de lot
- La notification par email utilise la classe `ConsumableRequestNotification` existante qui gère déjà les rejets
