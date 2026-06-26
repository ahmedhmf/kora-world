import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import {
  LucideAngularModule,
} from 'lucide-angular';

interface NavItem {
  label: string;
  route: string;
  icon: string;
  roles?: string[];
  subItems?: { label: string; route: string; icon: string }[];
}

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    FormsModule,
    LucideAngularModule,
  ],
  templateUrl: './layout.component.html',
})
export class LayoutComponent {
  readonly authService = inject(AuthService);
  readonly isMobileOpen = signal(false);

  readonly navItems: NavItem[] = [
    { label: 'Dashboard', route: '/dashboard', icon: 'layout-dashboard' },
    {
      label: 'Sourcing & Development',
      route: '/sourcing',
      icon: 'package',
      subItems: [
        { label: 'Suppliers', route: '/suppliers', icon: 'factory' },
        { label: 'Sourcing', route: '/sourcing', icon: 'search' },
        { label: 'Products', route: '/products', icon: 'dribbble' },
        { label: 'Samples', route: '/samples', icon: 'flask-conical' },
      ],
    },
    {
      label: 'Commercial Operations',
      route: '/commercial',
      icon: 'briefcase',
      subItems: [
        { label: 'Purchase Orders', route: '/purchase-orders', icon: 'clipboard-list' },
        { label: 'Accounts', route: '/accounts', icon: 'building-2' },
        { label: 'B2C Requests', route: '/b2c-requests', icon: 'smartphone' },
      ],
    },
    {
      label: 'Accounting',
      route: '/accounting',
      icon: 'landmark',
      subItems: [
        { label: 'Chart of Accounts', route: '/accounting/chart-of-accounts', icon: 'bar-chart-3' },
        { label: 'Journal Entries', route: '/accounting/journal', icon: 'book-open' },
        { label: 'Invoices', route: '/accounting/invoices', icon: 'receipt' },
        { label: 'Payments', route: '/accounting/payments', icon: 'credit-card' },
        { label: 'Financial Reports', route: '/accounting/reports', icon: 'trending-up' },
      ],
    },
    { label: 'Calendar', route: '/calendar', icon: 'calendar' },
    { label: 'Contacts', route: '/contacts', icon: 'contact' },
    { label: 'Employees', route: '/users', icon: 'users', roles: ['admin'] },
  ];

  // Collapsible submenus state
  openSubmenus = signal<Record<string, boolean>>({});

  toggleSubmenu(label: string) {
    this.openSubmenus.update((m) => ({
      ...m,
      [label]: !m[label],
    }));
  }

  isSubmenuOpen(label: string): boolean {
    return !!this.openSubmenus()[label];
  }

  // User Options Menu and Change Password state
  isUserMenuOpen = signal(false);
  isChangePasswordOpen = signal(false);
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  errorMessage = '';
  successMessage = '';
  isSubmitting = false;

  openChangePasswordModal() {
    this.currentPassword = '';
    this.newPassword = '';
    this.confirmPassword = '';
    this.errorMessage = '';
    this.successMessage = '';
    this.isChangePasswordOpen.set(true);
  }

  submitChangePassword() {
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.currentPassword || !this.newPassword || !this.confirmPassword) {
      this.errorMessage = 'All fields are required.';
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage = 'New password and confirmation do not match.';
      return;
    }

    // Complexity validation
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
    if (!regex.test(this.newPassword)) {
      this.errorMessage =
        'Password must be at least 8 characters long, and contain at least one uppercase letter, one lowercase letter, one number, and one special character.';
      return;
    }

    this.isSubmitting = true;
    this.authService.changePassword(this.currentPassword, this.newPassword).subscribe({
      next: () => {
        this.successMessage = 'Password changed successfully!';
        this.isSubmitting = false;
        setTimeout(() => {
          this.isChangePasswordOpen.set(false);
        }, 1500);
      },
      error: (err) => {
        this.errorMessage =
          err.error?.message || 'Failed to change password. Please verify current password.';
        this.isSubmitting = false;
      },
    });
  }

  get filteredNavItems(): NavItem[] {
    const role = this.authService.currentUser()?.role;
    if (role === 'supplier') {
      return this.navItems.filter(
        (item) =>
          item.label === 'Dashboard' ||
          item.label === 'Products' ||
          item.label === 'Samples' ||
          item.label === 'Purchase Orders',
      );
    }
    return this.navItems.filter((item) => !item.roles || (role && item.roles.includes(role)));
  }
}
