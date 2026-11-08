import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Account } from '../accounts/entities/account.entity';
import { CustomerStatement } from './customer-statement.entity';
import { SalesSettlement } from './sales-settlement.entity';
import { CustomerPayment } from './customer-payment.entity';
import { PaymentAllocation } from './payment-allocation.entity';
import { WeeklySalesReport } from './weekly-sales-report.entity';

const validDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v || '') && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
const money = (n: number) => (n / 100).toFixed(2);
type Entry = { id: string; date: string; type: string; reference: string; amountCents: number; settlementId: number | null; paymentId: number | null };

@Injectable()
export class CustomerStatementsService {
  constructor(private readonly db: DataSource) {}

  private async account(accountId: number) {
    const account = await this.db.getRepository(Account).findOneBy({ id: accountId });
    if (!account) throw new NotFoundException('Account not found');
    return account;
  }

  private checkDates(from: string, to: string) {
    if (!validDate(from) || !validDate(to) || from > to) throw new BadRequestException('Invalid statement date range');
  }

  // Due day is interpreted as a day of the month following the sales reporting period.
  private dueDate(weekEnd: string, dueDay: number | null | undefined): string | null {
    if (!Number.isInteger(dueDay) || !dueDay || dueDay < 1 || dueDay > 31) return null;
    const [year, month] = weekEnd.split('-').map(Number);
    const nextYear = month === 12 ? year + 1 : year;
    const nextMonth = month === 12 ? 1 : month + 1;
    const days = new Date(Date.UTC(nextYear, nextMonth, 0)).getUTCDate();
    return `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(Math.min(dueDay, days)).padStart(2, '0')}`;
  }

