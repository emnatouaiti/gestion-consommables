import { Component, OnInit, PLATFORM_ID, Inject, ChangeDetectorRef } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SupplierService } from '../../../core/services/supplier.service';
import { Supplier } from '../../../core/models/supplier.model';
import { SupplierContact } from '../../../core/models/supplier-contact.model';

@Component({
    selector: 'app-suppliers',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './suppliers.component.html',
    styleUrls: ['./suppliers.component.css']
})
export class SuppliersComponent implements OnInit {
    suppliers: Supplier[] = [];
    filteredSuppliers: Supplier[] = [];
    searchQuery = '';
    isLoading = false;
    showModal = false;
    editingSupplierId: number | null = null;
    selectedSupplier: Supplier | null = null;
    showProductsModal = false;
    availableProducts: any[] = [];
    selectedProductIds: number[] = [];

    showContactsModal = false;
    contactsSupplierId: number | null = null;
    contactsSupplierName = '';
    supplierContacts: SupplierContact[] = [];
    showContactModal = false;
    editingContactId: number | null = null;
    isContactsLoading = false;
    viewMode: 'grid' | 'list' = 'grid';

    contactForm: Omit<SupplierContact, 'id'> = {
        name: '',
        role: '',
        phone: '',
        email: '',
        notes: ''
    };

    supplierForm = {
        name: '',
        notes: '',
        phone: '',
        email: '',
        photo: null as File | null
    };

    photoPreview: string | null = null;
    successMessage = '';
    errorMessage = '';

    newReviewContent = '';
    newReviewRating: number | undefined = 5;

    constructor(
        private supplierService: SupplierService,
        private readonly cdr: ChangeDetectorRef,
        @Inject(PLATFORM_ID) private readonly platformId: Object
    ) { }

    ngOnInit(): void {
        if (!isPlatformBrowser(this.platformId)) {
            return;
        }
        this.loadSuppliers();
        this.loadAvailableProducts();
    }

    loadAvailableProducts(): void {
        if (!isPlatformBrowser(this.platformId)) {
            return;
        }
        this.supplierService.getProductsList().subscribe({
            next: (res: any) => {
                const products = res.data || res;
                this.availableProducts = products.map((p: any) => ({ ...p, selected: false }));
                this.cdr.detectChanges();
            },
            error: (err) => {
                console.error('Error loading products', err);
            }
        });
    }

    loadSuppliers(): void {
        if (!isPlatformBrowser(this.platformId)) {
            return;
        }
        this.isLoading = true;
        this.supplierService.getSuppliers().subscribe({
            next: (data) => {
                this.suppliers = data;
                this.filteredSuppliers = [...data];
                this.isLoading = false;
                this.cdr.detectChanges();
            },
            error: (err) => {
                console.error('Error loading suppliers', err);
                this.isLoading = false;
                this.errorMessage = 'Erreur lors du chargement des fournisseurs';
                this.cdr.detectChanges();
            }
        });
    }

    onSearch(): void {
        const query = this.searchQuery.toLowerCase().trim();
        
        if (!query) {
            this.filteredSuppliers = [...this.suppliers];
        } else {
            this.filteredSuppliers = this.suppliers.filter(supplier => 
                supplier.name.toLowerCase().includes(query) ||
                supplier.phone?.toLowerCase().includes(query) ||
                supplier.email?.toLowerCase().includes(query)
            );
        }
        this.cdr.detectChanges();
    }

    clearSearch(): void {
        this.searchQuery = '';
        this.filteredSuppliers = [...this.suppliers];
        this.cdr.detectChanges();
    }

    setViewMode(mode: 'grid' | 'list'): void {
        this.viewMode = mode;
    }

    viewProducts(supplier: Supplier): void {
        if (!isPlatformBrowser(this.platformId)) {
            return;
        }
        this.isLoading = true;
        this.supplierService.getSupplier(supplier.id).subscribe({
            next: (data) => {
                this.selectedSupplier = data;
                this.showProductsModal = true;
                this.isLoading = false;
                this.ensureSupplierContactsLoaded();
                this.cdr.detectChanges();
            },
            error: (err) => {
                console.error('Error loading supplier products', err);
                this.isLoading = false;
                this.errorMessage = 'Erreur lors du chargement des produits';
                this.cdr.detectChanges();
            }
        });
    }

    closeProductsModal(): void {
        this.showProductsModal = false;
        this.selectedSupplier = null;
    }

    openContacts(supplier: Supplier): void {
        if (!isPlatformBrowser(this.platformId)) return;
        this.contactsSupplierId = supplier.id;
        this.contactsSupplierName = supplier.name;
        this.showContactsModal = true;
        this.loadSupplierContacts(supplier.id);
    }

