import { Component, inject, Input, Output, EventEmitter, signal } from '@angular/core';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-file-upload',
  standalone: true,
  templateUrl: './file-upload.component.html',
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
  @Input() allowMultiple: boolean = false;
  @Input() resetOnUpload: boolean = false;

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
      this.handleFiles(Array.from(files));
    }
  }

  onFileSelected(event: Event): void {
    this.error.set(null);
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (files && files.length > 0) {
      this.handleFiles(Array.from(files));
      input.value = '';
    }
  }

  private handleFiles(files: File[]): void {
    const validFiles = files.filter(f => f.size <= 15 * 1024 * 1024);
    if (validFiles.length < files.length) {
      this.error.set('Some files exceed the 15MB limit.');
    }
    if (validFiles.length === 0) return;

    this.uploading.set(true);
    let completed = 0;
    validFiles.forEach((file) => {
      this.api.uploadFile(file).subscribe({
        next: (res) => {
          completed++;
          if (!this.resetOnUpload && validFiles.length === 1) {
            this.filePath = res.path;
            this.fileName = res.name;
          } else {
            this.filePath = '';
            this.fileName = '';
          }
          this.fileUploaded.emit({ path: res.path, name: res.name });
          if (completed === validFiles.length) {
            this.uploading.set(false);
          }
        },
        error: (err) => {
          completed++;
          if (completed === validFiles.length) {
            this.uploading.set(false);
          }
          this.error.set('Upload failed for one or more files.');
          console.error('File upload error:', err);
        }
      });
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

  isImage(path: string): boolean {
    if (!path) return false;
    const lower = path.toLowerCase();
    return lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg');
  }

  getPublicUrl(path: string): string {
    return this.api.getPublicImageUrl(path);
  }
}
