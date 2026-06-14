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
        path: 'products/:id/edit',
        loadComponent: () =>
          import('./features/products/product-form.component').then((m) => m.ProductFormComponent),
      },
      {
        path: 'prototypes',
        loadComponent: () =>
          import('./features/prototypes/prototypes-list.component').then((m) => m.PrototypesListComponent),
      },
      {
        path: 'prototypes/new',
        loadComponent: () =>
          import('./features/prototypes/prototype-form.component').then((m) => m.PrototypeFormComponent),
      },
      {
        path: 'prototypes/:id/edit',
        loadComponent: () =>
          import('./features/prototypes/prototype-form.component').then((m) => m.PrototypeFormComponent),
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
    ],
  },
];