    closeContactsModal(): void {
        this.showContactsModal = false;
        this.contactsSupplierId = null;
        this.contactsSupplierName = '';
        this.supplierContacts = [];
        this.closeContactModal();
    }

    private ensureSupplierContactsLoaded(): void {
        if (!isPlatformBrowser(this.platformId)) return;
        const supplier = this.selectedSupplier;
        if (!supplier) return;
        if (Array.isArray(supplier.contacts)) return;
        this.loadSupplierContacts(supplier.id);
    }

    private loadSupplierContacts(supplierId: number): void {
        if (!isPlatformBrowser(this.platformId)) return;
        this.isContactsLoading = true;
        this.supplierService.getSupplierContacts(supplierId).subscribe({
            next: (contacts) => {
                if (this.selectedSupplier?.id === supplierId) {
                    this.selectedSupplier = { ...this.selectedSupplier, contacts: contacts || [] };
                }
                if (this.contactsSupplierId === supplierId) {
                    this.supplierContacts = contacts || [];
                }
                this.isContactsLoading = false;
                this.cdr.detectChanges();
            },
            error: (err) => {
                console.error('Error loading supplier contacts', err);
                if (this.selectedSupplier?.id === supplierId) {
                    this.selectedSupplier = { ...this.selectedSupplier, contacts: [] };
                }
                if (this.contactsSupplierId === supplierId) {
                    this.supplierContacts = [];
                }
                this.isContactsLoading = false;
                this.cdr.detectChanges();
            }
        });
    }

    openAddContactModal(): void {
        this.editingContactId = null;
        this.contactForm = { name: '', role: '', phone: '', email: '', notes: '' };
        this.showContactModal = true;
    }

    openEditContactModal(contact: SupplierContact): void {
        this.editingContactId = contact.id;
        this.contactForm = {
            name: contact.name || '',
            role: contact.role || '',
            phone: contact.phone || '',
            email: contact.email || '',
            notes: contact.notes || ''
        };
        this.showContactModal = true;
    }

    closeContactModal(): void {
        this.showContactModal = false;
        this.editingContactId = null;
        this.contactForm = { name: '', role: '', phone: '', email: '', notes: '' };
    }

    saveContact(): void {
        if (!isPlatformBrowser(this.platformId)) return;
        const supplierId = this.contactsSupplierId ?? this.selectedSupplier?.id ?? null;
        if (!supplierId) return;
        if (!this.contactForm.name?.trim()) {
            this.errorMessage = 'Le nom du contact est obligatoire';
            return;
        }

        this.isLoading = true;

        const request = this.editingContactId
            ? this.supplierService.updateSupplierContact(supplierId, this.editingContactId, this.contactForm)
            : this.supplierService.createSupplierContact(supplierId, this.contactForm);

        request.subscribe({
            next: () => {
                this.loadSupplierContacts(supplierId);
                this.closeContactModal();
                this.successMessage = this.editingContactId ? 'Contact mis à jour' : 'Contact ajouté';
                this.isLoading = false;
                this.cdr.detectChanges();
                setTimeout(() => {
                    this.successMessage = '';
                    this.cdr.detectChanges();
                }, 3000);
            },
            error: (err) => {
                console.error('Error saving contact', err);
                this.errorMessage = 'Erreur lors de l’enregistrement du contact';
                this.isLoading = false;
                this.cdr.detectChanges();
            }
        });
    }

    deleteContact(contactId: number): void {
        if (!isPlatformBrowser(this.platformId)) return;
        const supplierId = this.contactsSupplierId ?? this.selectedSupplier?.id ?? null;
        if (!supplierId) return;

        if (!confirm('Êtes-vous sûr de vouloir supprimer ce contact ?')) return;

        this.isLoading = true;
        this.supplierService.deleteSupplierContact(supplierId, contactId).subscribe({
            next: () => {
                this.loadSupplierContacts(supplierId);
                this.successMessage = 'Contact supprimé';
                this.isLoading = false;
                this.cdr.detectChanges();
                setTimeout(() => {
                    this.successMessage = '';
                    this.cdr.detectChanges();
                }, 3000);
            },
            error: (err) => {
                console.error('Error deleting contact', err);
                this.errorMessage = 'Impossible de supprimer le contact';
                this.isLoading = false;
                this.cdr.detectChanges();
            }
        });
    }

    openAddModal(): void {
        this.editingSupplierId = null;
        this.selectedProductIds = [];
        this.availableProducts = this.availableProducts.map(p => ({ ...p, selected: false }));
        this.resetForm();
        this.showModal = true;
    }

