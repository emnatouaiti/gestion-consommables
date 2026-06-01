import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ProductStockService } from '../../../core/services/product-stock.service';

/**
 * Composant: Ajouter ou modifier un stock avec date d'expiration
 *
 * Affiche un formulaire avec:
 * - Emplacement/Cabinet (dropdown)
 * - Fournisseur (dropdown)
 * - Quantité (input number)
 * - N° de Lot (input text)
 * - Date d'Expiration (input date) ← NOUVEAU
 */
@Component({
  selector: 'app-stock-form',
  templateUrl: './stock-form.component.html',
  styleUrls: ['./stock-form.component.scss'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule]
})
export class StockFormComponent implements OnInit {
  @Input() productId!: number;
  @Input() warehouseLocations: any[] = [];
  @Input() suppliers: any[] = [];
  @Output() stockAdded = new EventEmitter<any>();
  @Output() cancelled = new EventEmitter<void>();

  form: FormGroup;
  loading = false;
  error = '';

  constructor(
    private fb: FormBuilder,
    private productStockService: ProductStockService
  ) {
    this.form = this.fb.group({
      warehouse_location_id: ['', Validators.required],
      cabinet_id: [''],
      supplier_id: [''],
      quantity: ['', [Validators.required, Validators.min(1)]],
      batch_number: [''], // N° de lot optionnel
      expiration_date: [''], // DATE D'EXPIRATION ← NOUVEAU
    });
  }

  ngOnInit() {}

  onSubmit() {
    if (this.form.invalid) {
      this.error = 'Veuillez remplir tous les champs requis';
      return;
    }

    this.loading = true;
    this.error = '';

    const payload = {
      product_id: this.productId,
      ...this.form.value,
      // Convertir la date au format attendu par l'API si elle existe
      expiration_date: this.form.get('expiration_date')?.value || null
    };

    this.productStockService.addStock(this.productId, payload).subscribe({
      next: (response: any) => {
        this.loading = false;
        this.form.reset();
        this.stockAdded.emit(response);
      },
      error: (err: any) => {
        this.loading = false;
        this.error = err.error?.message || 'Erreur lors de l\'ajout du stock';
      }
    });
  }

  onCancel() {
    this.form.reset();
    this.error = '';
    this.cancelled.emit();
  }

  // Valider que la date d'expiration est dans le futur
  get isExpirationDateValid(): boolean {
    const expDate = this.form.get('expiration_date')?.value;
    if (!expDate) return true; // Optionnel

    const selected = new Date(expDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (selected < today) {
      this.form.get('expiration_date')?.setErrors({ 'pastDate': true });
      return false;
    }
    return true;
  }

  // Calculer les jours jusqu'à expiration
  getDaysUntilExpiration(): number | null {
    const expDate = this.form.get('expiration_date')?.value;
    if (!expDate) return null;

    const selected = new Date(expDate);
    const today = new Date();
    const diffTime = selected.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}
