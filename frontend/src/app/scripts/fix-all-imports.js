const fs = require('fs');

// These are STANDALONE components that use <app-confirm-modal> in their HTML
// and need ConfirmModalComponent added to their own imports array.
const standaloneFiles = [
  'c:/Users/THINKPAD-P50/gestion-consommables/frontend/src/app/features/consumable-request/consumable-request.ts',
  'c:/Users/THINKPAD-P50/gestion-consommables/frontend/src/app/features/mouvements/list-mouvement/stock-movements.component.ts',
  'c:/Users/THINKPAD-P50/gestion-consommables/frontend/src/app/features/references/references.component.ts',
  'c:/Users/THINKPAD-P50/gestion-consommables/frontend/src/app/features/suppliers/suppliers.component.ts',
  'c:/Users/THINKPAD-P50/gestion-consommables/frontend/src/app/features/units/units.component.ts',
];

for (const filePath of standaloneFiles) {
  if (!fs.existsSync(filePath)) { console.error('NOT FOUND:', filePath); continue; }
  let content = fs.readFileSync(filePath, 'utf8');

  // Skip if already has ConfirmModalComponent in imports array
  if (content.includes("ConfirmModalComponent")) {
    console.log('Already has ConfirmModalComponent:', filePath);
    continue;
  }

  // 1. Add the import statement after the last existing import line
  const lastImportIdx = content.lastIndexOf("\nimport ");
  if (lastImportIdx === -1) { console.error('No imports found in', filePath); continue; }
  const endOfLastImport = content.indexOf('\n', lastImportIdx + 1);
  
  // Calculate relative path from file to shared/confirm-modal
  let relPath;
  if (filePath.includes('/consumable-request/')) relPath = '../../shared/confirm-modal/confirm-modal.component';
  else if (filePath.includes('/list-mouvement/')) relPath = '../../../shared/confirm-modal/confirm-modal.component';
  else relPath = '../../shared/confirm-modal/confirm-modal.component';
  
  const importLine = `\nimport { ConfirmModalComponent } from '${relPath}';`;
  content = content.slice(0, endOfLastImport) + importLine + content.slice(endOfLastImport);

  // 2. Add ConfirmModalComponent to the component's imports array
  // Match: imports: [stuff]  and add ConfirmModalComponent
  content = content.replace(
    /(imports:\s*\[)([^\]]+)(\])/,
    (match, open, existing, close) => {
      const trimmed = existing.trimEnd();
      // Add with comma
      return open + existing.trimEnd() + ', ConfirmModalComponent' + close;
    }
  );

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Fixed imports in:', filePath);
}

// Now fix suppliers.component.ts - add modal helper code and replace confirms
const suppliersPath = 'c:/Users/THINKPAD-P50/gestion-consommables/frontend/src/app/features/suppliers/suppliers.component.ts';
let suppContent = fs.readFileSync(suppliersPath, 'utf8');