  async preview(accountId: number, from: string, to: string, currency?: string) {
    this.checkDates(from, to);
    const account = await this.account(accountId);
    const settlements = await this.db.getRepository(SalesSettlement).find({ where: { accountId } });
    const payments = await this.db.getRepository(CustomerPayment).find({ where: { accountId } });
    const ids = settlements.map(s => s.id);
    const allocations = ids.length ? await this.db.getRepository(PaymentAllocation)
      .createQueryBuilder('a').where('a.settlement_id IN (:...ids)', { ids }).getMany() : [];
    const reportIds = settlements.map(s => s.reportId);
    const reports = reportIds.length ? await this.db.getRepository(WeeklySalesReport)
      .createQueryBuilder('r').where('r.id IN (:...ids)', { ids: reportIds }).getMany() : [];
    const reportById = new Map(reports.map(r => [r.id, r]));
    const paymentById = new Map(payments.map(p => [p.id, p]));
    const currencies = [...new Set([...settlements.map(s => s.currency), ...payments.map(p => p.currency)])].sort();
    const selectedCurrency = currency || (currencies.length === 1 ? currencies[0] : account.defaultCurrency);
    if (!/^[A-Z]{3}$/.test(selectedCurrency)) throw new BadRequestException('Invalid currency');
    const entries: Entry[] = [];
    const today = new Date().toISOString().slice(0, 10);
    const aging: Array<{ settlementId: number; reference: string; dueDate: string | null; outstanding: string; daysOverdue: number }> = [];
    for (const s of settlements.filter(s => s.currency === selectedCurrency)) {
      const report = reportById.get(s.reportId);
      const date = (s.createdAt instanceof Date ? s.createdAt.toISOString() : String(s.createdAt)).slice(0, 10);
      entries.push({ id: 'settlement-' + s.id, date, type: 'settlement', reference: 'Sales report #' + s.reportId, amountCents: Number(s.totalCents), settlementId: s.id, paymentId: null });
      if (s.reversedAt) entries.push({ id: 'reversal-' + s.id, date: new Date(s.reversedAt).toISOString().slice(0, 10),
        type: 'reversal', reference: 'Reversal of sales report #' + s.reportId, amountCents: -Number(s.totalCents), settlementId: s.id, paymentId: null });
      const allocated = allocations.filter(a => a.settlementId === s.id).reduce((n, a) => n + Number(a.amountCents), 0);
      const outstanding = s.status === 'active' ? Number(s.totalCents) - allocated : 0;
      const due = report ? this.dueDate(report.weekEnd, account.settlementDueDay) : null;
      if (outstanding > 0 && date <= to) {
        const days = due && due < today ? Math.floor((Date.parse(today) - Date.parse(due)) / 86400000) : 0;
        aging.push({ settlementId: s.id, reference: 'Sales report #' + s.reportId, dueDate: due,
          outstanding: money(outstanding), daysOverdue: days });
      }
    }
    for (const a of allocations) {
      const payment = paymentById.get(a.paymentId);
      const settlement = settlements.find(s => s.id === a.settlementId);
      if (!payment || !settlement || payment.currency !== selectedCurrency || settlement.currency !== selectedCurrency) continue;
      // Allocation creation date is used: only allocated payments reduce the receivable.
      const date = (a.createdAt instanceof Date ? a.createdAt.toISOString() : String(a.createdAt)).slice(0, 10);
      entries.push({ id: 'allocation-' + a.id, date, type: 'payment_allocation',
        reference: payment.reference + ' → Sales report #' + settlement.reportId,
        amountCents: -Number(a.amountCents), settlementId: settlement.id, paymentId: payment.id });
    }
    entries.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    let running = 0;
    const transactions = entries.map(e => {
      running += e.amountCents;
      return { ...e, amount: money(e.amountCents), runningBalance: money(running) };
    });
    const openingCents = entries.filter(e => e.date < from).reduce((n, e) => n + e.amountCents, 0);
    const period = transactions.filter(e => e.date >= from && e.date <= to);
    const closingCents = openingCents + period.reduce((n, e) => n + e.amountCents, 0);
    const debitCents = period.filter(e => e.amountCents > 0).reduce((n, e) => n + e.amountCents, 0);
    const creditCents = -period.filter(e => e.amountCents < 0).reduce((n, e) => n + e.amountCents, 0);
    return {
      accountId, customer: { companyName: account.companyName, accountNumber: account.accountNumber,
        billingStreet: account.billingStreet, billingCity: account.billingCity, billingZip: account.billingZip,
        billingCountry: account.billingCountry },
      currency: selectedCurrency, availableCurrencies: currencies, periodFrom: from, periodTo: to,
      openingBalance: money(openingCents), charges: money(debitCents), credits: money(creditCents),
      closingBalance: money(closingCents), transactions: period,
      overdue: aging.filter(a => a.daysOverdue > 0 && a.dueDate && a.dueDate <= to),
      aging: aging.filter(a => a.dueDate && a.dueDate <= to),
      dueDatePolicy: 'Settlement due day is interpreted as the day of the month after the sales week ends; dates past month-end are clamped. No due date is shown when the agreement has no valid due day.',
      paymentPolicy: 'Only allocated payments reduce the statement balance. Allocations are dated when recorded, not by the original payment date.',
    };
  }

  async history(accountId: number) {
    await this.account(accountId);
    return this.db.getRepository(CustomerStatement).find({ where: { accountId }, order: { id: 'DESC' } });
  }

  async getSaved(accountId: number, id: number) {
    const row = await this.db.getRepository(CustomerStatement).findOneBy({ id, accountId });
    if (!row) throw new NotFoundException('Statement not found');
    return row;
  }

  async save(accountId: number, dto: { from: string; to: string; currency?: string }, userId: number) {
    const snapshot = await this.preview(accountId, dto.from, dto.to, dto.currency);
    return this.db.getRepository(CustomerStatement).save(this.db.getRepository(CustomerStatement).create({
      accountId, currency: snapshot.currency, periodFrom: dto.from, periodTo: dto.to,
      snapshot: snapshot as unknown as Record<string, unknown>, createdById: userId,
    }));
  }
}
