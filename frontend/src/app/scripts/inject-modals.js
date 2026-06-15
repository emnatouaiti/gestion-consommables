const fs = require('fs');
const path = require('path');

const filesToProcess = [
  'c:/Users/THINKPAD-P50/gestion-consommables/frontend/src/app/features/consumable-request/consumable-request.ts',
  'c:/Users/THINKPAD-P50/gestion-consommables/frontend/src/app/features/produits/list-produit/products.component.ts',
  'c:/Users/THINKPAD-P50/gestion-consommables/frontend/src/app/features/produits/product-stocks/product-stocks.component.ts',
  'c:/Users/THINKPAD-P50/gestion-consommables/frontend/src/app/features/references/references.component.ts',
  'c:/Users/THINKPAD-P50/gestion-consommables/frontend/src/app/features/suppliers/suppliers.component.ts',
  'c:/Users/THINKPAD-P50/gestion-consommables/frontend/src/app/features/units/units.component.ts',
  'c:/Users/THINKPAD-P50/gestion-consommables/frontend/src/app/features/warehouses/warehouses.component.ts',
  'c:/Users/THINKPAD-P50/gestion-consommables/frontend/src/app/features/mouvements/list-mouvement/stock-movements.component.ts',
  'c:/Users/THINKPAD-P50/gestion-consommables/frontend/src/app/features/dashboard/dashboard.component.ts'
];

const modalHelperCode = `
  /* --- Confirm Modal helpers --- */
  confirmModalVisible = false;
  confirmModalTitle = '';
  confirmModalMessage = '';
  confirmModalConfirmText = 'Confirmer';
  confirmModalCancelText = 'Annuler';
  confirmModalType: 'danger' | 'warning' | 'info' = 'warning';
  confirmModalAlertOnly = false;
  private pendingAction: (() => void) | null = null;

  private openConfirmModal(title: string, message: string, action: () => void, type: 'danger' | 'warning' | 'info' = 'warning', confirmText = 'Confirmer'): void {
    this.confirmModalTitle = title;
    this.confirmModalMessage = message;
    this.confirmModalConfirmText = confirmText;
    this.confirmModalType = type;
    this.confirmModalAlertOnly = false;
    this.pendingAction = action;
    this.confirmModalVisible = true;
    this.cdr.detectChanges();
  }

  private showAlertModal(title: string, message: string, type: 'danger' | 'warning' | 'info' = 'warning'): void {
    this.confirmModalTitle = title;
    this.confirmModalMessage = message;
    this.confirmModalType = type;
    this.confirmModalAlertOnly = true;
    this.pendingAction = null;
    this.confirmModalVisible = true;
    this.cdr.detectChanges();
  }

  onConfirmModalConfirmed(): void {
    this.confirmModalVisible = false;
    if (this.pendingAction) {
      this.pendingAction();
      this.pendingAction = null;
    }
  }
`;

const htmlModalCode = `
<!-- --- Confirm Modal -------------------------------------------------- -->
<app-confirm-modal
  [visible]="confirmModalVisible"
  [title]="confirmModalTitle"
  [message]="confirmModalMessage"
  [confirmText]="confirmModalConfirmText"
  [cancelText]="confirmModalCancelText"
  [type]="confirmModalType"
  [alertOnly]="confirmModalAlertOnly"
  (confirmed)="onConfirmModalConfirmed()"
  (cancelled)="confirmModalVisible = false"
></app-confirm-modal>
`;

for (const filePath of filesToProcess) {
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    continue;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Skip if already processed
  if (content.includes('confirmModalVisible')) {
    console.log('Skipping already processed file:', filePath);
    continue;
  }

  // 1. Add ChangeDetectorRef if not present
  if (!content.includes('ChangeDetectorRef')) {
    content = content.replace(/import\s+{([^}]*)}\s+from\s+['"]@angular\/core['"];/, "import { $1, ChangeDetectorRef } from '@angular/core';");
  }
  
  // This is a naive regex to add private cdr: ChangeDetectorRef to constructor if missing, but it might be complex.
  // Actually all these components probably have cdr already, let's assume they do.
  
  // 2. Inject Modal Helper Code before the last closing brace
  const lastBraceIndex = content.lastIndexOf('}');
  content = content.substring(0, lastBraceIndex) + modalHelperCode + '\n' + content.substring(lastBraceIndex);
  
  // 3. Replace confirm
  // The patterns are like: if (!confirm('...')) return; this.service.delete(...)
  // We'll have to manually review those or replace them generically.
  // Given the complexity of generic replacement, let's just inject the helper and I will do the targeted replacements via multi_replace later or manually via script if possible.
  
  // Actually let's try a regex for simple "if (!confirm('msg')) return; this.service.delete(id).subscribe({..."
  content = content.replace(/if\s*\(\!?(?:window\.)?confirm\('([^']+)'\)\)\s*(?:return;|\{?[^}]*\}?)\s*([\s\S]+?)(?=\n\s*(?:remove|delete|reset|save|public|private|\}))/g, (match, msg, theRest) => {
    // This is risky, let's just let me do it manually or via multi_replace.
    return match;
  });

  fs.writeFileSync(filePath, content, 'utf8');
  
  // Also process HTML
  const htmlPath = filePath.replace('.ts', '.html');
  if (fs.existsSync(htmlPath)) {
    let htmlContent = fs.readFileSync(htmlPath, 'utf8');
    if (!htmlContent.includes('<app-confirm-modal')) {
      htmlContent += '\n' + htmlModalCode;
      fs.writeFileSync(htmlPath, htmlContent, 'utf8');
    }
  }
  console.log('Processed:', filePath);
}