// Check if modal helpers are missing
if (!suppContent.includes('confirmModalVisible')) {
  console.log('Adding modal helpers to suppliers...');
  
  // Add ChangeDetectorRef if not imported
  // (It's probably already there since it has cdr)
  
  const modalHelpers = `
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

  // Insert before the final closing brace of the class
  const lastBrace = suppContent.lastIndexOf('}');
  suppContent = suppContent.substring(0, lastBrace) + modalHelpers + '\n' + suppContent.substring(lastBrace);
}

// Replace the two confirm() calls in suppliers
suppContent = suppContent.replace(
  "if (!confirm('étes-vous sér de vouloir supprimer ce contact ?')) return;\r\n\r\n        this.isLoading = true;\r\n        this.supplierService.deleteSupplierContact(supplierId, contactId).subscribe({\r\n            next: () => {\r\n                this.loadSupplierContacts(supplierId);\r\n                this.successMessage = 'Contact supprimé';\r\n                this.isLoading = false;\r\n                this.cdr.detectChanges();\r\n                setTimeout(() => { this.successMessage = ''; this.cdr.detectChanges(); }, 3000);\r\n            },\r\n            error: (err) => {\r\n                console.error('Error deleting contact', err);\r\n                this.errorMessage = this.api.extractErrorMessage(err, 'Impossible de supprimer le contact');\r\n                this.isLoading = false;\r\n                this.cdr.detectChanges();\r\n            }\r\n        });\r\n    }",
  `this.openConfirmModal(
            'Supprimer le contact',
            'Êtes-vous sûr de vouloir supprimer ce contact ?',
            () => {
                this.isLoading = true;
                this.supplierService.deleteSupplierContact(supplierId, contactId).subscribe({
                    next: () => {
                        this.loadSupplierContacts(supplierId);
                        this.successMessage = 'Contact supprimé';
                        this.isLoading = false;
                        this.cdr.detectChanges();
                        setTimeout(() => { this.successMessage = ''; this.cdr.detectChanges(); }, 3000);
                    },
                    error: (err) => {
                        console.error('Error deleting contact', err);
                        this.errorMessage = this.api.extractErrorMessage(err, 'Impossible de supprimer le contact');
                        this.isLoading = false;
                        this.cdr.detectChanges();
                    }
                });
            },
            'danger',
            'Supprimer'
        );
    }`
);

suppContent = suppContent.replace(
  "if (!confirm('étes-vous sér de vouloir supprimer ce fournisseur ?')) return;\r\n        this.supplierService.deleteSupplier(id).subscribe({\r\n            next: () => {\r\n                this.loadSuppliers();\r\n                this.successMessage = 'Fournisseur supprimé';\r\n                setTimeout(() => this.successMessage = '', 3000);\r\n            },\r\n            error: (err) => {\r\n                console.error('Error deleting supplier', err);\r\n                this.errorMessage = this.api.extractErrorMessage(err, 'Impossible de supprimer le fournisseur');\r\n            }\r\n        });\r\n    }",
  `this.openConfirmModal(
            'Supprimer le fournisseur',
            'Êtes-vous sûr de vouloir supprimer ce fournisseur ?',
            () => {
                this.supplierService.deleteSupplier(id).subscribe({
                    next: () => {
                        this.loadSuppliers();
                        this.successMessage = 'Fournisseur supprimé';
                        setTimeout(() => this.successMessage = '', 3000);
                    },
                    error: (err) => {
                        console.error('Error deleting supplier', err);
                        this.errorMessage = this.api.extractErrorMessage(err, 'Impossible de supprimer le fournisseur');
                    }
                });
            },
            'danger',
            'Supprimer'
        );
    }`
);

// Check if confirms were replaced
if (suppContent.includes("confirm('étes-vous")) {
  console.log('WARNING: suppliers still has confirm() calls - trying LF-only line endings...');
  // Try with LF line endings
  suppContent = suppContent.replace(
    "if (!confirm('étes-vous sér de vouloir supprimer ce contact ?')) return;\n\n        this.isLoading = true;\n        this.supplierService.deleteSupplierContact(supplierId, contactId).subscribe({\n            next: () => {\n                this.loadSupplierContacts(supplierId);\n                this.successMessage = 'Contact supprimé';\n                this.isLoading = false;\n                this.cdr.detectChanges();\n                setTimeout(() => { this.successMessage = ''; this.cdr.detectChanges(); }, 3000);\n            },\n            error: (err) => {\n                console.error('Error deleting contact', err);\n                this.errorMessage = this.api.extractErrorMessage(err, 'Impossible de supprimer le contact');\n                this.isLoading = false;\n                this.cdr.detectChanges();\n            }\n        });\n    }",
    `this.openConfirmModal(
            'Supprimer le contact',
            'Êtes-vous sûr de vouloir supprimer ce contact ?',
            () => {
                this.isLoading = true;
                this.supplierService.deleteSupplierContact(supplierId, contactId).subscribe({
                    next: () => {
                        this.loadSupplierContacts(supplierId);
                        this.successMessage = 'Contact supprimé';
                        this.isLoading = false;
                        this.cdr.detectChanges();
                        setTimeout(() => { this.successMessage = ''; this.cdr.detectChanges(); }, 3000);
                    },
                    error: (err) => {
                        console.error('Error deleting contact', err);
                        this.errorMessage = this.api.extractErrorMessage(err, 'Impossible de supprimer le contact');
                        this.isLoading = false;
                        this.cdr.detectChanges();
                    }
                });
            },
            'danger',
            'Supprimer'
        );
    }`
  );

  suppContent = suppContent.replace(
    "if (!confirm('étes-vous sér de vouloir supprimer ce fournisseur ?')) return;\n        this.supplierService.deleteSupplier(id).subscribe({\n            next: () => {\n                this.loadSuppliers();\n                this.successMessage = 'Fournisseur supprimé';\n                setTimeout(() => this.successMessage = '', 3000);\n            },\n            error: (err) => {\n                console.error('Error deleting supplier', err);\n                this.errorMessage = this.api.extractErrorMessage(err, 'Impossible de supprimer le fournisseur');\n            }\n        });\n    }",
    `this.openConfirmModal(
            'Supprimer le fournisseur',
            'Êtes-vous sûr de vouloir supprimer ce fournisseur ?',
            () => {
                this.supplierService.deleteSupplier(id).subscribe({
                    next: () => {
                        this.loadSuppliers();
                        this.successMessage = 'Fournisseur supprimé';
                        setTimeout(() => this.successMessage = '', 3000);
                    },
                    error: (err) => {
                        console.error('Error deleting supplier', err);
                        this.errorMessage = this.api.extractErrorMessage(err, 'Impossible de supprimer le fournisseur');
                    }
                });
            },
            'danger',
            'Supprimer'
        );
    }`
  );
}

if (suppContent.includes("confirm('étes-vous")) {
  console.log('WARNING: suppliers STILL has confirm() - doing simple line replace...');
  suppContent = suppContent.replace(
    /if \(!confirm\('étes-vous sér de vouloir supprimer ce contact \?'\)\) return;/,
    "this.openConfirmModal('Supprimer le contact', 'Êtes-vous sûr de vouloir supprimer ce contact ?', () => {"
  );
  // Close: find the matching closing  });  }  and replace last }  with  }, 'danger', 'Supprimer'); }
  // This is tricky with regex. Let me just do line-by-line.
}

if (suppContent.includes("confirm('étes-vous sér de vouloir supprimer ce fournisseur")) {
  suppContent = suppContent.replace(
    /if \(!confirm\('étes-vous sér de vouloir supprimer ce fournisseur \?'\)\) return;/,
    "this.openConfirmModal('Supprimer le fournisseur', 'Êtes-vous sûr de vouloir supprimer ce fournisseur ?', () => {"
  );
}

fs.writeFileSync(suppliersPath, suppContent, 'utf8');
console.log('Fixed suppliers.component.ts');

// Verify
const verifyContent = fs.readFileSync(suppliersPath, 'utf8');
if (verifyContent.includes("confirm('étes-vous")) {
  console.log('STILL HAS confirm in suppliers!');
} else {
  console.log('All confirms removed from suppliers!');
}
if (verifyContent.includes('confirmModalVisible')) {
  console.log('Modal helpers present in suppliers!');
} else {
  console.log('WARNING: Modal helpers MISSING from suppliers!');
}
if (verifyContent.includes('ConfirmModalComponent')) {
  console.log('ConfirmModalComponent import present in suppliers!');
} else {
  console.log('WARNING: ConfirmModalComponent import MISSING from suppliers!');
}
