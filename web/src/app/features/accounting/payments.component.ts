import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AccountingStore } from '../../store/accounting.store';
import { PurchaseOrdersStore } from '../../store/purchase-orders.store';
import { ApiService } from '../../core/services/api.service';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-payments',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './payments.component.html',
})
export class PaymentsComponent implements OnInit {
  readonly store = inject(AccountingStore);
  readonly poStore = inject(PurchaseOrdersStore);
  readonly apiService = inject(ApiService);

  isCreateModalOpen = signal(false);
  isUploading = signal(false);
  attachmentName = signal('');

  // Derived from the store's full accounts list — filtered client-side
  get paidFromAccounts() {
    return this.store.accounts().filter(a => {
      const code = a.code ?? '';
      return code.startsWith('11') || code.startsWith('31');
    });
  }

  get categoryAccounts() {
    return this.store.accounts().filter(a =>
      a.type === 'expense' || (a.code ?? '').startsWith('5')
    );
  }

  newPayment = this.emptyPayment();

  amountEgpDisplay() {
    const rate = this.newPayment.exchangeRate || 1;
    const amount = Number(this.newPayment.amount) || 0;
    return Number((amount * rate).toFixed(2));
  }

  validationMsg(): string | null {
    if (!this.newPayment.description?.trim()) return 'Description is required.';
    if (!this.newPayment.date) return 'Date is required.';
    if (!this.newPayment.paidFromAccountId || this.newPayment.paidFromAccountId === 0) return 'Please select a Paid From account.';
    if (!this.newPayment.amount || Number(this.newPayment.amount) <= 0) return 'Amount must be greater than 0.';
    if (!this.newPayment.categoryAccountId || this.newPayment.categoryAccountId === 0) return 'Please select a Category.';
    return null;
  }

  private emptyPayment() {
    return {
      description: '',
      date: new Date().toISOString().split('T')[0],
      paidFromAccountId: 0,
      amount: 0,
      currency: 'EGP',
      exchangeRate: 1 as number | undefined,
      categoryAccountId: 0,
      reference: '',
      poId: null as number | null,
      attachment: null as string | null,
      notes: '',
      method: 'bank_transfer',
      invoiceId: undefined as number | undefined,
    };
  }

  ngOnInit() {
    this.store.loadPayments();
    this.store.loadInvoices();
    this.store.loadAccounts();
    this.poStore.loadPurchaseOrders();
  }

  openCreateModal() {
    this.newPayment = this.emptyPayment();
    this.attachmentName.set('');
    this.isCreateModalOpen.set(true);
  }

  calcAmountEgp() {
    // triggers re-render via normal change detection
  }

  onFileSelected(event: any) {
    const file = event.target.files?.[0];
    if (!file) return;
    this.isUploading.set(true);
    this.apiService.uploadFile(file).subscribe({
      next: (res) => {
        this.newPayment.attachment = res.path;
        this.attachmentName.set(res.name);
        this.isUploading.set(false);
      },
      error: () => {
        alert('File upload failed.');
        this.isUploading.set(false);
      },
    });
  }

  clearAttachment() {
    this.newPayment.attachment = null;
    this.attachmentName.set('');
  }

  submitPayment() {
    const err = this.validationMsg();
    if (err) return;

    const dto = {
      description: this.newPayment.description.trim(),
      date: this.newPayment.date,
      paidFromAccountId: Number(this.newPayment.paidFromAccountId),
      categoryAccountId: Number(this.newPayment.categoryAccountId),
      amount: Number(this.newPayment.amount),
      currency: this.newPayment.currency,
      exchangeRate: this.newPayment.exchangeRate ? Number(this.newPayment.exchangeRate) : undefined,
      reference: this.newPayment.reference || undefined,
      poId: this.newPayment.poId || undefined,
      attachment: this.newPayment.attachment || undefined,
      notes: this.newPayment.notes || undefined,
      method: this.newPayment.method,
      invoiceId: this.newPayment.invoiceId || undefined,
    };

    this.store.createPayment({
      dto,
      onSuccess: () => {
        this.isCreateModalOpen.set(false);
      },
    });
  }

  deletePayment(id: number) {
    if (confirm('Delete this payment? This will also remove the associated journal entry.')) {
      this.store.deletePayment(id);
    }
  }
}
