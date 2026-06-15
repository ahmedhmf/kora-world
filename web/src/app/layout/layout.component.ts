import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/services/auth.service';

interface NavItem {
  label: string;
  route: string;
  icon: string;
  roles?: string[];
}

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="flex h-screen bg-zinc-950 text-white overflow-hidden print:bg-white print:text-black print:h-auto print:overflow-visible">

      <!-- Sidebar -->
      <aside class="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col flex-shrink-0 print:hidden">

        <!-- Logo -->
        <div class="px-6 py-5 border-b border-zinc-800">
          <div class="flex items-center">
            <svg width="150" height="32" viewBox="0 0 224 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <g clip-path="url(#clip0_105_44)">
                <path d="M69.71 15.16L65.85 27.04C65.16 29.17 66.75 31.36 68.99 31.36H93.17H97.19C98.8 31.36 100.23 30.32 100.73 28.79L106.39 11.37C106.81 10.08 105.85 8.75 104.49 8.75H78.53C74.51 8.75 70.95 11.34 69.71 15.16ZM73.35 24.88L75.6 17.84C76.11 16.25 77.58 15.18 79.25 15.18H96.57C97.48 15.18 98.13 16.07 97.85 16.94L95.28 24.89H73.36L73.35 24.88Z" fill="white" stroke="black" stroke-miterlimit="10"/>
                <path d="M118.63 0.5L107.89 33.47C106.68 37.18 103.23 39.68 99.33 39.68L65.43 39.63C59.34 39.63 55.02 33.69 56.88 27.89L63.59 7.01C64.83 3.14 68.45 0.52 72.51 0.55L63.81 27.73C62.94 30.43 64.96 33.19 67.8 33.19H98.9C100.29 33.19 101.52 32.3 101.95 30.98L108.68 10.25C109.2 8.64 108 6.98 106.31 6.98L79.16 6.95C75.83 6.95 73.47 3.7 74.5 0.53V0.5H118.63Z" fill="white" stroke="black" stroke-miterlimit="10"/>
                <path d="M130.53 0.550003C126.51 0.550003 122.94 3.14 121.7 6.97L111.12 39.61H117.84L130.53 0.550003Z" fill="white" stroke="black" stroke-miterlimit="10"/>
                <path d="M155.55 0.5H132.48C131.45 3.67 133.81 6.92 137.14 6.92H155.65C157.36 6.92 158.56 8.59 158.03 10.21L153.21 24.95H159.97L164.09 12.28C165.98 6.47 161.65 0.51 155.54 0.51L155.55 0.5Z" fill="white" stroke="black" stroke-miterlimit="10"/>
                <path d="M150.92 24.94L155.84 10.9C156.21 9.85001 155.43 8.74001 154.31 8.74001H136.55C132.53 8.74001 128.97 11.33 127.73 15.15L119.78 39.67L126.52 39.6L129.8 29.51L135.63 39.6H143.04L134.54 24.88H131.3L133.6 17.8C134.11 16.22 135.58 15.16 137.24 15.16H145.65C146.6 15.16 147.26 16.1 146.95 16.99L144.17 24.89H136.75L145.15 39.61H152.57L144.21 24.94H150.93H150.92Z" fill="white" stroke="black" stroke-miterlimit="10"/>
                <path d="M179.75 0.550003L167.06 39.61H160.34L170.92 6.97C172.16 3.14 175.73 0.550003 179.75 0.550003Z" fill="white" stroke="black" stroke-miterlimit="10"/>
                <path d="M176.97 15.16L169.01 39.68L175.7 39.75L182.84 17.81C183.35 16.23 184.82 15.17 186.48 15.17H203.41C204.55 15.17 205.35 16.28 205 17.36L202.52 24.95H184.74C182.99 24.95 181.44 26.08 180.89 27.74L179.7 31.37H200.42L197.69 39.73H204.45L213.43 12.22C213.99 10.51 212.72 8.75999 210.92 8.75999H185.79C181.77 8.75999 178.21 11.35 176.97 15.17V15.16Z" fill="white" stroke="black" stroke-miterlimit="10"/>
                <path d="M206.39 39.68H213.1L222.15 11.64C223.93 6.14 219.82 0.5 214.04 0.5H181.83C180.8 3.67 183.16 6.92 186.49 6.92H211.21C214.08 6.92 216.11 9.72 215.23 12.44L206.39 39.68Z" fill="white" stroke="black" stroke-miterlimit="10"/>
                <path d="M62.66 0.550003L47.02 13.67C44.5 15.78 43.86 19.4 45.51 22.25L55.53 39.6H48.16L38.69 23.28C36.2 18.99 37.16 13.54 40.96 10.35L52.68 0.550003H62.66Z" fill="white" stroke="black" stroke-miterlimit="10"/>
                <path d="M46.04 39.68L39.06 27.59C35.89 22.1 28.54 20.81 23.69 24.88L15.54 31.72C13.56 33.38 10.64 31.41 11.44 28.95L20.66 0.550003H13.91L0.750025 41.07C-0.719975 45.6 4.65003 49.22 8.30003 46.16L25.05 32.1C28.28 29.39 33.18 30.26 35.28 33.92L38.58 39.67H46.03L46.04 39.68Z" fill="white" stroke="black" stroke-miterlimit="10"/>
                <path d="M22.59 0.550003H29.34L26.86 8.19C26.44 9.48 27.97 10.52 29.01 9.64L39.84 0.550003H49.82L25.31 21.11C21.58 24.24 16.09 20.53 17.59 15.9L22.59 0.550003Z" fill="white" stroke="black" stroke-miterlimit="10"/>
              </g>
              <defs>
                <clipPath id="clip0_105_44">
                  <rect width="223.08" height="47.8" fill="white"/>
                </clipPath>
              </defs>
            </svg>
          </div>
          <p class="text-xs text-zinc-500 mt-2">Operations Hub</p>
        </div>

        <!-- Nav -->
        <nav class="flex-1 px-3 py-4 space-y-1">
          @for (item of filteredNavItems; track item.route) {
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
        <div class="px-6 py-4 border-t border-zinc-800 space-y-3">
          @if (authService.currentUser(); as user) {
            <div>
              <p class="text-sm font-semibold text-white truncate">{{ user.name }}</p>
              <p class="text-xs text-zinc-500 truncate">{{ user.email }}</p>
            </div>
            <button
              (click)="authService.logout()"
              class="w-full py-1.5 bg-zinc-800 hover:bg-zinc-700 text-red-400 text-xs font-medium rounded-md transition-colors cursor-pointer"
            >
              Sign Out
            </button>
          } @else {
            <p class="text-xs text-zinc-600">korafc.com</p>
          }
        </div>
      </aside>

      <!-- Main content -->
      <main class="flex-1 overflow-auto print:overflow-visible">
        <router-outlet />
      </main>

    </div>
  `,
})
export class LayoutComponent {
  readonly authService = inject(AuthService);

  readonly navItems: NavItem[] = [
    { label: 'Dashboard', route: '/dashboard', icon: '⚡' },
    { label: 'Suppliers', route: '/suppliers', icon: '🏭' },
    { label: 'Products', route: '/products', icon: '⚽' },
    { label: 'Samples', route: '/samples', icon: '🧪' },
    { label: 'Purchase Orders', route: '/purchase-orders', icon: '📋' },
    { label: 'Employees', route: '/users', icon: '👥', roles: ['admin'] },
  ];

  get filteredNavItems(): NavItem[] {
    const role = this.authService.currentUser()?.role;
    return this.navItems.filter((item) => !item.roles || (role && item.roles.includes(role)));
  }
}
