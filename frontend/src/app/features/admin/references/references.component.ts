import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminRefService } from '../services/admin-ref.service';

@Component({
  selector: 'app-references',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './references.component.html',
  styleUrls: ['./references.component.css']
})
export class ReferencesComponent implements OnInit {
  marques: any[] = [];
  modeles: any[] = [];

  selectedMarque: any = null;

  error = '';

  // Modal state
  showModal = false;
  modalTitle = '';
  modalInput = '';
  modalType: 'marque' | 'modele' = 'marque';
  modalMode: 'add' | 'edit' = 'add';
  editingItem: any = null;

  constructor(private svc: AdminRefService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadMarques();
  }

  loadMarques(): void {
    const params: any = {};
    this.svc.listMarques(params).subscribe({ next: (r:any) => { this.marques = Array.isArray(r) ? r : []; this.cdr.detectChanges(); }, error: () => { this.marques = []; } });
  }

  selectMarque(m: any): void {
    this.selectedMarque = m;
    this.loadModeles();
  }

  loadModeles(): void {
    const params: any = {};
    if (this.selectedMarque) params.marque_id = this.selectedMarque.id;
    this.svc.listModeles(params).subscribe({ next: (r:any) => { this.modeles = Array.isArray(r) ? r : []; this.cdr.detectChanges(); }, error: () => { this.modeles = []; } });
  }

  // Modal actions

  addMarque(): void {
    this.modalType = 'marque';
    this.modalMode = 'add';
    this.modalTitle = 'Ajouter une Marque';
    this.modalInput = '';
    this.editingItem = null;
    this.showModal = true;
  }

  editMarque(m: any): void {
    this.modalType = 'marque';
    this.modalMode = 'edit';
    this.modalTitle = 'Modifier la Marque';
    this.modalInput = m.name;
    this.editingItem = m;
    this.showModal = true;
  }

  addModele(): void {
    if (!this.selectedMarque) {
      alert('Veuillez sélectionner une marque d\'abord.');
      return;
    }
    this.modalType = 'modele';
    this.modalMode = 'add';
    this.modalTitle = `Nouveau Modèle (${this.selectedMarque.name})`;
    this.modalInput = '';
    this.editingItem = null;
    this.showModal = true;
  }

  editModele(mo: any): void {
    this.modalType = 'modele';
    this.modalMode = 'edit';
    this.modalTitle = 'Modifier le Modèle';
    this.modalInput = mo.name;
    this.editingItem = mo;
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.modalInput = '';
    this.editingItem = null;
  }

  saveModal(): void {
    const name = this.modalInput.trim();
    if (!name) return;

    if (this.modalType === 'marque') {
      if (this.modalMode === 'add') {
        this.svc.createMarque({ name }).subscribe({ next: () => { this.loadMarques(); this.closeModal(); }, error: () => this.error = 'Erreur' });
      } else {
        this.svc.updateMarque(this.editingItem.id, { name }).subscribe({ next: () => { this.loadMarques(); this.closeModal(); }, error: () => this.error = 'Erreur' });
      }
    } else {
      if (this.modalMode === 'add') {
        const payload = { name, marque_id: this.selectedMarque.id };
        this.svc.createModele(payload).subscribe({ next: () => { this.loadModeles(); this.closeModal(); }, error: () => this.error = 'Erreur' });
      } else {
        this.svc.updateModele(this.editingItem.id, { name, marque_id: this.editingItem.marque_id }).subscribe({ next: () => { this.loadModeles(); this.closeModal(); }, error: () => this.error = 'Erreur' });
      }
    }
  }

  deleteMarque(m: any): void { if (!confirm('Supprimer cette marque ?')) return; this.svc.deleteMarque(m.id).subscribe({ next: ()=> { this.loadMarques(); this.modeles = []; this.selectedMarque = null; }, error: ()=> this.error='Erreur' }); }

  deleteModele(mo: any): void { if (!confirm('Supprimer ce modèle ?')) return; this.svc.deleteModele(mo.id).subscribe({ next: ()=> this.loadModeles(), error: ()=> this.error='Erreur' }); }
}
