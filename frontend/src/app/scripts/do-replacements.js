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

// 1. References
replaceFile('c:/Users/THINKPAD-P50/gestion-consommables/frontend/src/app/features/references/references.component.ts', [
  {
    from: "alert('Veuillez sélectionner une marque d\\'abord.');",
    to: "this.showAlertModal('Attention', 'Veuillez sélectionner une marque d\\'abord.', 'warning');"
  },
  {
    from: "deleteMarque(m: any): void { if (!confirm('Supprimer cette marque ?')) return; this.svc.deleteMarque(m.id).subscribe({ next: ()=> { this.loadMarques(); this.modeles = []; this.selectedMarque = null; }, error: (err)=> this.error = this.api.extractErrorMessage(err, 'Erreur') }); }",
    to: "deleteMarque(m: any): void { this.openConfirmModal('Supprimer la marque', 'Supprimer cette marque ?', () => { this.svc.deleteMarque(m.id).subscribe({ next: ()=> { this.loadMarques(); this.modeles = []; this.selectedMarque = null; }, error: (err)=> this.error = this.api.extractErrorMessage(err, 'Erreur') }); }, 'danger', 'Supprimer'); }"
  },
  {
    from: "deleteModele(mo: any): void { if (!confirm('Supprimer ce modéle ?')) return; this.svc.deleteModele(mo.id).subscribe({ next: ()=> this.loadModeles(), error: (err)=> this.error = this.api.extractErrorMessage(err, 'Erreur') }); }",
    to: "deleteModele(mo: any): void { this.openConfirmModal('Supprimer le modèle', 'Supprimer ce modèle ?', () => { this.svc.deleteModele(mo.id).subscribe({ next: ()=> this.loadModeles(), error: (err)=> this.error = this.api.extractErrorMessage(err, 'Erreur') }); }, 'danger', 'Supprimer'); }"
  }
]);

// 2. Suppliers
replaceFile('c:/Users/THINKPAD-P50/gestion-consommables/frontend/src/app/features/suppliers/suppliers.component.ts', [
  {
    from: "if (!confirm('étes-vous sér de vouloir supprimer ce contact ?')) return;",
    to: "this.openConfirmModal('Supprimer le contact', 'Êtes-vous sûr de vouloir supprimer ce contact ?', () => {\n      this.stockService.deleteSupplierContact(this.editingSupplierId, contactId).subscribe({\n        next: () => { this.loadSupplierContacts(this.editingSupplierId); },\n        error: () => {}\n      });\n    }, 'danger', 'Supprimer');\n    return;"
  },
  {
    from: "if (!confirm('étes-vous sér de vouloir supprimer ce fournisseur ?')) return;",
    to: "this.openConfirmModal('Supprimer le fournisseur', 'Êtes-vous sûr de vouloir supprimer ce fournisseur ?', () => {\n      this.stockService.deleteSupplier(id).subscribe({\n        next: () => { this.successMessage = 'Fournisseur supprimé.'; this.loadSuppliers(); setTimeout(()=>this.successMessage='',3000); },\n        error: () => {}\n      });\n    }, 'danger', 'Supprimer');\n    return;"
  }
]);

// 3. Units
replaceFile('c:/Users/THINKPAD-P50/gestion-consommables/frontend/src/app/features/units/units.component.ts', [
  {
    from: "if (!confirm('Supprimer cette unite ?')) {\n      return;\n    }",
    to: "this.openConfirmModal('Supprimer l\\'unité', 'Supprimer cette unité ?', () => {\n      this.stockService.deleteUnit(id).subscribe({\n        next: () => { this.successMessage = 'Unité supprimée !'; this.loadUnits(); setTimeout(()=>this.successMessage='',3000); },\n        error: (err: any) => { this.errorMessage = this.extractApiError(err, 'Suppression impossible.'); }\n      });\n    }, 'danger', 'Supprimer');\n    return;"
  }
]);

// 4. Warehouses
replaceFile('c:/Users/THINKPAD-P50/gestion-consommables/frontend/src/app/features/warehouses/warehouses.component.ts', [
  {
    from: "if (!confirm('Etes-vous sur de vouloir supprimer ce depot ?')) return;",
    to: "this.openConfirmModal('Supprimer le dépôt', 'Êtes-vous sûr de vouloir supprimer ce dépôt ?', () => {\n      this.stockService.deleteWarehouse(id).subscribe({\n        next: () => { this.loadWarehouses(); },\n        error: () => {}\n      });\n    }, 'danger', 'Supprimer');\n    return;"
  },
  {
    from: "if (!confirm('Etes-vous sur de vouloir supprimer cette salle ?')) return;",
    to: "this.openConfirmModal('Supprimer la salle', 'Êtes-vous sûr de vouloir supprimer cette salle ?', () => {\n      this.stockService.deleteRoom(id).subscribe({\n        next: () => { if(this.selectedWarehouseId) this.loadRooms(this.selectedWarehouseId); },\n        error: () => {}\n      });\n    }, 'danger', 'Supprimer');\n    return;"
  },
  {
    from: "if (!confirm('Etes-vous sur de vouloir supprimer cet emplacement ?')) return;",
    to: "this.openConfirmModal('Supprimer l\\'emplacement', 'Êtes-vous sûr de vouloir supprimer cet emplacement ?', () => {\n      this.stockService.deleteLocation(id).subscribe({\n        next: () => { if(this.selectedRoomId) this.loadLocations(this.selectedRoomId); },\n        error: () => {}\n      });\n    }, 'danger', 'Supprimer');\n    return;"
  },
  {
    from: "if (!confirm('Etes-vous sur de vouloir supprimer cette armoire ?')) return;",
    to: "this.openConfirmModal('Supprimer l\\'armoire', 'Êtes-vous sûr de vouloir supprimer cette armoire ?', () => {\n      this.stockService.deleteCabinet(id).subscribe({\n        next: () => { if(this.selectedRoomId) this.loadCabinets(this.selectedRoomId); },\n        error: () => {}\n      });\n    }, 'danger', 'Supprimer');\n    return;"
  }
]);

// 5. Stock Movements
replaceFile('c:/Users/THINKPAD-P50/gestion-consommables/frontend/src/app/features/mouvements/list-mouvement/stock-movements.component.ts', [
  {
    from: "alert(err?.error?.message || 'Erreur lors de l\\'exécution.');",
    to: "this.showAlertModal('Erreur', err?.error?.message || 'Erreur lors de l\\'exécution.', 'danger');"
  },
  {
    from: "alert('Un motif est obligatoire pour rejeter un mouvement.');",
    to: "this.showAlertModal('Erreur', 'Un motif est obligatoire pour rejeter un mouvement.', 'danger');"
  },
  {
    from: "alert(err?.error?.message || 'Erreur lors du traitement.');",
    to: "this.showAlertModal('Erreur', err?.error?.message || 'Erreur lors du traitement.', 'danger');"
  },
  {
    from: "alert('Erreur lors de l\\'annulation.');",
    to: "this.showAlertModal('Erreur', 'Erreur lors de l\\'annulation.', 'danger');"
  },
  {
    from: "error: () => alert('Erreur de chargement.')",
    to: "error: () => this.showAlertModal('Erreur', 'Erreur de chargement.', 'danger')"
  }
]);

// 6. Dashboard
replaceFile('c:/Users/THINKPAD-P50/gestion-consommables/frontend/src/app/features/dashboard/dashboard.component.ts', [
  {
    from: "alert('Erreur lors du telechargement du rapport.');",
    to: "this.showAlertModal('Erreur', 'Erreur lors du téléchargement du rapport.', 'danger');"
  }
]);

