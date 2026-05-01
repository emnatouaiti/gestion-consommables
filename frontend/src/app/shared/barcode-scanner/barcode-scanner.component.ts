import { Component, EventEmitter, Output, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrowserMultiFormatReader } from '@zxing/browser';

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
      this.reader.decodeFromVideoDevice(undefined, this.video.nativeElement, (result, err) => {
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
