import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminRefService } from '../services/admin-ref.service';

@Component({
  selector: 'app-modeles',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './modeles.component.html',
  styleUrls: ['./modeles.component.css']
})
export class ModelesComponent implements OnInit {
  modeles: any[] = [];
  fabricants: any[] = [];
  marques: any[] = [];
  selectedFabricant: number | null = null;
  selectedMarque: number | null = null;

  constructor(private svc: AdminRefService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void { this.loadFabricants(); this.loadMarques(); this.load(); }

  loadFabricants(): void { this.svc.listFabricants().subscribe({ next: (r:any)=>{ this.fabricants = r || []; this.cdr.detectChanges(); } }); }
  loadMarques(): void { this.svc.listMarques().subscribe({ next: (r:any)=>{ this.marques = r || []; this.cdr.detectChanges(); } }); }
  load(): void { this.svc.listModeles({ fabricant_id: this.selectedFabricant, marque_id: this.selectedMarque }).subscribe({ next: (r:any)=>{ this.modeles = r || []; this.cdr.detectChanges(); } }); }

  add(): void {
    const name = prompt('Nom du modèle');
    if (!name) return;
    const payload: any = { name };
    if (this.selectedFabricant) payload.fabricant_id = this.selectedFabricant;
    if (this.selectedMarque) payload.marque_id = this.selectedMarque;
    this.svc.createModele(payload).subscribe({ next: ()=> this.load(), error: ()=>{} });
  }

  edit(m: any): void { const name = prompt('Modifier nom', m.name); if (!name) return; this.svc.updateModele(m.id, { name, marque_id: m.marque_id, fabricant_id: m.fabricant_id }).subscribe({ next: ()=> this.load() }); }
  remove(m: any): void { if (!confirm('Supprimer ?')) return; this.svc.deleteModele(m.id).subscribe({ next: ()=> this.load() }); }
}
