import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { SourcingStore, SourcingQuery } from '../../store/sourcing.store';

@Component({
  selector: 'app-sourcing',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './sourcing.component.html',
})
export class SourcingComponent {
  readonly store = inject(SourcingStore);

  // Form State
  sport: 'football' | 'handball' = 'football';
  tier: 'match_pro' | 'competition' | 'training' | 'club' = 'match_pro';
  certIhf = false;
  certFifa = false;
  certEn71 = false;
  targetMarket = 'Egypt';
  budgetPerUnit = '';
  moqMax: number | null = null;
  notes = '';

  // UI state
  isRecommendedOpen = signal(true);
  isEmailDraftOpen = signal(true);
  copied = signal(false);

  // Toggles for checkboxes
  toggleCertIhf() {
    this.certIhf = !this.certIhf;
  }

  toggleCertFifa() {
    this.certFifa = !this.certFifa;
  }

  toggleCertEn71() {
    this.certEn71 = !this.certEn71;
  }

  setSport(val: 'football' | 'handball') {
    this.sport = val;
  }

  onSubmit() {
    const certifications: string[] = [];
    if (this.certIhf) certifications.push('IHF');
    if (this.certFifa) certifications.push('FIFA Quality');
    if (this.certEn71) certifications.push('EN 71-1');

    const query: SourcingQuery = {
      sport: this.sport,
      tier: this.tier,
      certifications: certifications.length ? certifications : undefined,
      targetMarket: this.targetMarket || undefined,
      budgetPerUnit: this.budgetPerUnit || undefined,
      moqMax: this.moqMax || undefined,
      notes: this.notes || undefined,
    };

    this.store.runResearch(query);
  }

  copyEmailDraft(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    });
  }

  getScoreBadgeClass(score: number): string {
    if (score >= 8) {
      return 'bg-emerald-950/40 text-emerald-400 border-emerald-800/60';
    } else if (score >= 5) {
      return 'bg-amber-950/40 text-amber-400 border-amber-800/60';
    } else {
      return 'bg-red-950/40 text-red-400 border-red-800/60';
    }
  }

  toggleRecommended() {
    this.isRecommendedOpen.update((v) => !v);
  }

  toggleEmailDraft() {
    this.isEmailDraftOpen.update((v) => !v);
  }
}
