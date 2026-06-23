import { Component, inject } from '@angular/core';
import { DialogService } from '../../core/services/dialog.service';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  templateUrl: './confirm-dialog.component.html'
})
export class ConfirmDialogComponent {
  readonly dialogService = inject(DialogService);
}
