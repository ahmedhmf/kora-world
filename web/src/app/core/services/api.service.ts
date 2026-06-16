import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Supplier, CreateSupplierDto } from '../models/supplier.model';
import { Product, CreateProductDto } from '../models/product.model';
import { Sample, CreateSampleDto } from '../models/sample.model';
import { PurchaseOrder, CreatePurchaseOrderDto } from '../models/purchase-order.model';
import { User, CreateUserDto } from '../models/user.model';
import { CalendarEvent, CreateEventDto } from '../models/event.model';
import { B2BAccount, CreateAccountDto } from '../models/account.model';
import { Receipt, CreateReceiptDto, UpdateReceiptDto } from '../models/receipt.model';
import { Contact, CreateContactDto, UpdateContactDto } from '../models/contact.model';
import { B2cRequest, CreateB2cRequestDto, UpdateB2cRequestDto } from '../models/b2c-request.model';

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

  // Events
  getEvents(): Observable<CalendarEvent[]> {
    return this.http.get<CalendarEvent[]>(`${this.base}/events`);
  }

  getEvent(id: number): Observable<CalendarEvent> {
    return this.http.get<CalendarEvent>(`${this.base}/events/${id}`);
  }

  createEvent(dto: CreateEventDto): Observable<CalendarEvent> {
    return this.http.post<CalendarEvent>(`${this.base}/events`, dto);
  }

  updateEvent(id: number, dto: Partial<CreateEventDto>): Observable<CalendarEvent> {
    return this.http.put<CalendarEvent>(`${this.base}/events/${id}`, dto);
  }

  deleteEvent(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/events/${id}`);
  }

  // Accounts
  getAccounts(): Observable<B2BAccount[]> {
    return this.http.get<B2BAccount[]>(`${this.base}/accounts`);
  }

  getAccount(id: number): Observable<B2BAccount> {
    return this.http.get<B2BAccount>(`${this.base}/accounts/${id}`);
  }

  createAccount(dto: CreateAccountDto): Observable<B2BAccount> {
    return this.http.post<B2BAccount>(`${this.base}/accounts`, dto);
  }

  updateAccount(id: number, dto: Partial<CreateAccountDto>): Observable<B2BAccount> {
    return this.http.put<B2BAccount>(`${this.base}/accounts/${id}`, dto);
  }

  deleteAccount(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/accounts/${id}`);
  }

  // Receipts
  getReceipts(): Observable<Receipt[]> {
    return this.http.get<Receipt[]>(`${this.base}/receipts`);
  }

  getReceipt(id: number): Observable<Receipt> {
    return this.http.get<Receipt>(`${this.base}/receipts/${id}`);
  }

  getAccountReceipts(accountId: number): Observable<Receipt[]> {
    return this.http.get<Receipt[]>(`${this.base}/receipts/account/${accountId}`);
  }

  createReceipt(dto: CreateReceiptDto): Observable<Receipt> {
    return this.http.post<Receipt>(`${this.base}/receipts`, dto);
  }

  updateReceipt(id: number, dto: UpdateReceiptDto): Observable<Receipt> {
    return this.http.patch<Receipt>(`${this.base}/receipts/${id}`, dto);
  }

  deleteReceipt(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/receipts/${id}`);
  }

  // Contacts
  getContacts(): Observable<Contact[]> {
    return this.http.get<Contact[]>(`${this.base}/contacts`);
  }

  getContact(id: number): Observable<Contact> {
    return this.http.get<Contact>(`${this.base}/contacts/${id}`);
  }

  createContact(dto: CreateContactDto): Observable<Contact> {
    return this.http.post<Contact>(`${this.base}/contacts`, dto);
  }

  updateContact(id: number, dto: UpdateContactDto): Observable<Contact> {
    return this.http.put<Contact>(`${this.base}/contacts/${id}`, dto);
  }

  deleteContact(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/contacts/${id}`);
  }

  // B2C Requests
  getB2cRequests(): Observable<B2cRequest[]> {
    return this.http.get<B2cRequest[]>(`${this.base}/b2c-requests`);
  }

  getB2cRequest(id: number): Observable<B2cRequest> {
    return this.http.get<B2cRequest>(`${this.base}/b2c-requests/${id}`);
  }

  createB2cRequest(dto: CreateB2cRequestDto): Observable<B2cRequest> {
    return this.http.post<B2cRequest>(`${this.base}/b2c-requests`, dto);
  }

  updateB2cRequest(id: number, dto: UpdateB2cRequestDto): Observable<B2cRequest> {
    return this.http.put<B2cRequest>(`${this.base}/b2c-requests/${id}`, dto);
  }

  deleteB2cRequest(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/b2c-requests/${id}`);
  }

  // DHL Tracking
  getDhlTracking(trackingNumber: string): Observable<any> {
    return this.http.get<any>(`${this.base}/dhl-tracking?trackingNumber=${trackingNumber}`);
  }
}
