import { AfterViewInit, Component, ElementRef, Input, OnChanges, SimpleChanges, ViewChild } from '@angular/core';
import JsBarcode from 'jsbarcode';

@Component({
  selector: 'app-barcode-render',
  standalone: false,
  templateUrl: './barcode-render.component.html',
  styleUrls: ['./barcode-render.component.css']
})
export class BarcodeRenderComponent implements AfterViewInit, OnChanges {
  @Input() value = '';
  @ViewChild('svgRef', { static: true }) svgRef!: ElementRef<SVGElement>;

  ngAfterViewInit(): void {
    this.render();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value'] && this.svgRef) {
      this.render();
    }
  }

  private render(): void {
    const value = (this.value || '').trim();
    if (!value) {
      return;
    }

    JsBarcode(this.svgRef.nativeElement, value, {
      format: 'CODE128',
      displayValue: false,
      margin: 2,
      width: 1.2,
      height: 30
    });
  }
}
