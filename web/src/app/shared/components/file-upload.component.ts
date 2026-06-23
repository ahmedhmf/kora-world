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
        this.filePath = res.path;
        this.fileName = res.name;
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

  isImage(path: string): boolean {
    if (!path) return false;
    const lower = path.toLowerCase();
    return lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg');
  }

  getPublicUrl(path: string): string {
    return this.api.getPublicImageUrl(path);
  }
}
