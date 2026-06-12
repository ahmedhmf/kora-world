import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

interface NavItem {
  label: string;
  route: string;
  icon: string;
}

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="flex h-screen bg-zinc-950 text-white overflow-hidden">

      <!-- Sidebar -->
      <aside class="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col flex-shrink-0">

        <!-- Logo -->
        <div class="px-6 py-5 border-b border-zinc-800">
          <div class="flex items-center gap-2">
            <span class="text-xl font-bold tracking-widest text-white uppercase">Kora</span>
            <span class="text-xs font-medium tracking-widest text-zinc-400 uppercase mt-0.5">World</span>
          </div>
          <p class="text-xs text-zinc-500 mt-1">Operations Hub</p>
        </div>

        <!-- Nav -->
        <nav class="flex-1 px-3 py-4 space-y-1">
          @for (item of navItems; track item.route) {
            <a
              [routerLink]="item.route"
              routerLinkActive="bg-zinc-800 text-white"
              [routerLinkActiveOptions]="{ exact: false }"
              class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors text-sm font-medium"
            >
              <span class="text-base">{{ item.icon }}</span>
              {{ item.label }}
            </a>
          }
        </nav>

        <!-- Footer -->
        <div class="px-6 py-4 border-t border-zinc-800">
          <p class="text-xs text-zinc-600">korafc.com</p>
        </div>
      </aside>

      <!-- Main content -->
      <main class="flex-1 overflow-auto">
        <router-outlet />
      </main>

    </div>
  `,
})
export class LayoutComponent {
  readonly navItems: NavItem[] = [
    { label: 'Dashboard', route: '/dashboard', icon: '⚡' },
    { label: 'Suppliers', route: '/suppliers', icon: '🏭' },
    { label: 'Products', route: '/products', icon: '⚽' },
    { label: 'Purchase Orders', route: '/purchase-orders', icon: '📋' },
  ];
}
