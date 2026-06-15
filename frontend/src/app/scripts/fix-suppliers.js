const fs = require('fs');

function replaceFile(filePath, replacements) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  for (const {from, to} of replacements) {
    content = content.replace(from, to);
  }
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Replaced in', filePath);
}

replaceFile('c:/Users/THINKPAD-P50/gestion-consommables/frontend/src/app/features/suppliers/suppliers.component.ts', [
  {
    from: "if (!confirm('étes-vous sér de vouloir supprimer ce contact ?')) return;",
    to: "this.openConfirmModal('Supprimer le contact', 'Êtes-vous sûr de vouloir supprimer ce contact ?', () => {\n"
  },
  {
    from: "        this.isLoading = true;\n        this.supplierService.deleteSupplierContact(supplierId, contactId).subscribe({\n            next: () => {\n                this.loadSupplierContacts(supplierId);\n                this.successMessage = 'Contact supprimé';\n                this.isLoading = false;\n                this.cdr.detectChanges();\n                setTimeout(() => { this.successMessage = ''; this.cdr.detectChanges(); }, 3000);\n            },\n            error: (err) => {\n                console.error('Error deleting contact', err);\n                this.errorMessage = this.api.extractErrorMessage(err, 'Impossible de supprimer le contact');\n                this.isLoading = false;\n                this.cdr.detectChanges();\n            }\n        });\n    }",
    to: "        this.isLoading = true;\n        this.supplierService.deleteSupplierContact(supplierId, contactId).subscribe({\n            next: () => {\n                this.loadSupplierContacts(supplierId);\n                this.successMessage = 'Contact supprimé';\n                this.isLoading = false;\n                this.cdr.detectChanges();\n                setTimeout(() => { this.successMessage = ''; this.cdr.detectChanges(); }, 3000);\n            },\n            error: (err) => {\n                console.error('Error deleting contact', err);\n                this.errorMessage = this.api.extractErrorMessage(err, 'Impossible de supprimer le contact');\n                this.isLoading = false;\n                this.cdr.detectChanges();\n            }\n        });\n      }, 'danger', 'Supprimer');\n    }"
  },
  {
    from: "if (!confirm('étes-vous sér de vouloir supprimer ce fournisseur ?')) return;",
    to: "this.openConfirmModal('Supprimer le fournisseur', 'Êtes-vous sûr de vouloir supprimer ce fournisseur ?', () => {\n"
  },
  {
    from: "        this.supplierService.deleteSupplier(id).subscribe({\n            next: () => {\n                this.loadSuppliers();\n                this.successMessage = 'Fournisseur supprimé';\n                setTimeout(() => this.successMessage = '', 3000);\n            },\n            error: (err) => {\n                console.error('Error deleting supplier', err);\n                this.errorMessage = this.api.extractErrorMessage(err, 'Impossible de supprimer le fournisseur');\n            }\n        });\n    }",
    to: "        this.supplierService.deleteSupplier(id).subscribe({\n            next: () => {\n                this.loadSuppliers();\n                this.successMessage = 'Fournisseur supprimé';\n                setTimeout(() => this.successMessage = '', 3000);\n            },\n            error: (err) => {\n                console.error('Error deleting supplier', err);\n                this.errorMessage = this.api.extractErrorMessage(err, 'Impossible de supprimer le fournisseur');\n            }\n        });\n      }, 'danger', 'Supprimer');\n    }"
  }
]);
