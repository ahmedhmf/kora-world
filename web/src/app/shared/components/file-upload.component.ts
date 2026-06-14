import { Component, inject, Input, Output, EventEmitter, signal } from '@angular/core';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-file-upload',
  standalone: true,
  template: `
    <div>
      <label class="block text-sm font-medium text-zinc-400 mb-1.5">{{ label }}</label>

      @if (filePath) {
        <!-- Uploaded File Card -->
        <div class="flex items-center justify-between bg-zinc-900 border border-zinc-700 rounded-lg p-4 transition-all duration-300 hover:border-zinc-500">
          <div class="flex items-center space-x-3 truncate">
            <svg class="h-6 w-6 text-zinc-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <div class="truncate">
              <p class="text-sm font-medium text-white truncate">{{ fileName || 'Uploaded Attachment' }}</p>
              <p class="text-xs text-zinc-500">Securely stored on server</p>
            </div>
          </div>
          <div class="flex items-center space-x-2 flex-shrink-0 ml-4">
            <button
              type="button"
              (click)="download()"
              [disabled]="downloading()"
              class="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-md transition-colors flex items-center space-x-1"
            >
              @if (downloading()) {
                <span class="animate-spin inline-block w-3 w-3 border border-t-transparent border-white rounded-full mr-1"></span>
                <span>Fetching...</span>
              } @else {
                <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span>Download</span>
              }
            </button>
            <button
              type="button"
              (click)="remove()"
              class="p-1.5 hover:bg-red-950/40 text-zinc-400 hover:text-red-400 rounded-md transition-colors"
              title="Remove File"
            >
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      } @else {
        <!-- Drag and Drop Zone -->
        <div
          (dragover)="onDragOver($event)"
          (dragleave)="onDragLeave($event)"
          (drop)="onDrop($event)"
          (click)="fileInput.click()"
          [class.border-white]="isDragging()"
          [class.bg-zinc-850]="isDragging()"
          class="flex flex-col items-center justify-center border-2 border-dashed border-zinc-700 rounded-lg p-6 bg-zinc-900/40 cursor-pointer transition-all duration-300 hover:border-zinc-500 hover:bg-zinc-900/60"
        >
          <input
            type="file"
            #fileInput
            (change)="onFileSelected($event)"
            class="hidden"
            accept=".pdf,.png,.jpg,.jpeg,.zip,.docx,.doc,.xls,.xlsx"
          />

          @if (uploading()) {
            <div class="flex flex-col items-center space-y-2">
              <span class="animate-spin inline-block w-8 h-8 border-4 border-zinc-700 border-t-white rounded-full"></span>
              <p class="text-sm text-zinc-400">Uploading Tech Pack...</p>
            </div>
          } @else {
            <svg class="h-10 w-10 text-zinc-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p class="text-sm font-medium text-white">Click or drag file here to upload</p>
            <p class="text-xs text-zinc-500 mt-1">PDF, JPG, PNG, DOCX up to 15MB</p>
          }
        </div>
      }

      @if (error()) {
        <p class="text-red-400 text-xs mt-1.5">{{ error() }}</p>
      }
    </div>
  `,
  styles: [`
    .bg-zinc-850 {
      background-color: rgba(39, 39, 42, 0.6);
    }
  `]
})
export class FileUploadComponent {
  private readonly api = inject(ApiService);

  @Input() label: string = 'Tech Pack File';
  @Input() filePath: string = '';
  @Input() fileName: string = '';

  @Output() fileUploaded = new EventEmitter<{ path: string; name: string }>();
  @Output() fileRemoved = new EventEmitter<void>();

  readonly uploading = signal(false);
  readonly downloading = signal(false);
  readonly isDragging = signal(false);
  readonly error = signal<string | null>(null);

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
    this.error.set(null);

    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.handleUpload(files[0]);
    }
  }

  onFileSelected(event: Event): void {
    this.error.set(null);
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (files && files.length > 0) {
      this.handleUpload(files[0]);
    }
  }

  private handleUpload(file: File): void {
    if (file.size > 15 * 1024 * 1024) {
      this.error.set('File exceeds the 15MB limit.');
      return;
    }

    this.uploading.set(true);
    this.api.uploadFile(file).subscribe({
      next: (res) => {
        this.uploading.set(false);
        this.fileUploaded.emit({ path: res.path, name: res.name });
      },
      error: (err) => {
        this.uploading.set(false);
        this.error.set('Upload failed. Please check server logs.');
        console.error('File upload error:', err);
      }
    });
  }

  download(): void {
    if (!this.filePath) return;
    this.downloading.set(true);
    this.api.downloadFile(this.filePath).subscribe({
      next: (blob) => {
        this.downloading.set(false);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = this.fileName || 'tech-pack';
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: (err) => {
        this.downloading.set(false);
        this.error.set('Download failed. You may not have permission.');
        console.error('File download error:', err);
      }
    });
  }

  remove(): void {
    this.filePath = '';
    this.fileName = '';
    this.fileRemoved.emit();
  }
}
