import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ApiService } from './api.service';

describe('ApiService', () => {
  let service: ApiService;
  let httpTesting: HttpTestingController;

  // Base URL when running tests (jsdom, hostname is 'localhost')
  const base = 'http://localhost:3000';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('should be created', () => expect(service).toBeTruthy());

  // ─── Suppliers ────────────────────────────────────────────────────────────

  it('getSuppliers() → GET /suppliers', () => {
    service.getSuppliers().subscribe();
    httpTesting.expectOne(`${base}/suppliers`).flush([]);
  });

  it('getSupplier(1) → GET /suppliers/1', () => {
    service.getSupplier(1).subscribe();
    httpTesting.expectOne(`${base}/suppliers/1`).flush({});
  });

  it('createSupplier() → POST /suppliers', () => {
    service.createSupplier({ name: 'Acme', country: 'DE' } as never).subscribe();
    const req = httpTesting.expectOne(`${base}/suppliers`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('updateSupplier(1, …) → PUT /suppliers/1', () => {
    service.updateSupplier(1, { name: 'Updated' }).subscribe();
    const req = httpTesting.expectOne(`${base}/suppliers/1`);
    expect(req.request.method).toBe('PUT');
    req.flush({});
  });

  it('deleteSupplier(1) → DELETE /suppliers/1', () => {
    service.deleteSupplier(1).subscribe();
    const req = httpTesting.expectOne(`${base}/suppliers/1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  // ─── Products ─────────────────────────────────────────────────────────────

  it('getProducts() → GET /products (no params)', () => {
    service.getProducts().subscribe();
    httpTesting.expectOne(`${base}/products`).flush([]);
  });

  it('getProducts(supplierId) → GET /products?supplierId=…', () => {
    service.getProducts(5).subscribe();
    httpTesting.expectOne(`${base}/products?supplierId=5`).flush([]);
  });

  it('getProducts(supplierId, category) → GET /products?supplierId=…&category=…', () => {
    service.getProducts(5, 'football').subscribe();
    httpTesting.expectOne(`${base}/products?supplierId=5&category=football`).flush([]);
  });

  it('createProduct() → POST /products', () => {
    service.createProduct({ name: 'Ball', category: 'football' } as never).subscribe();
    const req = httpTesting.expectOne(`${base}/products`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('updateProduct(2, …) → PUT /products/2', () => {
    service.updateProduct(2, { name: 'New Ball' }).subscribe();
    const req = httpTesting.expectOne(`${base}/products/2`);
    expect(req.request.method).toBe('PUT');
    req.flush({});
  });

  it('deleteProduct(2) → DELETE /products/2', () => {
    service.deleteProduct(2).subscribe();
    httpTesting.expectOne(`${base}/products/2`).flush(null);
  });

  // ─── Samples ──────────────────────────────────────────────────────────────

  it('getSamples() → GET /samples', () => {
    service.getSamples().subscribe();
    httpTesting.expectOne(`${base}/samples`).flush([]);
  });

  it('createSample() → POST /samples', () => {
    service.createSample({ name: 'S1' } as never).subscribe();
    const req = httpTesting.expectOne(`${base}/samples`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('updateSample(3, …) → PUT /samples/3', () => {
    service.updateSample(3, { name: 'Updated S1' }).subscribe();
    const req = httpTesting.expectOne(`${base}/samples/3`);
    expect(req.request.method).toBe('PUT');
    req.flush({});
  });

  it('deleteSample(3) → DELETE /samples/3', () => {
    service.deleteSample(3).subscribe();
    httpTesting.expectOne(`${base}/samples/3`).flush(null);
  });

  it('getSampleRounds(4) → GET /samples/4/rounds', () => {
    service.getSampleRounds(4).subscribe();
    httpTesting.expectOne(`${base}/samples/4/rounds`).flush([]);
  });

  // ─── Purchase Orders ──────────────────────────────────────────────────────

  it('getPurchaseOrders() → GET /purchase-orders', () => {
    service.getPurchaseOrders().subscribe();
    httpTesting.expectOne(`${base}/purchase-orders`).flush([]);
  });

  it('getPurchaseOrder(5) → GET /purchase-orders/5', () => {
    service.getPurchaseOrder(5).subscribe();
    httpTesting.expectOne(`${base}/purchase-orders/5`).flush({});
  });

  it('createPurchaseOrder() → POST /purchase-orders', () => {
    service.createPurchaseOrder({ supplierId: 1 } as never).subscribe();
    const req = httpTesting.expectOne(`${base}/purchase-orders`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('updatePurchaseOrder(5, …) → PUT /purchase-orders/5', () => {
    service.updatePurchaseOrder(5, { status: 'sent' }).subscribe();
    const req = httpTesting.expectOne(`${base}/purchase-orders/5`);
    expect(req.request.method).toBe('PUT');
    req.flush({});
  });

  it('deletePurchaseOrder(5) → DELETE /purchase-orders/5', () => {
    service.deletePurchaseOrder(5).subscribe();
    httpTesting.expectOne(`${base}/purchase-orders/5`).flush(null);
  });

  // ─── Users ────────────────────────────────────────────────────────────────

  it('getUsers() → GET /users', () => {
    service.getUsers().subscribe();
    httpTesting.expectOne(`${base}/users`).flush([]);
  });

  it('createUser() → POST /users', () => {
    service.createUser({ email: 'u@t.com', password: 'pass', role: 'employee', name: 'U' }).subscribe();
    const req = httpTesting.expectOne(`${base}/users`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('updateUser(6, …) → PUT /users/6', () => {
    service.updateUser(6, { name: 'New' }).subscribe();
    httpTesting.expectOne(`${base}/users/6`).flush({});
  });

  it('deleteUser(6) → DELETE /users/6', () => {
    service.deleteUser(6).subscribe();
    httpTesting.expectOne(`${base}/users/6`).flush(null);
  });

  // ─── Attachments ──────────────────────────────────────────────────────────

  it('uploadFile() → POST /attachments/upload', () => {
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    service.uploadFile(file).subscribe();
    const req = httpTesting.expectOne(`${base}/attachments/upload`);
    expect(req.request.method).toBe('POST');
    req.flush({ path: 'test.pdf', name: 'test.pdf' });
  });

  it('downloadFile(path) → GET /attachments/download/test.pdf (blob)', () => {
    service.downloadFile('test.pdf').subscribe();
    const req = httpTesting.expectOne(`${base}/attachments/download/test.pdf`);
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob());
  });

  it('getPublicImageUrl(path) → returns correct URL string', () => {
    expect(service.getPublicImageUrl('logo.png')).toBe(`${base}/attachments/public/logo.png`);
  });

  // ─── Counter helpers ──────────────────────────────────────────────────────

  it('getProductNextCounter() → GET /products/next-counter?…', () => {
    service.getProductNextCounter('SS', 2026, 'football').subscribe();
    httpTesting.expectOne(`${base}/products/next-counter?collection=SS&year=2026&category=football`).flush({ counter: 5 });
  });

  it('getSampleNextCounter() → GET /samples/next-counter?…', () => {
    service.getSampleNextCounter('FW', 2025, 'running').subscribe();
    httpTesting.expectOne(`${base}/samples/next-counter?collection=FW&year=2025&category=running`).flush({ counter: 3 });
  });

  // ─── Events ───────────────────────────────────────────────────────────────

  it('getEvents() → GET /events', () => {
    service.getEvents().subscribe();
    httpTesting.expectOne(`${base}/events`).flush([]);
  });

  it('createEvent() → POST /events', () => {
    service.createEvent({ title: 'Fair', category: 'trade_show', startDate: '2026-01-01', endDate: '2026-01-02' } as never).subscribe();
    const req = httpTesting.expectOne(`${base}/events`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('updateEvent(7, …) → PUT /events/7', () => {
    service.updateEvent(7, { title: 'Updated' }).subscribe();
    httpTesting.expectOne(`${base}/events/7`).flush({});
  });

  it('deleteEvent(7) → DELETE /events/7', () => {
    service.deleteEvent(7).subscribe();
    httpTesting.expectOne(`${base}/events/7`).flush(null);
  });

  // ─── Accounts ─────────────────────────────────────────────────────────────

  it('getAccounts() → GET /accounts', () => {
    service.getAccounts().subscribe();
    httpTesting.expectOne(`${base}/accounts`).flush([]);
  });

  it('createAccount() → POST /accounts', () => {
    service.createAccount({ companyName: 'Corp' } as never).subscribe();
    const req = httpTesting.expectOne(`${base}/accounts`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('updateAccount(8, …) → PUT /accounts/8', () => {
    service.updateAccount(8, { companyName: 'Corp 2' }).subscribe();
    httpTesting.expectOne(`${base}/accounts/8`).flush({});
  });

  it('deleteAccount(8) → DELETE /accounts/8', () => {
    service.deleteAccount(8).subscribe();
    httpTesting.expectOne(`${base}/accounts/8`).flush(null);
  });

  // ─── Receipts ─────────────────────────────────────────────────────────────

  it('getReceipts() → GET /receipts', () => {
    service.getReceipts().subscribe();
    httpTesting.expectOne(`${base}/receipts`).flush([]);
  });

  it('getAccountReceipts(9) → GET /receipts/account/9', () => {
    service.getAccountReceipts(9).subscribe();
    httpTesting.expectOne(`${base}/receipts/account/9`).flush([]);
  });

  it('createReceipt() → POST /receipts', () => {
    service.createReceipt({ accountId: 1 } as never).subscribe();
    const req = httpTesting.expectOne(`${base}/receipts`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('updateReceipt(10, …) → PATCH /receipts/10', () => {
    service.updateReceipt(10, { status: 'paid' } as never).subscribe();
    const req = httpTesting.expectOne(`${base}/receipts/10`);
    expect(req.request.method).toBe('PATCH');
    req.flush({});
  });

  it('deleteReceipt(10) → DELETE /receipts/10', () => {
    service.deleteReceipt(10).subscribe();
    httpTesting.expectOne(`${base}/receipts/10`).flush(null);
  });

  // ─── Contacts ─────────────────────────────────────────────────────────────

  it('getContacts() → GET /contacts', () => {
    service.getContacts().subscribe();
    httpTesting.expectOne(`${base}/contacts`).flush([]);
  });

  it('createContact() → POST /contacts', () => {
    service.createContact({ name: 'Alice', type: 'supplier' } as never).subscribe();
    const req = httpTesting.expectOne(`${base}/contacts`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('updateContact(11, …) → PUT /contacts/11', () => {
    service.updateContact(11, { name: 'Alice Updated' } as never).subscribe();
    httpTesting.expectOne(`${base}/contacts/11`).flush({});
  });

  it('deleteContact(11) → DELETE /contacts/11', () => {
    service.deleteContact(11).subscribe();
    httpTesting.expectOne(`${base}/contacts/11`).flush(null);
  });

  // ─── B2C Requests ─────────────────────────────────────────────────────────

  it('getB2cRequests() → GET /b2c-requests', () => {
    service.getB2cRequests().subscribe();
    httpTesting.expectOne(`${base}/b2c-requests`).flush([]);
  });

  it('createB2cRequest() → POST /b2c-requests', () => {
    service.createB2cRequest({ notes: 'req' } as never).subscribe();
    const req = httpTesting.expectOne(`${base}/b2c-requests`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('updateB2cRequest(12, …) → PUT /b2c-requests/12', () => {
    service.updateB2cRequest(12, { notes: 'updated' } as never).subscribe();
    httpTesting.expectOne(`${base}/b2c-requests/12`).flush({});
  });

  it('deleteB2cRequest(12) → DELETE /b2c-requests/12', () => {
    service.deleteB2cRequest(12).subscribe();
    httpTesting.expectOne(`${base}/b2c-requests/12`).flush(null);
  });

  // ─── DHL Tracking ─────────────────────────────────────────────────────────

  it('getDhlTracking(trackingNumber) → GET /dhl-tracking?trackingNumber=…', () => {
    service.getDhlTracking('TRACK123').subscribe();
    httpTesting.expectOne(`${base}/dhl-tracking?trackingNumber=TRACK123`).flush({});
  });
});
