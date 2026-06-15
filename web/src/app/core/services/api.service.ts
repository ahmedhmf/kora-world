import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Supplier, CreateSupplierDto } from '../models/supplier.model';
import { Product, CreateProductDto } from '../models/product.model';
import { Sample, CreateSampleDto } from '../models/sample.model';
import { PurchaseOrder, CreatePurchaseOrderDto } from '../models/purchase-order.model';
import { User, CreateUserDto } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private get base(): string {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    return isLocal ? 'http://localhost:3000' : '/api';
  }

  // Suppliers
  getSuppliers(): Observable<Supplier[]> {
    return this.http.get<Supplier[]>(`${this.base}/suppliers`);
  }

  getSupplier(id: number): Observable<Supplier> {
    return this.http.get<Supplier>(`${this.base}/suppliers/${id}`);
  }

  createSupplier(dto: CreateSupplierDto): Observable<Supplier> {
    return this.http.post<Supplier>(`${this.base}/suppliers`, dto);
  }

  updateSupplier(id: number, dto: Partial<CreateSupplierDto>): Observable<Supplier> {
    return this.http.put<Supplier>(`${this.base}/suppliers/${id}`, dto);
  }

  deleteSupplier(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/suppliers/${id}`);
  }

  // Products
  getProducts(supplierId?: number, category?: string): Observable<Product[]> {
    let url = `${this.base}/products`;
    const params: string[] = [];
    if (supplierId) params.push(`supplierId=${supplierId}`);
    if (category) params.push(`category=${category}`);
    if (params.length) url += `?${params.join('&')}`;
    return this.http.get<Product[]>(url);
  }

  getProduct(id: number): Observable<Product> {
    return this.http.get<Product>(`${this.base}/products/${id}`);
  }

  createProduct(dto: CreateProductDto): Observable<Product> {
    return this.http.post<Product>(`${this.base}/products`, dto);
  }

  updateProduct(id: number, dto: Partial<CreateProductDto>): Observable<Product> {
    return this.http.put<Product>(`${this.base}/products/${id}`, dto);
  }

  deleteProduct(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/products/${id}`);
  }

  // Samples
  getSamples(): Observable<Sample[]> {
    return this.http.get<Sample[]>(`${this.base}/samples`);
  }

  getSample(id: number): Observable<Sample> {
    return this.http.get<Sample>(`${this.base}/samples/${id}`);
  }

  createSample(dto: CreateSampleDto): Observable<Sample> {
    return this.http.post<Sample>(`${this.base}/samples`, dto);
  }

  updateSample(id: number, dto: Partial<CreateSampleDto>): Observable<Sample> {
    return this.http.put<Sample>(`${this.base}/samples/${id}`, dto);
  }

  deleteSample(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/samples/${id}`);
  }

  getSampleRounds(id: number): Observable<Sample[]> {
    return this.http.get<Sample[]>(`${this.base}/samples/${id}/rounds`);
  }

  // Purchase Orders
  getPurchaseOrders(): Observable<PurchaseOrder[]> {
    return this.http.get<PurchaseOrder[]>(`${this.base}/purchase-orders`);
  }

  getPurchaseOrder(id: number): Observable<PurchaseOrder> {
    return this.http.get<PurchaseOrder>(`${this.base}/purchase-orders/${id}`);
  }

  createPurchaseOrder(dto: CreatePurchaseOrderDto): Observable<PurchaseOrder> {
    return this.http.post<PurchaseOrder>(`${this.base}/purchase-orders`, dto);
  }

  updatePurchaseOrder(id: number, dto: Partial<CreatePurchaseOrderDto>): Observable<PurchaseOrder> {
    return this.http.put<PurchaseOrder>(`${this.base}/purchase-orders/${id}`, dto);
  }

  deletePurchaseOrder(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/purchase-orders/${id}`);
  }

  // Users
  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.base}/users`);
  }

  getUser(id: number): Observable<User> {
    return this.http.get<User>(`${this.base}/users/${id}`);
  }

  createUser(dto: CreateUserDto): Observable<User> {
    return this.http.post<User>(`${this.base}/users`, dto);
  }

  updateUser(id: number, dto: Partial<CreateUserDto>): Observable<User> {
    return this.http.put<User>(`${this.base}/users/${id}`, dto);
  }

  deleteUser(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/users/${id}`);
  }

  // Attachments
  uploadFile(file: File): Observable<{ path: string; name: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ path: string; name: string }>(`${this.base}/attachments/upload`, formData);
  }

  downloadFile(path: string): Observable<Blob> {
    return this.http.get(`${this.base}/attachments/download/${path}`, {
      responseType: 'blob',
    });
  }

  getPublicImageUrl(path: string): string {
    return `${this.base}/attachments/public/${path}`;
  }

  getProductNextCounter(collection: string, year: number, category: string): Observable<{ counter: number }> {
    return this.http.get<{ counter: number }>(`${this.base}/products/next-counter?collection=${collection}&year=${year}&category=${category}`);
  }

  getSampleNextCounter(collection: string, year: number, category: string): Observable<{ counter: number }> {
    return this.http.get<{ counter: number }>(`${this.base}/samples/next-counter?collection=${collection}&year=${year}&category=${category}`);
  }
}
