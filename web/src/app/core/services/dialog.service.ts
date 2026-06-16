import { Injectable, signal } from '@angular/core';

export interface DialogOptions {
  isOpen: boolean;
  title: string;
  message: string;
  isConfirm: boolean;
  resolve?: (value: boolean) => void;
}

@Injectable({
  providedIn: 'root'
})
export class DialogService {
  readonly state = signal<DialogOptions>({
    isOpen: false,
    title: '',
    message: '',
    isConfirm: false
  });

  confirm(title: string, message: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.state.set({
        isOpen: true,
        title,
        message,
        isConfirm: true,
        resolve
      });
    });
  }

  alert(title: string, message: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.state.set({
        isOpen: true,
        title,
        message,
        isConfirm: false,
        resolve
      });
    });
  }

  yes(): void {
    const currentState = this.state();
    if (currentState.resolve) {
      currentState.resolve(true);
    }
    this.close();
  }

  no(): void {
    const currentState = this.state();
    if (currentState.resolve) {
      currentState.resolve(false);
    }
    this.close();
  }

  close(): void {
    this.state.update(s => ({ ...s, isOpen: false }));
  }
}
