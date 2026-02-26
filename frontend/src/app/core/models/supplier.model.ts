export interface Supplier {
    id: number;
    name: string;
    notes?: string;
    image_path?: string;
    phone?: string;
    email?: string;
    contacts?: import('./supplier-contact.model').SupplierContact[];
    products_count?: number;
    products?: any[];
    reviews?: {
        id: number;
        user_id: number;
        content: string;
        rating?: number;
        created_at: string;
        user?: { id: number, name: string };
    }[];
    supply_history?: {
        product_id: number;
        total_quantity: number;
        product?: { id: number, title: string, reference: string };
    }[];
    created_at?: string;
    updated_at?: string;
}
