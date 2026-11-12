import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AccountingAccount {
  id: number;
  code: string;
  name: string;
  type: string;
  currency: string;
  parentId?: number | null;
  isActive: boolean;
  parent?: AccountingAccount | null;
  children?: AccountingAccount[];
}

export interface JournalLine {
  id: number;
  accountId: number;
  debit: number;
  credit: number;
  currency: string;
  exchangeRate: number;
  amountBase: number;
  amountEgp?: number;
  account?: AccountingAccount;
}

export interface JournalEntry {
  id: number;
  date: string;
  description?: string;
  reference?: string;
  type: string;
  poId?: number | null;
  invoiceId?: number | null;
  attachment?: string | null;
  createdAt: string;
  postingStatus?: 'draft' | 'pending_approval' | 'posted' | 'reversed';
  createdById?: number | null;
  submittedById?: number | null;
  submittedAt?: string | null;
  approvedById?: number | null;
  postedAt?: string | null;
  reversedById?: number | null;
  reversedAt?: string | null;
  reversalOfId?: number | null;
  sourceEventKey?: string | null;
  lines: JournalLine[];
}

export interface InvoiceLine {
  id?: number;
  description: string;
  quantity: number;
  unitPrice: number;
  total?: number;
}

export interface Invoice {
  id: number;
  number: string;
  type: 'incoming' | 'outgoing';
  supplierId?: number | null;
  customerName?: string | null;
  date: string;
  dueDate: string;
  status: string;
  currency: string;
  subtotal: number;
  tax: number;
  total: number;
  poId?: number | null;
  lines: InvoiceLine[];
  supplier?: any;
}

export interface Payment {
  id: number;
  invoiceId?: number | null;
  date: string;
  amount: number;
  currency: string;
  exchangeRate: number;
  amountBase: number;
  amountEgp?: number;
  method: string;
  reference?: string;
  notes?: string;
  description: string;
  paidFromAccountId: number;
  categoryAccountId: number;
  poId?: number | null;
  attachment?: string | null;
  invoice?: Invoice | null;
}

/** Local EGP supplier pilot reporting. All monetary fields are integer cents. */
export interface SupplierPilotPaymentHistory {
  paymentId: number;
  reference: string | null;
  date: string;
  amountCents: number;
  status: 'active' | 'reversed';
  originalJournalId: number;
  reversal: {
    journalId: number;
    byUserId: number | null;
    at: string | null;
    reason: string | null;
  } | null;
}

export interface SupplierPilotInvoiceBalance {
  invoiceId: number;
  invoiceNumber: string;
  supplierId: number | null;
  currency: 'EGP';
  invoiceStatus: string;
  totalCents: number;
  paidCents: number;
  reversedCents: number;
  outstandingCents: number;
  payments: SupplierPilotPaymentHistory[];
}

@Injectable({ providedIn: 'root' })
export class AccountingApiService {
  private readonly http = inject(HttpClient);
  
  private get base(): string {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    return isLocal ? 'http://localhost:3000' : '/api';
  }

  // Chart of Accounts
  getAccounts(params?: { type?: string; codes?: string }): Observable<AccountingAccount[]> {
    let url = `${this.base}/accounting/accounts`;
    if (params) {
      const parts: string[] = [];
      if (params.type) parts.push(`type=${params.type}`);
      if (params.codes) parts.push(`codes=${params.codes}`);
      if (parts.length > 0) url += `?${parts.join('&')}`;
    }
    return this.http.get<AccountingAccount[]>(url);
  }

  getAccountTree(): Observable<AccountingAccount[]> {
    return this.http.get<AccountingAccount[]>(`${this.base}/accounting/accounts/tree`);
  }

  createAccount(dto: any): Observable<AccountingAccount> {
    return this.http.post<AccountingAccount>(`${this.base}/accounting/accounts`, dto);
  }

  updateAccount(id: number, dto: any): Observable<AccountingAccount> {
    return this.http.put<AccountingAccount>(`${this.base}/accounting/accounts/${id}`, dto);
  }

  // Journal Entries
  getJournalEntries(): Observable<JournalEntry[]> {
    return this.http.get<JournalEntry[]>(`${this.base}/accounting/journal-entries`);
  }

  createManualJournalEntry(dto: any): Observable<JournalEntry> {
    return this.http.post<JournalEntry>(`${this.base}/accounting/journal/manual`, dto);
  }

  getWorkflowJournalEntries(): Observable<JournalEntry[]> {
    return this.http.get<JournalEntry[]>(`${this.base}/accounting/manual-journals`);
  }

