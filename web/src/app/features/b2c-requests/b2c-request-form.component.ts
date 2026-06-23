import { ChangeDetectorRef, Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { B2cRequestsStore } from '../../store/b2c-requests.store';
import { ApiService } from '../../core/services/api.service';
import { Product } from '../../core/models/product.model';
import { CreateB2cRequestDto, B2cChannelType, B2cStatusType } from '../../core/models/b2c-request.model';

@Component({
  selector: 'app-b2c-request-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './b2c-request-form.component.html',
})
export class B2cRequestFormComponent implements OnInit {
  readonly store = inject(B2cRequestsStore);
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly isEdit = signal(false);
  private editId = signal<number | null>(null);

  // Form State
  form: Partial<CreateB2cRequestDto> = {
    customerName: '',
    channel: 'instagram',
    channelUsername: '',
    phone: '',
    email: '',
    requestedSize: '',
    requestedColor: '',
    quantity: 1,
    status: 'pending',
    notes: '',
  };

  // Product autocomplete selection state
  allProducts: Product[] = [];
  productSearch = '';
  showProductDropdown = signal(false);
  selectedProduct = signal<Product | null>(null);

  filteredProducts = computed(() => {
    const q = this.productSearch.toLowerCase().trim();
    if (!q) return this.allProducts.slice(0, 8);
    return this.allProducts.filter(
      (p) => p.name.toLowerCase().includes(q) || p.articleNumber.toLowerCase().includes(q)
    ).slice(0, 8);
  });

  ngOnInit(): void {
    // Load product catalogue for search autocomplete
    this.api.getProducts().subscribe({ next: (prods) => (this.allProducts = prods) });

    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.isEdit.set(true);
        this.editId.set(+id);
        this.api.getB2cRequest(+id).subscribe({
          next: (req) => {
            this.form = {
              customerName: req.customerName,
              channel: req.channel,
              channelUsername: req.channelUsername || '',
              phone: req.phone || '',
              email: req.email || '',
              requestedSize: req.requestedSize || '',
              requestedColor: req.requestedColor || '',
              quantity: req.quantity,
              status: req.status,
              notes: req.notes || '',
            };
            if (req.product) {
              this.selectedProduct.set(req.product as Product);
            }
            this.cdr.detectChanges();
          },
          error: (err) => {
            console.error('B2cRequestForm: error fetching request:', err);
          }
        });
      } else {
        this.isEdit.set(false);
        this.editId.set(null);
        this.form = {
          customerName: '',
          channel: 'instagram',
          channelUsername: '',
          phone: '',
          email: '',
          requestedSize: '',
          requestedColor: '',
          quantity: 1,
          status: 'pending',
          notes: '',
        };
        this.cdr.detectChanges();
      }
    });
  }

  onProductSearchChange(q: string): void {
    this.showProductDropdown.set(q.length > 0);
  }

  selectProduct(prod: Product): void {
    this.selectedProduct.set(prod);
    this.showProductDropdown.set(false);
    this.productSearch = '';
  }

  clearProduct(): void {
    this.selectedProduct.set(null);
    this.productSearch = '';
  }

  submit(): void {
    if (!this.form.customerName) return;

    const dto: CreateB2cRequestDto = {
      customerName: this.form.customerName,
      channel: this.form.channel as B2cChannelType,
      channelUsername: this.form.channelUsername || undefined,
      phone: this.form.phone || undefined,
      email: this.form.email || undefined,
      productId: this.selectedProduct() ? this.selectedProduct()!.id : undefined,
      requestedSize: this.form.requestedSize || undefined,
      requestedColor: this.form.requestedColor || undefined,
      quantity: this.form.quantity ? +this.form.quantity : 1,
      status: this.form.status as B2cStatusType,
      notes: this.form.notes || undefined,
    };

    const navigateBack = () => this.router.navigate(['/b2c-requests']);

    if (this.isEdit() && this.editId()) {
      this.store.updateRequest({ id: this.editId()!, dto, callback: navigateBack });
    } else {
      this.store.createRequest({ dto, callback: navigateBack });
    }
  }
}
