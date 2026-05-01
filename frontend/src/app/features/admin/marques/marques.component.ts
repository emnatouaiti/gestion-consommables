import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminRefService } from '../services/admin-ref.service';

@Component({
  selector: 'app-marques',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './marques.component.html',
  styleUrls: ['./marques.component.css']
})
export class MarquesComponent implements OnInit {
  marques: any[] = [];
  fabricants: any[] = [];
  selectedFabricant: number | null = null;

  constructor(private svc: AdminRefService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void { this.loadFabricants(); this.load(); }

  loadFabricants(): void { this.svc.listFabricants().subscribe({ next: (r:any)=>{ this.fabricants = r || []; this.cdr.detectChanges(); } }); }

  load(): void {
    this.svc.listMarques(this.selectedFabricant ? { fabricant_id: this.selectedFabricant } : undefined).subscribe({ next: (r:any)=>{ this.marques = r || []; this.cdr.detectChanges(); } });
  }

  add(): void {
    const name = prompt('Nom de la marque');
    if (!name) return;
    const payload: any = { name };
    if (this.selectedFabricant) payload.fabricant_id = this.selectedFabricant;
    this.svc.createMarque(payload).subscribe({ next: ()=> this.load(), error: ()=>{} });
  }

  edit(m: any): void {
    const name = prompt('Modifier nom', m.name);
    if (!name) return;
    this.svc.updateMarque(m.id, { name, fabricant_id: m.fabricant_id }).subscribe({ next: ()=> this.load(), error: ()=>{} });
  }

  remove(m: any): void { if (!confirm('Supprimer ?')) return; this.svc.deleteMarque(m.id).subscribe({ next: ()=> this.load(), error: ()=>{} }); }
}
