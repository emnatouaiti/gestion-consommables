import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Supplier } from '../models/supplier.model';
import { SupplierContact } from '../models/supplier-contact.model';

@Injectable({
    providedIn: 'root'
})
export class SupplierService {
    private readonly apiUrl = '/api/admin/suppliers';
    private readonly productsUrl = '/api/admin/products';

    constructor(private http: HttpClient) { }

    getSuppliers(): Observable<Supplier[]> {
        return this.http.get<Supplier[]>(this.apiUrl);
    }

    getSupplier(id: number): Observable<Supplier> {
        return this.http.get<Supplier>(`${this.apiUrl}/${id}`);
    }

    createSupplier(formData: FormData): Observable<Supplier> {
        return this.http.post<Supplier>(this.apiUrl, formData);
    }

    updateSupplier(id: number, formData: FormData): Observable<Supplier> {
        // Laravel bug with PUT and FormData: use POST + _method append if necessary,
        // but usually PUT works if not using files. If using files, use POST + _method='PUT'
        formData.append('_method', 'PUT');
        return this.http.post<Supplier>(`${this.apiUrl}/${id}`, formData);
    }

    deleteSupplier(id: number): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/${id}`);
    }

    getSupplierContacts(supplierId: number): Observable<SupplierContact[]> {
        return this.http.get<SupplierContact[]>(`${this.apiUrl}/${supplierId}/contacts`);
    }

    createSupplierContact(supplierId: number, payload: Omit<SupplierContact, 'id'>): Observable<SupplierContact> {
        return this.http.post<SupplierContact>(`${this.apiUrl}/${supplierId}/contacts`, payload);
    }

    updateSupplierContact(
        supplierId: number,
        contactId: number,
        payload: Partial<Omit<SupplierContact, 'id'>>
    ): Observable<SupplierContact> {
        return this.http.put<SupplierContact>(`${this.apiUrl}/${supplierId}/contacts/${contactId}`, payload);
    }

    deleteSupplierContact(supplierId: number, contactId: number): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/${supplierId}/contacts/${contactId}`);
    }

    addReview(supplierId: number, review: { content: string, rating?: number }): Observable<any> {
        return this.http.post<any>(`${this.apiUrl}/${supplierId}/reviews`, review);
    }

    getProductsList(perPage: number = 100): Observable<any> {
        return this.http.get<any>(`${this.productsUrl}?per_page=${perPage}`);
    }
}