    openEditModal(supplier: Supplier): void {
        this.editingSupplierId = supplier.id;
        this.supplierForm = {
            name: supplier.name,
            notes: supplier.notes || '',
            phone: supplier.phone || '',
            email: supplier.email || '',
            photo: null
        };
        this.photoPreview = supplier.image_path ? `http://localhost:8000/storage/${supplier.image_path}` : null;
        this.selectedProductIds = supplier.products?.map((p: any) => p.id) || [];

        const selectedIds = this.selectedProductIds;
        this.availableProducts = this.availableProducts.map(p => ({
            ...p,
            selected: selectedIds.includes(p.id)
        }));

        this.showModal = true;
    }

    closeModal(): void {
        this.showModal = false;
        this.resetForm();
    }

    resetForm(): void {
        this.supplierForm = {
            name: '',
            notes: '',
            phone: '',
            email: '',
            photo: null
        };
        this.photoPreview = null;
        this.editingSupplierId = null;
    }

    onFileChange(event: any): void {
        const file = event.target.files[0];
        if (file) {
            this.supplierForm.photo = file;
            const reader = new FileReader();
            reader.onload = () => {
                this.photoPreview = reader.result as string;
            };
            reader.readAsDataURL(file);
        }
    }

    saveSupplier(): void {
        if (!this.supplierForm.name) {
            this.errorMessage = 'Le nom est obligatoire';
            return;
        }

        const formData = new FormData();
        formData.append('name', this.supplierForm.name);

        if (this.supplierForm.notes) {
            formData.append('notes', this.supplierForm.notes);
        }
        if (this.supplierForm.phone) {
            formData.append('phone', this.supplierForm.phone);
        }
        if (this.supplierForm.email) {
            formData.append('email', this.supplierForm.email);
        }

        if (this.selectedProductIds && this.selectedProductIds.length > 0) {
            this.selectedProductIds.forEach(productId => {
                formData.append('product_ids[]', productId.toString());
            });
        }

        if (this.supplierForm.photo) {
            formData.append('photo', this.supplierForm.photo);
        }

        this.isLoading = true;
        const request = this.editingSupplierId
            ? this.supplierService.updateSupplier(this.editingSupplierId, formData)
            : this.supplierService.createSupplier(formData);

        request.subscribe({
            next: () => {
                this.loadSuppliers();
                this.closeModal();
                this.successMessage = this.editingSupplierId ? 'Fournisseur mis à jour' : 'Fournisseur créé';
                this.isLoading = false;
                this.cdr.detectChanges();
                setTimeout(() => {
                    this.successMessage = '';
                    this.cdr.detectChanges();
                }, 3000);
            },
            error: (err) => {
                console.error('Error saving supplier - Full details:', err);
                if (err.error && typeof err.error === 'object') {
                    const errors = err.error;
                    this.errorMessage = Object.values(errors).flat().join(', ');
                } else {
                    this.errorMessage = 'Erreur lors de l\'enregistrement';
                }
                this.isLoading = false;
                this.cdr.detectChanges();
            }
        });
    }

    deleteSupplier(id: number): void {
        if (confirm('Êtes-vous sûr de vouloir supprimer ce fournisseur ?')) {
            this.supplierService.deleteSupplier(id).subscribe({
                next: () => {
                    this.loadSuppliers();
                    this.successMessage = 'Fournisseur supprimé';
                    setTimeout(() => this.successMessage = '', 3000);
                },
                error: (err) => {
                    console.error('Error deleting supplier', err);
                    this.errorMessage = 'Impossible de supprimer le fournisseur';
                }
            });
        }
    }

    submitReview(): void {
        if (!isPlatformBrowser(this.platformId)) {
            return;
        }
        const supplier = this.selectedSupplier as any;
        if (!supplier || !this.newReviewContent.trim()) return;

        this.isLoading = true;
        this.supplierService.addReview(supplier.id, {
            content: this.newReviewContent,
            rating: this.newReviewRating
        }).subscribe({
            next: (review) => {
                if (!supplier.reviews) supplier.reviews = [];
                supplier.reviews.unshift(review);
                this.newReviewContent = '';
                this.newReviewRating = 5;
                this.isLoading = false;
                this.successMessage = 'Avis publié !';
                this.cdr.detectChanges();
                setTimeout(() => this.successMessage = '', 3000);
            },
            error: (err) => {
                console.error('Error submitting review', err);
                this.errorMessage = 'Erreur lors de la publication de l\'avis';
                this.isLoading = false;
                this.cdr.detectChanges();
            }
        });
    }

    onProductToggle(product: any): void {
        if (product.selected) {
            if (!this.selectedProductIds.includes(product.id)) {
                this.selectedProductIds.push(product.id);
            }
        } else {
            this.selectedProductIds = this.selectedProductIds.filter(id => id !== product.id);
        }
    }
}
