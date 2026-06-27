import { Routes } from '@angular/router';
import { LayoutComponent } from './layout/layout.component';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'users',
        canActivate: [roleGuard],
        loadComponent: () =>
          import('./features/users/users-list.component').then((m) => m.UsersListComponent),
      },
      {
        path: 'users/new',
        canActivate: [roleGuard],
        loadComponent: () =>
          import('./features/users/user-form.component').then((m) => m.UserFormComponent),
      },
      {
        path: 'users/:id/edit',
        canActivate: [roleGuard],
        loadComponent: () =>
          import('./features/users/user-form.component').then((m) => m.UserFormComponent),
      },
      {
        path: 'settings/dropdowns',
        canActivate: [roleGuard],
        loadComponent: () =>
          import('./features/settings/dropdown-settings.component').then((m) => m.DropdownSettingsComponent),
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'suppliers',
        loadComponent: () =>
          import('./features/suppliers/suppliers-list.component').then((m) => m.SuppliersListComponent),
      },
      {
        path: 'sourcing',
        loadChildren: () =>
          import('./features/sourcing/sourcing.routes').then((m) => m.routes),
      },
      {
        path: 'tech-pack-creator',
        loadComponent: () =>
          import('./features/tech-pack/tech-pack-creator.component').then((m) => m.TechPackCreatorComponent),
      },
      {
        path: 'suppliers/new',
        loadComponent: () =>
          import('./features/suppliers/supplier-form.component').then((m) => m.SupplierFormComponent),
      },
      {
        path: 'suppliers/:id/edit',
        loadComponent: () =>
          import('./features/suppliers/supplier-form.component').then((m) => m.SupplierFormComponent),
      },
      {
        path: 'products',
        loadComponent: () =>
          import('./features/products/products-list.component').then((m) => m.ProductsListComponent),
      },
      {
        path: 'products/new',
        loadComponent: () =>
          import('./features/products/product-form.component').then((m) => m.ProductFormComponent),
      },
      {
        path: 'products/:id',
        loadComponent: () =>
          import('./features/products/product-detail.component').then((m) => m.ProductDetailComponent),
      },
      {
        path: 'products/:id/edit',
        loadComponent: () =>
          import('./features/products/product-form.component').then((m) => m.ProductFormComponent),
      },
      {
        path: 'samples',
        loadComponent: () =>
          import('./features/samples/samples-list.component').then((m) => m.SamplesListComponent),
      },
      {
        path: 'samples/new',
        loadComponent: () =>
          import('./features/samples/sample-form.component').then((m) => m.SampleFormComponent),
      },
      {
        path: 'samples/:id',
        loadComponent: () =>
          import('./features/samples/sample-detail.component').then((m) => m.SampleDetailComponent),
      },
      {
        path: 'samples/:id/edit',
        loadComponent: () =>
          import('./features/samples/sample-form.component').then((m) => m.SampleFormComponent),
      },
      {
        path: 'samples/:id/receipt-protocol',
        loadComponent: () =>
          import('./features/samples/sample-receipt-protocol.component').then((m) => m.SampleReceiptProtocolComponent),
      },
      {
        path: 'purchase-orders',
        loadComponent: () =>
          import('./features/purchase-orders/purchase-orders-list.component').then((m) => m.PurchaseOrdersListComponent),
      },
      {
        path: 'purchase-orders/new',
        loadComponent: () =>
          import('./features/purchase-orders/purchase-order-form.component').then((m) => m.PurchaseOrderFormComponent),
      },
      {
        path: 'purchase-orders/:id',
        loadComponent: () =>
          import('./features/purchase-orders/purchase-order-detail.component').then((m) => m.PurchaseOrderDetailComponent),
      },
      {
        path: 'purchase-orders/:id/edit',
        loadComponent: () =>
          import('./features/purchase-orders/purchase-order-form.component').then((m) => m.PurchaseOrderFormComponent),
      },
      {
        path: 'calendar',
        loadComponent: () =>
          import('./features/events/calendar.component').then((m) => m.CalendarComponent),
      },
      {
        path: 'accounts',
        loadComponent: () =>
          import('./features/accounts/accounts-list.component').then((m) => m.AccountsListComponent),
      },
      {
        path: 'accounts/new',
        loadComponent: () =>
          import('./features/accounts/account-form.component').then((m) => m.AccountFormComponent),
      },
      {
        path: 'accounts/:id',
        loadComponent: () =>
          import('./features/accounts/account-detail.component').then((m) => m.AccountDetailComponent),
      },
      {
        path: 'accounts/:id/edit',
        loadComponent: () =>
          import('./features/accounts/account-form.component').then((m) => m.AccountFormComponent),
      },

      {
        path: 'contacts',
        loadComponent: () =>
          import('./features/contacts/contacts-list.component').then((m) => m.ContactsListComponent),
      },
      {
        path: 'contacts/new',
        loadComponent: () =>
          import('./features/contacts/contact-form.component').then((m) => m.ContactFormComponent),
      },
      {
        path: 'contacts/:id',
        loadComponent: () =>
          import('./features/contacts/contact-detail.component').then((m) => m.ContactDetailComponent),
      },
      {
        path: 'contacts/:id/edit',
        loadComponent: () =>
          import('./features/contacts/contact-form.component').then((m) => m.ContactFormComponent),
      },
      {
        path: 'b2c-requests',
        loadComponent: () =>
          import('./features/b2c-requests/b2c-requests-list.component').then((m) => m.B2cRequestsListComponent),
      },
      {
        path: 'b2c-requests/new',
        loadComponent: () =>
          import('./features/b2c-requests/b2c-request-form.component').then((m) => m.B2cRequestFormComponent),
      },
      {
        path: 'b2c-requests/:id/edit',
        loadComponent: () =>
          import('./features/b2c-requests/b2c-request-form.component').then((m) => m.B2cRequestFormComponent),
      },
      // Accounting Routes
      {
        path: 'accounting/chart-of-accounts',
        loadComponent: () =>
          import('./features/accounting/chart-of-accounts.component').then((m) => m.ChartOfAccountsComponent),
      },
      {
        path: 'accounting/journal',
        loadComponent: () =>
          import('./features/accounting/journal.component').then((m) => m.JournalComponent),
      },
      {
        path: 'accounting/invoices',
        loadComponent: () =>
          import('./features/accounting/invoices.component').then((m) => m.InvoicesComponent),
      },
      {
        path: 'accounting/payments',
        loadComponent: () =>
          import('./features/accounting/payments.component').then((m) => m.PaymentsComponent),
      },
      {
        path: 'accounting/reports',
        loadComponent: () =>
          import('./features/accounting/reports.component').then((m) => m.ReportsComponent),
      },
    ],
  },
];
