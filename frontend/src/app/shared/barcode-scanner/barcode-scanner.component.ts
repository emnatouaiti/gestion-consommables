import { Component, EventEmitter, Output, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrowserMultiFormatReader, Result } from '@zxing/library';

@Component({
  selector: 'app-barcode-scanner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './barcode-scanner.component.html',
  styleUrls: ['./barcode-scanner.component.css']
})
export class BarcodeScannerComponent implements OnDestroy {
  @Output() codeDetected = new EventEmitter<string>();
  @ViewChild('video') video!: ElementRef<HTMLVideoElement>;
  private reader = new BrowserMultiFormatReader();
  private active = false;

  start(): void {
    if (this.active) return;
    this.active = true;
    try {
      this.reader.decodeFromVideoDevice(null, this.video.nativeElement, (result: Result | undefined, err: unknown) => {
        if (result) {
          this.codeDetected.emit(result.getText());
          this.stop();
        }
      });
    } catch (e) {
      this.stop();
    }
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    try { (this.reader as any).reset && (this.reader as any).reset(); } catch (e) { /* noop */ }
  }

  ngOnDestroy(): void {
    this.stop();
  }
}
