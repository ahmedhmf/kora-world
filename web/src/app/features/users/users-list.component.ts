import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { UsersStore } from '../../store/users.store';
import { AuthService } from '../../core/services/auth.service';
import { DialogService } from '../../core/services/dialog.service';

@Component({
  selector: 'app-users-list',
  standalone: true,
  imports: [RouterLink, DatePipe],
  templateUrl: './users-list.component.html',
})
export class UsersListComponent implements OnInit {
  readonly store = inject(UsersStore);
  readonly authService = inject(AuthService);
  private readonly dialogService = inject(DialogService);

  ngOnInit(): void {
    this.store.loadUsers();
  }

  async delete(id: number): Promise<void> {
    const ok = await this.dialogService.confirm('Delete Employee', 'Are you sure you want to delete this employee account? This action cannot be undone.');
    if (ok) {
      this.store.deleteUser(id);
    }
  }

  roleClass(role: string): string {
    return role === 'admin'
      ? 'bg-blue-900/40 text-blue-400 border border-blue-800/30'
      : 'bg-zinc-800 text-zinc-400 border border-zinc-700/30';
  }
}
