import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminRefService } from '../../core/services/admin-ref.service';
import { ApiService } from '../../core/services/api.service';
import { ConfirmModalComponent } from '../../shared/confirm-modal/confirm-modal.component';

@Component({
  selector: 'app-references',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmModalComponent],
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

  constructor(private svc: AdminRefService, private cdr: ChangeDetectorRef, private api: ApiService) {}

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
      this.showAlertModal('Attention', 'Veuillez selectionner une marque d\'abord.', 'warning');
      return;
    }
    this.modalType = 'modele';
    this.modalMode = 'add';
    this.modalTitle = `Nouveau Modele (${this.selectedMarque.name})`;
    this.modalInput = '';
    this.editingItem = null;
    this.showModal = true;
  }

  editModele(mo: any): void {
    this.modalType = 'modele';
    this.modalMode = 'edit';
    this.modalTitle = 'Modifier le Modele';
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
        this.svc.createMarque({ name }).subscribe({ next: () => { this.loadMarques(); this.closeModal(); }, error: (err) => this.error = this.api.extractErrorMessage(err, 'Erreur') });
      } else {
        this.svc.updateMarque(this.editingItem.id, { name }).subscribe({ next: () => { this.loadMarques(); this.closeModal(); }, error: (err) => this.error = this.api.extractErrorMessage(err, 'Erreur') });
      }
    } else {
      if (this.modalMode === 'add') {
        const payload = { name, marque_id: this.selectedMarque.id };
        this.svc.createModele(payload).subscribe({ next: () => { this.loadModeles(); this.closeModal(); }, error: (err) => this.error = this.api.extractErrorMessage(err, 'Erreur') });
      } else {
        this.svc.updateModele(this.editingItem.id, { name, marque_id: this.editingItem.marque_id }).subscribe({ next: () => { this.loadModeles(); this.closeModal(); }, error: (err) => this.error = this.api.extractErrorMessage(err, 'Erreur') });
      }
    }
  }

  deleteMarque(m: any): void { this.openConfirmModal('Supprimer la marque', 'Supprimer cette marque ?', () => { this.svc.deleteMarque(m.id).subscribe({ next: ()=> { this.loadMarques(); this.modeles = []; this.selectedMarque = null; }, error: (err)=> this.error = this.api.extractErrorMessage(err, 'Erreur') }); }, 'danger', 'Supprimer'); }

  deleteModele(mo: any): void { this.openConfirmModal('Supprimer le modele', 'Supprimer ce modele ?', () => { this.svc.deleteModele(mo.id).subscribe({ next: ()=> this.loadModeles(), error: (err)=> this.error = this.api.extractErrorMessage(err, 'Erreur') }); }, 'danger', 'Supprimer'); }

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

}
