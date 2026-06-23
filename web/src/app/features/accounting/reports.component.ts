import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AccountingStore } from '../../store/accounting.store';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reports.component.html',
})
export class ReportsComponent implements OnInit {
  readonly store = inject(AccountingStore);

  activeTab = signal<string>('pl');
  startDate = '2026-01-01';
  endDate = '2026-12-31';
  currency = 'EGP';
  asOfDate = '2026-12-31';

  readonly tabs = [
    { id: 'pl', label: 'Profit & Loss' },
    { id: 'bs', label: 'Balance Sheet' },
    { id: 'cf', label: 'Cash Flow' },
  ];

  ngOnInit() {
    // defaults
    const year = new Date().getFullYear();
    this.startDate = `${year}-01-01`;
    this.endDate = `${year}-12-31`;
    this.asOfDate = `${year}-12-31`;
    // Auto-load the active report so data is visible immediately
    this.runReport();
  }

  runReport() {
    const tab = this.activeTab();
    if (tab === 'pl') {
      this.store.loadProfitAndLoss({
        startDate: this.startDate,
        endDate: this.endDate,
        currency: this.currency
      });
    } else if (tab === 'bs') {
      this.store.loadBalanceSheet({
        asOfDate: this.asOfDate
      });
    } else if (tab === 'cf') {
      this.store.loadCashFlow({
        startDate: this.startDate,
        endDate: this.endDate
      });
    }
  }
}