  createSimpleTransaction(dto: {
    kind: 'expense' | 'income' | 'transfer';
    date: string;
    description: string;
    amountCents: number;
    cashAccountId: number;
    categoryAccountId?: number;
    destinationAccountId?: number;
  }): Observable<{ journalId: number; status: 'posted' | 'pending_approval' }> {
    return this.http.post<{ journalId: number; status: 'posted' | 'pending_approval' }>(
      `${this.base}/accounting/simple/transactions`, dto,
    );
  }

  // New controlled manual journal workflow; amounts use integer EGP cents.
  createManualDraft(dto: {
    date: string;
    reference?: string;
    description: string;
    lines: Array<{ accountId: number; debitCents: number; creditCents: number }>;
  }): Observable<JournalEntry> {
    return this.http.post<JournalEntry>(`${this.base}/accounting/manual-journals/drafts`, dto);
  }

  submitManualDraft(id: number): Observable<JournalEntry> {
    return this.http.post<JournalEntry>(`${this.base}/accounting/manual-journals/${id}/submit`, {});
  }

  approveManualJournal(id: number): Observable<JournalEntry> {
    return this.http.post<JournalEntry>(`${this.base}/accounting/manual-journals/${id}/approve`, {});
  }

  reverseManualJournal(id: number, reason: string): Observable<JournalEntry> {
    return this.http.post<JournalEntry>(`${this.base}/accounting/manual-journals/${id}/reverse`, { reason });
  }

  getExchangeRate(from: string, to: string, date: string): Observable<number> {
    return this.http.get<number>(`${this.base}/accounting/exchange-rates/rate?from=${from}&to=${to}&date=${date}`);
  }

  // Invoices
  getNextInvoiceNumber(): Observable<{ number: string }> {
    return this.http.get<{ number: string }>(`${this.base}/invoices/next-number`);
  }

  getInvoices(): Observable<Invoice[]> {
    return this.http.get<Invoice[]>(`${this.base}/invoices`);
  }

  getInvoice(id: number): Observable<Invoice> {
    return this.http.get<Invoice>(`${this.base}/invoices/${id}`);
  }

  createInvoice(dto: any): Observable<Invoice> {
    return this.http.post<Invoice>(`${this.base}/invoices`, dto);
  }

  updateInvoice(id: number, dto: any): Observable<Invoice> {
    return this.http.put<Invoice>(`${this.base}/invoices/${id}`, dto);
  }

  deleteInvoice(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/invoices/${id}`);
  }

  // Payments
  getPayments(): Observable<Payment[]> {
    return this.http.get<Payment[]>(`${this.base}/payments`);
  }

  createPayment(dto: any): Observable<Payment> {
    return this.http.post<Payment>(`${this.base}/payments`, dto);
  }

  deletePayment(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/payments/${id}`);
  }

  /** Read-only and test-only: API rejects requests unless on local kora_test. */
  getSupplierPilotInvoiceBalance(id: number): Observable<SupplierPilotInvoiceBalance> {
    return this.http.get<SupplierPilotInvoiceBalance>(
      `${this.base}/payments/supplier-egp-pilot/invoices/${id}/balance`,
    );
  }

  /** Pilot writes remain server-restricted to local kora_test. */
  createSupplierPilotPayment(dto: {
    invoiceId: number;
    bankAccountId: number;
    amountCents: number;
    date: string;
    requestKey: string;
    description?: string;
  }): Observable<{
    paymentId: number; journalId: number; status: string;
    remainingCents: number; replayed: boolean;
  }> {
    return this.http.post<{
      paymentId: number; journalId: number; status: string;
      remainingCents: number; replayed: boolean;
    }>(`${this.base}/payments/supplier-egp-pilot`, dto);
  }

  reverseSupplierPilotPayment(paymentId: number, reason: string): Observable<{
    paymentId: number; originalJournalId: number; reversalJournalId: number;
    status: string; remainingCents: number;
  }> {
    return this.http.post<{
      paymentId: number; originalJournalId: number; reversalJournalId: number;
      status: string; remainingCents: number;
    }>(`${this.base}/payments/supplier-egp-pilot/${paymentId}/reverse`, { reason });
  }

  // Reports
  getProfitAndLoss(startDate: string, endDate: string, currency?: string): Observable<any> {
    let url = `${this.base}/accounting/reports/profit-loss?startDate=${startDate}&endDate=${endDate}`;
    if (currency) url += `&currency=${currency}`;
    return this.http.get<any>(url);
  }

  getBalanceSheet(asOfDate: string): Observable<any> {
    return this.http.get<any>(`${this.base}/accounting/reports/balance-sheet?asOfDate=${asOfDate}`);
  }

  getCashFlow(startDate: string, endDate: string): Observable<any> {
    return this.http.get<any>(`${this.base}/accounting/reports/cash-flow?startDate=${startDate}&endDate=${endDate}`);
  }
}
