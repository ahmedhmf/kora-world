import { ChangeDetectorRef, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { UsersStore } from '../../store/users.store';
import { SuppliersStore } from '../../store/suppliers.store';
import { ApiService } from '../../core/services/api.service';
import { CreateUserDto } from '../../core/models/user.model';

@Component({
  selector: 'app-user-form',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './user-form.component.html',
})
export class UserFormComponent implements OnInit {
  readonly store = inject(UsersStore);
  readonly suppliersStore = inject(SuppliersStore);
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly isEdit = signal(false);
  private editId = signal<number | null>(null);

  form: CreateUserDto = {
    name: '',
    email: '',
    role: '',
    supplierId: undefined,
    password: '',
  };

  ngOnInit(): void {
    this.suppliersStore.loadSuppliers();
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.isEdit.set(true);
        this.editId.set(+id);
        this.api.getUser(+id).subscribe((user) => {
          this.form = {
            name: user.name,
            email: user.email,
            role: user.role,
            supplierId: user.supplierId,
            password: '',
          };
          this.cdr.detectChanges();
        });
      } else {
        this.isEdit.set(false);
        this.editId.set(null);
        this.form = {
          name: '',
          email: '',
          role: '',
          supplierId: undefined,
          password: '',
        };
        this.cdr.detectChanges();
      }
    });
  }

  submit(): void {
    const dto: any = { ...this.form };

    if (this.isEdit() && (!dto.password || dto.password.trim() === '')) {
      delete dto.password;
    }

    if (dto.role !== 'supplier') {
      delete dto.supplierId;
    } else if (dto.supplierId) {
      dto.supplierId = +dto.supplierId;
    }

    if (this.isEdit() && this.editId()) {
      this.store.updateUser({ id: this.editId()!, dto });
    } else {
      this.store.createUser(dto);
    }

    this.router.navigate(['/users']);
  }
}
