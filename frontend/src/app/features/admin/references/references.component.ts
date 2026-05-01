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

  // CRUD helpers (simple prompts for quick admin)

  addMarque(): void {
    const name = prompt('Nom de la marque');
    if (!name) return;
    const payload: any = { name };
    this.svc.createMarque(payload).subscribe({ next: ()=> this.loadMarques(), error: ()=> this.error='Erreur' });
  }

  editMarque(m: any): void {
    const name = prompt('Modifier marque', m.name);
    if (!name) return;
    this.svc.updateMarque(m.id, { name }).subscribe({ next: ()=> this.loadMarques(), error: ()=> this.error='Erreur' });
  }

  deleteMarque(m: any): void { if (!confirm('Supprimer cette marque ?')) return; this.svc.deleteMarque(m.id).subscribe({ next: ()=> { this.loadMarques(); this.modeles = []; this.selectedMarque = null; }, error: ()=> this.error='Erreur' }); }

  addModele(): void {
    const name = prompt('Nom du modèle');
    if (!name) return;
    const payload: any = { name };
    if (this.selectedMarque) payload.marque_id = this.selectedMarque.id;
    this.svc.createModele(payload).subscribe({ next: ()=> this.loadModeles(), error: ()=> this.error='Erreur' });
  }

  editModele(mo: any): void {
    const name = prompt('Modifier modèle', mo.name);
    if (!name) return;
    this.svc.updateModele(mo.id, { name, marque_id: mo.marque_id }).subscribe({ next: ()=> this.loadModeles(), error: ()=> this.error='Erreur' });
  }

  deleteModele(mo: any): void { if (!confirm('Supprimer ce modèle ?')) return; this.svc.deleteModele(mo.id).subscribe({ next: ()=> this.loadModeles(), error: ()=> this.error='Erreur' }); }
}
