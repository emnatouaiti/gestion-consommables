import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminRefService } from '../services/admin-ref.service';

@Component({
  selector: 'app-fabricants',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './fabricants.component.html',
  styleUrls: ['./fabricants.component.css']
})
export class FabricantsComponent implements OnInit {
  fabricants: any[] = [];
  error = '';

  constructor(private svc: AdminRefService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.svc.listFabricants().subscribe({ next: (res:any)=>{ this.fabricants = res || []; this.cdr.detectChanges(); }, error: ()=>{ this.fabricants = []; } });
  }

  add(): void {
    const name = prompt('Nom du fabricant');
    if (!name) return;
    this.svc.createFabricant({ name }).subscribe({ next: ()=>{ this.load(); }, error: (e)=>{ this.error = 'Erreur'; } });
  }

  edit(item: any): void {
    const name = prompt('Modifier nom', item.name);
    if (!name) return;
    this.svc.updateFabricant(item.id, { name }).subscribe({ next: ()=>{ this.load(); }, error: ()=>{ this.error='Erreur'; } });
  }

  remove(item: any): void {
    if (!confirm('Supprimer ?')) return;
    this.svc.deleteFabricant(item.id).subscribe({ next: ()=>{ this.load(); }, error: ()=>{ this.error='Erreur'; } });
  }
}
