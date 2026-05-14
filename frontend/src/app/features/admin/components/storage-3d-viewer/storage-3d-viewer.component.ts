import {
  Component, ElementRef, Input, OnDestroy, OnInit,
  ViewChild, ChangeDetectorRef, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as THREE from 'three';
import { AdminStockService } from '../../services/admin-stock.service';
import { AdminWarehouseService } from '../../services/admin-warehouse.service';

/* ═══════════════════════════════════════════════════════════════════
   STORAGE 3D VIEWER — Professional Edition v4.1
   Thème  : Professionnel neutre · Lumière douce · Matériaux réalistes
   Moteur : Three.js r128 · PBR · Ombres douces · Ton mapping ACESFilmic
   Palette: Gris ardoise / Bleu acier / Vert opérationnel / Orange alerte
   v4.1   : Portes cliquables — clic sur battant = ouverture/fermeture
═══════════════════════════════════════════════════════════════════ */

@Component({
  selector: 'app-storage-3d-viewer',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
<div class="vr" [class.vr-loading]="isLoading">

  <!-- Canvas ────────────────────────────────────────────────── -->
  <div #canvasHost class="vr-canvas"
    (mousedown)="onMouseDown($event)"
    (mousemove)="onMouseMove($event)"
    (mouseup)="onMouseUp()"
    (mouseleave)="onMouseUp()"
    (wheel)="onWheel($event)"
    (click)="onCanvasClick($event)"
    (touchstart)="onTouchStart($event)"
    (touchmove)="onTouchMove($event)"
    (touchend)="onMouseUp()">
  </div>

  <!-- Loader ─────────────────────────────────────────────────── -->
  <div class="vr-loader" *ngIf="isLoading">
    <div class="ld-spinner">
      <div class="ld-track"></div>
      <div class="ld-arc"></div>
    </div>
    <div class="ld-label">Chargement de la vue 3D</div>
    <div class="ld-sub">{{ title }}</div>
  </div>

  <!-- Breadcrumb ──────────────────────────────────────────────── -->
  <div class="vr-breadcrumb" *ngIf="!isLoading">
    <ng-container *ngFor="let crumb of breadcrumbs; let i = index; let last = last">
      <button class="crumb-btn" [class.crumb-active]="last" (click)="goToCrumb(i)">
        {{ crumb.title }}
      </button>
      <svg *ngIf="!last" class="crumb-sep" viewBox="0 0 6 10" fill="none">
        <polyline points="1,1 5,5 1,9" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </ng-container>
    <div class="crumb-type">{{ typeLabel }}</div>
  </div>

  <!-- Header info ─────────────────────────────────────────────── -->
  <div class="vr-header" *ngIf="!isLoading">
    <div class="vr-title-block">
      <div class="vr-title">{{ title }}</div>
      <div class="vr-subtitle" *ngIf="type==='location'||type==='cabinet'">
        {{ currentUnits }} / {{ capacityUnits }} unités
        <span class="vr-pct" [class]="gaugeStatusClass">{{ percentage | number:'1.0-0' }}%</span>
      </div>
      <div class="vr-subtitle" *ngIf="type==='room'">
        {{ roomCabinets.length }} armoires · {{ roomLocations.length }} emplacements
      </div>
      <div class="vr-subtitle" *ngIf="type==='warehouse'">
        {{ warehouseRooms.length }} salles
      </div>
    </div>

    <!-- Gauge compacte -->
    <div class="vr-gauge" *ngIf="type==='location'||type==='cabinet'">
      <div class="vr-gauge-track">
        <div class="vr-gauge-fill" [class]="gaugeStatusClass"
          [style.width.%]="Math.min(percentage, 100)">
        </div>
      </div>
      <div class="vr-gauge-status" [class]="gaugeStatusClass">{{ gaugeStatus }}</div>
    </div>
  </div>

  <!-- Toolbar vertical ────────────────────────────────────────── -->
  <div class="vr-toolbar" *ngIf="!isLoading">
    <button class="vr-btn" title="Vue de face" (click)="setCameraPreset('front')">
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="3" y="3" width="14" height="14" rx="1.5"/>
        <line x1="3" y1="10" x2="17" y2="10"/>
        <line x1="10" y1="3" x2="10" y2="17"/>
      </svg>
    </button>
    <button class="vr-btn" title="Vue de dessus" (click)="setCameraPreset('top')">
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
        <ellipse cx="10" cy="10" rx="7" ry="3.5"/>
        <ellipse cx="10" cy="10" rx="7" ry="7"/>
        <line x1="10" y1="3" x2="10" y2="17"/>
      </svg>
    </button>
    <button class="vr-btn" title="Vue isométrique" (click)="setCameraPreset('iso')">
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M10 2L18 6.5V14L10 18L2 13.5V6L10 2Z"/>
        <line x1="10" y1="2" x2="10" y2="10"/>
        <line x1="2" y1="6" x2="10" y2="10"/>
        <line x1="18" y1="6.5" x2="10" y2="10"/>
      </svg>
    </button>
    <div class="vr-sep"></div>
    <button class="vr-btn" title="Zoom +" (click)="zoomBy(-2)">
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="9" cy="9" r="6"/><line x1="14" y1="14" x2="18" y2="18"/>
        <line x1="9" y1="6" x2="9" y2="12"/><line x1="6" y1="9" x2="12" y2="9"/>
      </svg>
    </button>
    <button class="vr-btn" title="Zoom -" (click)="zoomBy(2)">
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="9" cy="9" r="6"/><line x1="14" y1="14" x2="18" y2="18"/>
        <line x1="6" y1="9" x2="12" y2="9"/>
      </svg>
    </button>
    <button class="vr-btn" title="Réinitialiser" (click)="resetCamera()">
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M3 10a7 7 0 1 1 1.5 4.3"/>
        <path d="M3 14V10h4"/>
      </svg>
    </button>
    <div class="vr-sep"></div>
    <button class="vr-btn" [class.vr-btn-on]="autoRotate" title="Rotation auto" (click)="autoRotate=!autoRotate">
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M17 4v4h-4"/><path d="M17 8A8 8 0 1 0 15.5 14"/>
      </svg>
    </button>
    <ng-container *ngIf="type==='cabinet'">
      <div class="vr-sep"></div>
      <button class="vr-btn vr-btn-door" [class.vr-btn-on]="doorOpen"
       [title]="doorOpen ? 'Fermer l&amp;#39;armoire' : 'Ouvrir l&amp;#39;armoire'"
        [disabled]="doorAnimating"
        (click)="toggleDoor()">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="2" width="14" height="17" rx="1.5"/>
          <line x1="10" y1="2" x2="10" y2="19"/>
          <circle cx="13.5" cy="10.5" r="0.9" fill="currentColor" stroke="none"/>
          <circle cx="6.5" cy="10.5" r="0.9" fill="currentColor" stroke="none"/>
        </svg>
      </button>
    </ng-container>
  </div>

  <!-- Légende produits ─────────────────────────────────────────── -->
  <div class="vr-legend" *ngIf="!isLoading && uniqueProducts.length > 0">
    <div class="vr-legend-title">
      Produits
      <span class="vr-legend-count">{{ uniqueProducts.length }}</span>
    </div>
    <div class="vr-legend-list">
      <div class="vr-legend-row" *ngFor="let p of uniqueProducts">
        <div class="vr-legend-dot" [style.background]="'#'+p.colorHex"></div>
        <span class="vr-legend-name" [title]="p.title">{{ p.title }}</span>
        <span class="vr-legend-qty">×{{ p.qty }}</span>
      </div>
    </div>
  </div>

  <!-- Popup produit ───────────────────────────────────────────── -->
  <div class="vr-popup" *ngIf="selectedProduct"
    [style.left.px]="popupX" [style.top.px]="popupY">
    <div class="vr-popup-header">
      <div class="vr-popup-dot" [style.background]="'#'+toHex(selectedProduct.title||'')"></div>
      <span class="vr-popup-name">{{ selectedProduct.title }}</span>
      <button class="vr-popup-close" (click)="selectedProduct=null">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="4" x2="4" y2="12"/><line x1="4" y1="4" x2="12" y2="12"/>
        </svg>
      </button>
    </div>
    <div class="vr-popup-body">
      <div class="vr-field" *ngIf="selectedProduct.reference">
        <span class="vr-field-key">Référence</span>
        <span class="vr-field-val mono">{{ selectedProduct.reference }}</span>
      </div>
      <div class="vr-field">
        <span class="vr-field-key">Quantité</span>
        <span class="vr-field-val bold">{{ selectedProduct.local_quantity || selectedProduct.stock_quantity || 1 }}</span>
      </div>
      <div class="vr-field" *ngIf="selectedProduct.category?.title">
        <span class="vr-field-key">Catégorie</span>
        <span class="vr-field-val">{{ selectedProduct.category.title }}</span>
      </div>
      <div class="vr-field warn" *ngIf="selectedProduct.expiration_date">
        <span class="vr-field-key">Expiration</span>
        <span class="vr-field-val">{{ selectedProduct.expiration_date }}</span>
      </div>
      <div class="vr-field" *ngIf="selectedProduct.batch_number">
        <span class="vr-field-key">Lot</span>
        <span class="vr-field-val mono">{{ selectedProduct.batch_number }}</span>
      </div>
    </div>
  </div>

  <!-- Toast porte ─────────────────────────────────────────────── -->
  <div class="vr-door-toast" *ngIf="type==='cabinet' && !isLoading" [class.vr-door-toast-visible]="showDoorHint">
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" style="width:14px;height:14px">
      <rect x="2" y="1" width="12" height="14" rx="1.5"/>
      <line x1="8" y1="1" x2="8" y2="15"/>
      <circle cx="10.5" cy="8" r="0.7" fill="currentColor" stroke="none"/>
    </svg>
    Cliquez sur une porte pour l'ouvrir
  </div>

  <!-- Hint ────────────────────────────────────────────────────── -->
  <div class="vr-hint" *ngIf="!isLoading">{{ hint }}</div>

  <!-- Vide ────────────────────────────────────────────────────── -->
  <div class="vr-empty" *ngIf="!isLoading && type!=='warehouse' && type!=='room' && products.length===0">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
      <path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Z" opacity=".4"/>
      <path d="M12 12v4" stroke-width="2"/><circle cx="12" cy="9" r="1" fill="currentColor" opacity=".5"/>
    </svg>
    Aucun produit stocké ici
  </div>

</div>
  `,
  styles: [`
    :host { display: block; }

    /* ── Container ──────────────────────────────────────────── */
    .vr {
      position: relative;
      width: 100%;
      min-height: 500px;
      aspect-ratio: 4/3;
      max-height: 700px;
      border-radius: 12px;
      overflow: hidden;
      background: #f0f2f5;
      font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
      -webkit-font-smoothing: antialiased;
      box-shadow: 0 1px 3px rgba(0,0,0,.12), 0 4px 16px rgba(0,0,0,.08);
      border: 1px solid #dde1e7;
    }

    .vr-canvas {
      width: 100%; height: 100%;
      cursor: grab; display: block;
    }
    .vr-canvas:active { cursor: grabbing; }

    /* ── Loader ──────────────────────────────────────────────── */
    .vr-loader {
      position: absolute; inset: 0;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 14px;
      background: #f0f2f5;
      z-index: 50;
    }
    .ld-spinner {
      position: relative; width: 48px; height: 48px;
    }
    .ld-track {
      position: absolute; inset: 0;
      border-radius: 50%;
      border: 3px solid #dde1e7;
    }
    .ld-arc {
      position: absolute; inset: 0;
      border-radius: 50%;
      border: 3px solid transparent;
      border-top-color: #3b7dd8;
      animation: spin .9s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .ld-label {
      font-size: 14px; font-weight: 500;
      color: #1a2233; letter-spacing: -0.01em;
    }
    .ld-sub {
      font-size: 12px; color: #6b7280;
    }

    /* ── Breadcrumb ──────────────────────────────────────────── */
    .vr-breadcrumb {
      position: absolute; top: 14px; left: 14px;
      display: flex; align-items: center; gap: 4px;
      background: rgba(255,255,255,.88);
      backdrop-filter: blur(10px);
      border: 1px solid #dde1e7;
      border-radius: 8px;
      padding: 6px 12px;
      z-index: 10;
      box-shadow: 0 1px 4px rgba(0,0,0,.08);
    }
    .crumb-btn {
      font-size: 12px; font-weight: 500;
      color: #3b7dd8; background: none; border: none;
      cursor: pointer; padding: 0;
      transition: color .15s;
    }
    .crumb-btn:hover { color: #1d5baa; text-decoration: underline; }
    .crumb-btn.crumb-active { color: #1a2233; cursor: default; }
    .crumb-btn.crumb-active:hover { text-decoration: none; }
    .crumb-sep { width: 6px; height: 10px; color: #9ca3af; flex-shrink: 0; }
    .crumb-type {
      font-size: 11px; color: #6b7280;
      border-left: 1px solid #dde1e7;
      margin-left: 4px; padding-left: 8px;
      text-transform: uppercase; letter-spacing: 0.05em;
    }

    /* ── Header ─────────────────────────────────────────────── */
    .vr-header {
      position: absolute; top: 14px; right: 14px;
      display: flex; flex-direction: column; align-items: flex-end; gap: 8px;
      z-index: 10; pointer-events: none;
      max-width: 240px;
    }
    .vr-title-block {
      background: rgba(255,255,255,.88);
      backdrop-filter: blur(10px);
      border: 1px solid #dde1e7;
      border-radius: 8px;
      padding: 10px 14px;
      text-align: right;
      box-shadow: 0 1px 4px rgba(0,0,0,.08);
    }
    .vr-title {
      font-size: 14px; font-weight: 600;
      color: #1a2233; line-height: 1.2;
      letter-spacing: -0.02em;
    }
    .vr-subtitle {
      font-size: 12px; color: #6b7280;
      margin-top: 2px; display: flex; align-items: center;
      justify-content: flex-end; gap: 6px;
    }
    .vr-pct {
      font-size: 11px; font-weight: 600;
      padding: 1px 6px; border-radius: 4px;
    }

    /* Gauge compacte */
    .vr-gauge {
      background: rgba(255,255,255,.88);
      backdrop-filter: blur(10px);
      border: 1px solid #dde1e7;
      border-radius: 8px;
      padding: 8px 14px;
      width: 200px;
      box-shadow: 0 1px 4px rgba(0,0,0,.08);
    }
    .vr-gauge-track {
      height: 5px; border-radius: 3px;
      background: #e5e7eb; overflow: hidden;
      margin-bottom: 5px;
    }
    .vr-gauge-fill {
      height: 100%; border-radius: 3px;
      transition: width .5s ease;
    }
    .vr-gauge-status {
      font-size: 11px; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.05em;
    }

    /* Statut couleurs */
    .gauge-ok   { background: #dcfce7; color: #166534; }
    .gauge-warn { background: #fef9c3; color: #854d0e; }
    .gauge-full { background: #fee2e2; color: #991b1b; }
    .vr-gauge-fill.gauge-ok   { background: #22c55e; }
    .vr-gauge-fill.gauge-warn { background: #eab308; }
    .vr-gauge-fill.gauge-full { background: #ef4444; }
    .vr-gauge-status.gauge-ok   { color: #16a34a; }
    .vr-gauge-status.gauge-warn { color: #ca8a04; }
    .vr-gauge-status.gauge-full { color: #dc2626; }

    /* ── Toolbar ─────────────────────────────────────────────── */
    .vr-toolbar {
      position: absolute; right: 14px; top: 50%;
      transform: translateY(-50%);
      display: flex; flex-direction: column; gap: 2px; align-items: center;
      background: rgba(255,255,255,.88);
      backdrop-filter: blur(10px);
      border: 1px solid #dde1e7;
      border-radius: 10px;
      padding: 6px;
      z-index: 10;
      box-shadow: 0 1px 4px rgba(0,0,0,.08);
    }
    .vr-sep {
      width: 20px; height: 1px;
      background: #e5e7eb;
      margin: 3px 0;
    }
    .vr-btn {
      width: 34px; height: 34px;
      border-radius: 7px; border: 1px solid transparent;
      background: transparent; color: #6b7280;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer;
      transition: background .15s, color .15s, border-color .15s;
    }
    .vr-btn svg { width: 16px; height: 16px; }
    .vr-btn:hover {
      background: #eff6ff; color: #3b7dd8;
      border-color: #bfdbfe;
    }
    .vr-btn-on {
      background: #eff6ff; color: #3b7dd8;
      border-color: #93c5fd;
    }

    /* ── Légende ─────────────────────────────────────────────── */
    .vr-legend {
      position: absolute; bottom: 40px; left: 14px;
      background: rgba(255,255,255,.88);
      backdrop-filter: blur(10px);
      border: 1px solid #dde1e7;
      border-radius: 10px;
      padding: 12px 14px;
      min-width: 170px; max-width: 210px;
      max-height: 240px; overflow: hidden;
      z-index: 10;
      box-shadow: 0 1px 4px rgba(0,0,0,.08);
    }
    .vr-legend-title {
      font-size: 11px; font-weight: 600;
      color: #6b7280;
      text-transform: uppercase; letter-spacing: 0.06em;
      margin-bottom: 8px;
      display: flex; align-items: center; gap: 6px;
    }
    .vr-legend-count {
      background: #eff6ff; color: #3b7dd8;
      font-size: 10px; font-weight: 700;
      padding: 1px 6px; border-radius: 10px;
    }
    .vr-legend-list {
      display: flex; flex-direction: column; gap: 5px;
      overflow-y: auto; max-height: 190px;
    }
    .vr-legend-list::-webkit-scrollbar { width: 3px; }
    .vr-legend-list::-webkit-scrollbar-track { background: transparent; }
    .vr-legend-list::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 2px; }
    .vr-legend-row { display: flex; align-items: center; gap: 8px; }
    .vr-legend-dot { width: 9px; height: 9px; border-radius: 2px; flex-shrink: 0; }
    .vr-legend-name {
      font-size: 12px; color: #374151; flex: 1;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .vr-legend-qty { font-size: 11px; font-weight: 600; color: #9ca3af; }

    /* ── Popup produit ───────────────────────────────────────── */
    .vr-popup {
      position: absolute;
      min-width: 230px; max-width: 270px;
      background: #fff;
      border: 1px solid #dde1e7;
      border-radius: 10px;
      box-shadow: 0 4px 20px rgba(0,0,0,.14);
      overflow: hidden; z-index: 100;
      animation: popIn .2s ease;
    }
    @keyframes popIn {
      from { opacity: 0; transform: scale(.95) translateY(4px); }
      to   { opacity: 1; transform: none; }
    }
    .vr-popup-header {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 12px;
      border-bottom: 1px solid #f3f4f6;
      background: #fafafa;
    }
    .vr-popup-dot { width: 10px; height: 10px; border-radius: 2px; flex-shrink: 0; }
    .vr-popup-name {
      font-size: 13px; font-weight: 600;
      color: #111827; flex: 1; line-height: 1.3;
    }
    .vr-popup-close {
      width: 22px; height: 22px; border-radius: 5px;
      border: 1px solid #e5e7eb;
      background: #fff; color: #9ca3af;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; flex-shrink: 0;
      transition: background .15s;
    }
    .vr-popup-close:hover { background: #fee2e2; color: #dc2626; }
    .vr-popup-close svg { width: 10px; height: 10px; }
    .vr-popup-body { padding: 10px 12px; }
    .vr-field {
      display: flex; justify-content: space-between; align-items: center;
      padding: 5px 0;
      border-bottom: 1px solid #f3f4f6;
      gap: 12px;
    }
    .vr-field:last-child { border-bottom: none; }
    .vr-field-key { font-size: 11.5px; color: #9ca3af; white-space: nowrap; }
    .vr-field-val { font-size: 12px; color: #374151; text-align: right; }
    .vr-field.warn .vr-field-val { color: #b45309; }
    .mono { font-family: 'DM Mono','Fira Code',monospace; font-size: 11px; }
    .bold { font-weight: 700; color: #111827; font-size: 14px; }

    /* ── Toast porte ─────────────────────────────────────────── */
    .vr-door-toast {
      position: absolute; top: 56px; left: 14px;
      display: flex; align-items: center; gap: 7px;
      background: rgba(59,125,216,.92);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(147,197,253,.5);
      border-radius: 8px;
      padding: 7px 12px;
      color: #fff; font-size: 12px; font-weight: 500;
      z-index: 20;
      pointer-events: none;
      opacity: 0;
      transform: translateY(-4px);
      transition: opacity .3s ease, transform .3s ease;
    }
    .vr-door-toast-visible {
      opacity: 1;
      transform: translateY(0);
    }

    /* ── Hint ────────────────────────────────────────────────── */
    .vr-hint {
      position: absolute; bottom: 10px; left: 50%;
      transform: translateX(-50%);
      font-size: 11px; color: #9ca3af;
      pointer-events: none; z-index: 10;
      white-space: nowrap;
      background: rgba(255,255,255,.7);
      backdrop-filter: blur(6px);
      padding: 4px 10px; border-radius: 20px;
    }

    .vr-btn-door { color: #3b7dd8; }
    .vr-btn-door[disabled] { opacity: 0.5; cursor: not-allowed; }

    /* ── Vide ────────────────────────────────────────────────── */
    .vr-empty {
      position: absolute; bottom: 90px; left: 50%;
      transform: translateX(-50%);
      display: flex; align-items: center; gap: 8px;
      background: rgba(255,255,255,.85);
      backdrop-filter: blur(8px);
      border: 1px solid #e5e7eb;
      border-radius: 30px;
      padding: 8px 18px;
      color: #9ca3af; font-size: 13px;
      pointer-events: none; white-space: nowrap;
    }
    .vr-empty svg { width: 18px; height: 18px; }
  `]
})
export class Storage3dViewerComponent implements OnInit, OnDestroy {
  @ViewChild('canvasHost', { static: true }) canvasHost!: ElementRef<HTMLDivElement>;

  @Input() title: string = 'Stockage';
  @Input() capacityUnits: number = 100;
  @Input() currentUnits: number = 0;
  @Input() storageId: number | null = null;
  @Input() type: 'warehouse' | 'room' | 'location' | 'cabinet' = 'location';

  readonly Math = Math;

  percentage = 0;
  products: any[] = [];
  uniqueProducts: { title: string; qty: number; colorHex: string }[] = [];
  isLoading = false;
  selectedProduct: any = null;
  popupX = 0; popupY = 0;
  roomCabinets: any[] = [];
  roomLocations: any[] = [];
  warehouseRooms: any[] = [];
  autoRotate = false;
  doorOpen = false;
  doorAnimating = false;
  doorOpenAngle = 0;
  showDoorHint = false;
  private doorHintTimer: any = null;
  private doorTargetAngle = 0;
  private doorPivotLeft: THREE.Group | null = null;
  private doorPivotRight: THREE.Group | null = null;
  private interiorLight: THREE.PointLight | null = null;

  // Navigation
  viewStack: { type: string; id: number | null; title: string; capacity: number; current: number }[] = [];

  // Three.js
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private animId: number | null = null;
  private rootGroup!: THREE.Group;
  private clickables: { mesh: THREE.Mesh; data: any; entityType: string }[] = [];
  private floatingMeshes: { mesh: THREE.Object3D; baseY: number; speed: number; amp: number; phase: number }[] = [];
  private envLights: THREE.Light[] = [];
  private clock = new THREE.Clock();
  private resizeObserver!: ResizeObserver;

  // Orbit
  private isDragging = false;
  private prevMouse = { x: 0, y: 0 };
  private prevTouch = { x: 0, y: 0 };
  private sph = { theta: 0.5, phi: 1.05, radius: 10 };
  private targetSph = { theta: 0.5, phi: 1.05, radius: 10 };

  /* ── Getters ──────────────────────────────────────────────── */
  get typeLabel(): string {
    return { warehouse: 'Entrepôt', room: 'Salle', location: 'Emplacement', cabinet: 'Armoire' }[this.type] ?? '';
  }

  get hint(): string {
    if (this.type === 'warehouse') return 'Glisser pour tourner · Molette pour zoomer · Clic pour entrer dans une salle';
    if (this.type === 'room') return 'Clic sur une armoire ou un emplacement pour explorer';
    if (this.type === 'cabinet') return 'Clic sur une porte pour l\'ouvrir · Clic sur un produit pour ses détails';
    return 'Glisser pour tourner · Clic sur un produit pour ses détails';
  }

  get gaugeStatus(): string {
    if (this.percentage >= 90) return 'Saturé';
    if (this.percentage >= 70) return 'Presque plein';
    return 'Disponible';
  }
  get gaugeStatusClass(): string {
    if (this.percentage >= 90) return 'gauge-full';
    if (this.percentage >= 70) return 'gauge-warn';
    return 'gauge-ok';
  }

  get breadcrumbs(): { title: string; type: string }[] {
    return [
      ...this.viewStack.map(v => ({ title: v.title, type: v.type })),
      { title: this.title, type: this.type }
    ];
  }

  constructor(
    private stockService: AdminStockService,
    private warehouseService: AdminWarehouseService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.percentage = this.capacityUnits > 0 ? (this.currentUnits / this.capacityUnits) * 100 : 0;
    this.initThree();
    this.setupResizeObserver();
    if (this.storageId) this.fetchData();
    else this.buildScene();
  }

  ngOnDestroy() {
    if (this.animId !== null) cancelAnimationFrame(this.animId);
    this.resizeObserver?.disconnect();
    if (this.doorHintTimer) clearTimeout(this.doorHintTimer);
    this.disposeScene();
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
    this.renderer?.domElement?.remove();
  }

  /* ── ResizeObserver ────────────────────────────────────────── */
  private setupResizeObserver() {
    this.resizeObserver = new ResizeObserver(entries => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width === 0 || height === 0) return;
      this.renderer.setSize(width, height);
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    });
    this.resizeObserver.observe(this.canvasHost.nativeElement);
  }

  /* ── Navigation ─────────────────────────────────────────────── */
  goToCrumb(index: number) {
    if (index === this.breadcrumbs.length - 1) return;
    const stepsBack = this.breadcrumbs.length - 1 - index;
    for (let i = 0; i < stepsBack; i++) this.goBack(false);
    this.fetchData();
  }

  goBack(andFetch = true) {
    const prev = this.viewStack.pop();
    if (!prev) return;
    this.type = prev.type as any;
    this.storageId = prev.id;
    this.title = prev.title;
    this.capacityUnits = prev.capacity;
    this.currentUnits = prev.current;
    this.percentage = this.capacityUnits > 0 ? (this.currentUnits / this.capacityUnits) * 100 : 0;
    this.selectedProduct = null;
    if (andFetch) this.fetchData();
  }

  /* ── Mouse / Touch ──────────────────────────────────────────── */
  onMouseDown(e: MouseEvent) { this.isDragging = true; this.prevMouse = { x: e.clientX, y: e.clientY }; }
  onMouseUp() { this.isDragging = false; }

  onMouseMove(e: MouseEvent) {
    if (!this.isDragging) return;
    const dx = e.clientX - this.prevMouse.x;
    const dy = e.clientY - this.prevMouse.y;
    this.targetSph.theta -= dx * 0.007;
    this.targetSph.phi = Math.max(0.15, Math.min(Math.PI - 0.15, this.targetSph.phi + dy * 0.007));
    this.prevMouse = { x: e.clientX, y: e.clientY };
  }

  onWheel(e: WheelEvent) {
    e.preventDefault();
    this.targetSph.radius = Math.max(3, Math.min(34, this.targetSph.radius + e.deltaY * 0.012));
  }

  onTouchStart(e: TouchEvent) {
    if (e.touches.length === 1) {
      this.isDragging = true;
      this.prevTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }
  onTouchMove(e: TouchEvent) {
    if (!this.isDragging || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - this.prevTouch.x;
    const dy = e.touches[0].clientY - this.prevTouch.y;
    this.targetSph.theta -= dx * 0.007;
    this.targetSph.phi = Math.max(0.15, Math.min(Math.PI - 0.15, this.targetSph.phi + dy * 0.007));
    this.prevTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }

  onCanvasClick(e: MouseEvent) {
    if (Math.abs(e.movementX) > 3 || Math.abs(e.movementY) > 3) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(mouse, this.camera);
    const hits = ray.intersectObjects(this.clickables.map(c => c.mesh), true);
    if (!hits.length) { this.selectedProduct = null; this.cdr.markForCheck(); return; }

    // Trouver le clickable correspondant (peut être un enfant dans un Group)
    let found = this.clickables.find(c => c.mesh === hits[0].object);
    if (!found) {
      // Chercher dans les parents si le mesh est dans un Group
      for (const hit of hits) {
        found = this.clickables.find(c => c.mesh === hit.object);
        if (found) break;
      }
    }
    if (!found) return;

    if (this.type === 'warehouse' || this.type === 'room') {
      // Navigation vers sous-entité
      this.viewStack.push({ type: this.type, id: this.storageId, title: this.title, capacity: this.capacityUnits, current: this.currentUnits });
      this.type = found.entityType as any;
      this.storageId = found.data.id;
      this.title = found.data.name || found.data.code || '';
      this.capacityUnits = found.data.capacity_units || 0;
      this.currentUnits = found.data.current_units || 0;
      this.percentage = this.capacityUnits > 0 ? (this.currentUnits / this.capacityUnits) * 100 : 0;
      this.selectedProduct = null;
      this.fetchData();
    } else if (found.entityType === 'door') {
      // ── Clic sur une porte → bascule ouverture/fermeture ──
      if (!this.doorAnimating) {
        this.toggleDoor();
      }
    } else {
      // Popup produit
      this.selectedProduct = found.data;
      const elW = this.canvasHost.nativeElement.clientWidth;
      const elH = this.canvasHost.nativeElement.clientHeight;
      const px = e.offsetX + 16;
      const py = Math.min(e.offsetY + 16, elH - 260);
      this.popupX = px > elW - 290 ? px - 286 : px;
      this.popupY = py;
    }
    this.cdr.markForCheck();
  }

  /* ── Camera ─────────────────────────────────────────────────── */
  setCameraPreset(preset: 'front' | 'top' | 'iso') {
    if (preset === 'front') { this.targetSph.theta = 0; this.targetSph.phi = 1.1; }
    if (preset === 'top')   { this.targetSph.phi = 0.18; }
    if (preset === 'iso')   { this.targetSph.theta = 0.6; this.targetSph.phi = 0.85; }
  }
  zoomBy(d: number) { this.targetSph.radius = Math.max(3, Math.min(34, this.targetSph.radius + d * 1.8)); }
  resetCamera() { this.targetSph = { theta: 0.5, phi: 1.05, radius: this.defaultRadius }; }

  toggleDoor() {
    if (this.doorAnimating) return;
    this.doorOpen = !this.doorOpen;
    this.doorTargetAngle = this.doorOpen ? Math.PI * 0.72 : 0;
    this.doorAnimating = true;
    if (this.doorOpen) {
      this.targetSph.theta = 0;
      this.targetSph.phi   = 1.18;
      this.targetSph.radius = Math.max(this.defaultRadius * 0.65, 5);
    } else {
      this.resetCamera();
    }
    this.cdr.markForCheck();
  }

  private get defaultRadius() {
    return { warehouse: 24, room: 20, location: 12, cabinet: 12 }[this.type] ?? 12;
  }

  private updateCamera() {
    const { theta, phi, radius } = this.sph;
    this.camera.position.set(
      radius * Math.sin(phi) * Math.sin(theta),
      radius * Math.cos(phi) + 1.5,
      radius * Math.sin(phi) * Math.cos(theta)
    );
    const lookY = this.type === 'cabinet' ? 3.2 : 1.2;
    this.camera.lookAt(0, lookY, 0);
  }

  /* ── Init Three.js ──────────────────────────────────────────── */
  private initThree() {
    const el = this.canvasHost.nativeElement;
    const W = el.clientWidth || 800;
    const H = el.clientHeight || 600;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 400);
    this.updateCamera();

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setSize(W, H);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    if ('outputColorSpace' in this.renderer) {
      (this.renderer as any).outputColorSpace = 'srgb';
    } else {
      (this.renderer as any).outputEncoding = 3001;
    }
    el.appendChild(this.renderer.domElement);

    this.buildEnvironment();
    this.startRenderLoop();
  }

  /* ── Environnement professionnel ────────────────────────────── */
  private buildEnvironment() {
    this.scene.background = new THREE.Color(0xeceff4);
    this.scene.fog = new THREE.FogExp2(0xe8ecf2, 0.009);

    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambient);

    const hemi = new THREE.HemisphereLight(0xffffff, 0xd4c8b0, 0.9);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight(0xfffaf0, 2.4);
    key.position.set(12, 24, 8);
    key.castShadow = true;
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 80;
    key.shadow.camera.left = -30; key.shadow.camera.right = 30;
    key.shadow.camera.top = 30;   key.shadow.camera.bottom = -30;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.0004;
    key.shadow.radius = 5;
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0xe8f0ff, 0.8);
    fill.position.set(-10, 8, -6);
    this.scene.add(fill);

    const groundMat = new THREE.MeshStandardMaterial({
      color: 0xcdd2da, roughness: 0.9, metalness: 0,
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const grid = new THREE.GridHelper(100, 100, 0xaeb5c0, 0xc4cad4);
    grid.position.y = 0.003;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.3;
    this.scene.add(grid);
  }

  /* ── Render loop ─────────────────────────────────────────────── */
  private startRenderLoop() {
    const loop = () => {
      this.animId = requestAnimationFrame(loop);
      const dt = this.clock.getDelta();
      const t  = this.clock.getElapsedTime();

      const lf = Math.min(1, dt * 9);
      this.sph.theta  += (this.targetSph.theta  - this.sph.theta)  * lf;
      this.sph.phi    += (this.targetSph.phi    - this.sph.phi)    * lf;
      this.sph.radius += (this.targetSph.radius - this.sph.radius) * lf;

      if (this.autoRotate && !this.isDragging) this.targetSph.theta += dt * 0.2;
      this.updateCamera();

      // Animation ouverture / fermeture des portes
      if (this.doorAnimating && this.doorPivotLeft && this.doorPivotRight) {
        const speed = 3.5;
        const diff = this.doorTargetAngle - this.doorOpenAngle;
        const step = Math.sign(diff) * Math.min(Math.abs(diff), speed * dt);
        this.doorOpenAngle += step;
        this.doorPivotLeft.rotation.y  =  this.doorOpenAngle;
        this.doorPivotRight.rotation.y = -this.doorOpenAngle;
        if (this.interiorLight) {
          this.interiorLight.intensity = (this.doorOpenAngle / (Math.PI * 0.72)) * 1.4;
        }
        if (Math.abs(diff) < 0.003) {
          this.doorOpenAngle = this.doorTargetAngle;
          this.doorPivotLeft.rotation.y  =  this.doorOpenAngle;
          this.doorPivotRight.rotation.y = -this.doorOpenAngle;
          this.doorAnimating = false;
          this.cdr.markForCheck();
        }
      }

      // Légère animation de flottement des produits
      for (const f of this.floatingMeshes) {
        f.mesh.position.y = f.baseY + Math.sin(t * f.speed + f.phase) * f.amp;
      }

      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  /* ── Nettoyage scène ─────────────────────────────────────────── */
  private disposeScene() {
    if (!this.rootGroup) return;
    this.rootGroup.traverse(obj => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.geometry?.dispose();
        if (Array.isArray(mesh.material)) mesh.material.forEach(m => m.dispose());
        else (mesh.material as THREE.Material)?.dispose();
      }
    });
    this.scene?.remove(this.rootGroup);
  }

  /* ── Fetch ───────────────────────────────────────────────────── */
  fetchData() {
    this.isLoading = true;
    this.selectedProduct = null;
    this.cdr.markForCheck();

    if (this.type === 'warehouse') { this.fetchWarehouse(); return; }
    if (this.type === 'room')      { this.fetchRoom();      return; }

    const req$ = this.type === 'cabinet'
      ? this.stockService.getProductsByCabinet(this.storageId as number)
      : this.stockService.getProductsByLocation(this.storageId as number);

    req$.subscribe({
      next: (res: any) => {
        this.products = res.data || res || [];
        this.buildUniqueProducts();
        this.isLoading = false;
        this.buildScene();
        this.cdr.markForCheck();
      },
      error: () => { this.isLoading = false; this.buildScene(); this.cdr.markForCheck(); }
    });
  }

  private fetchWarehouse() {
    this.warehouseService.listRooms(this.storageId as number).subscribe({
      next: (res: any) => {
        this.warehouseRooms = res?.data || res || [];
        this.products = []; this.uniqueProducts = [];
        this.roomCabinets = []; this.roomLocations = [];
        this.isLoading = false; this.buildScene(); this.cdr.markForCheck();
      },
      error: () => { this.warehouseRooms = []; this.isLoading = false; this.buildScene(); this.cdr.markForCheck(); }
    });
  }

  private fetchRoom() {
    if (!this.storageId) return;
    import('rxjs').then(({ forkJoin }) => {
      forkJoin({
        cabinets:  this.warehouseService.listCabinets(this.storageId as number),
        locations: this.warehouseService.listLocations(this.storageId as number)
      }).subscribe({
        next: (res: any) => {
          this.roomCabinets  = res.cabinets.data  || res.cabinets  || [];
          this.roomLocations = res.locations.data || res.locations || [];
          this.isLoading = false; this.buildScene(); this.cdr.markForCheck();
        },
        error: () => { this.isLoading = false; this.buildScene(); this.cdr.markForCheck(); }
      });
    });
  }

  private buildUniqueProducts() {
    const map: Record<number, any> = {};
    for (const p of this.products) {
      const q = p.local_quantity || p.stock_quantity || 1;
      if (map[p.id]) map[p.id].qty += q;
      else map[p.id] = { title: p.title || 'Produit', qty: q, colorHex: this.toHex(p.title || String(p.id)) };
    }
    this.uniqueProducts = Object.values(map);
  }

  /* ── Builder principal ───────────────────────────────────────── */
  private buildScene() {
    this.disposeScene();
    this.clickables = [];
    this.floatingMeshes = [];
    this.envLights = [];
    this.doorOpen = false;
    this.doorAnimating = false;
    this.doorOpenAngle = 0;
    this.doorTargetAngle = 0;
    this.doorPivotLeft = null;
    this.doorPivotRight = null;
    this.interiorLight = null;
    this.rootGroup = new THREE.Group();
    this.scene.add(this.rootGroup);
    this.targetSph.radius = this.defaultRadius;

    if (this.type === 'warehouse')    this.buildWarehouseScene();
    else if (this.type === 'room')    this.buildRoomScene();
    else if (this.type === 'cabinet') this.buildCabinetScene();
    else                               this.buildLocationScene();

    // Afficher le toast "Cliquez sur une porte" lors de l'entrée dans une armoire
    if (this.type === 'cabinet') {
      this.showDoorHint = true;
      this.cdr.markForCheck();
      if (this.doorHintTimer) clearTimeout(this.doorHintTimer);
      this.doorHintTimer = setTimeout(() => {
        this.showDoorHint = false;
        this.cdr.markForCheck();
      }, 3500);
    }
  }

  /* ══════════════════════════════════════════════════════════
     ENTREPÔT — Bâtiments industriels réalistes
  ══════════════════════════════════════════════════════════ */
  private buildWarehouseScene() {
    const rooms = this.warehouseRooms;
    if (!rooms.length) return;

    const cols = Math.ceil(Math.sqrt(rooms.length));
    const CELL = 8;
    const offX = -((cols - 1) * CELL) / 2;
    const offZ = -((Math.ceil(rooms.length / cols) - 1) * CELL) / 2;

    rooms.forEach((room, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const px = offX + col * CELL;
      const pz = offZ + row * CELL;
      const fill = room.capacity_units > 0 ? Math.min((room.current_units || 0) / room.capacity_units, 1) : 0;

      const statusColor = fill >= 0.9
        ? new THREE.Color(0xef4444)
        : fill >= 0.7
          ? new THREE.Color(0xf59e0b)
          : new THREE.Color(0x22c55e);

      const W = 5.5, D = 4.5, H = 4.0;

      const wallMat = new THREE.MeshStandardMaterial({ color: 0xd9dde6, roughness: 0.85, metalness: 0.0 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), wallMat);
      body.position.set(px, H / 2, pz);
      body.castShadow = true; body.receiveShadow = true;
      this.rootGroup.add(body);

      const roofMat = new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.7, metalness: 0.2 });
      const roofLeft  = new THREE.Mesh(new THREE.BoxGeometry(W + 0.3, 0.15, D / 2 + 0.15), roofMat);
      const roofRight = roofLeft.clone();
      roofLeft.rotation.z  =  0.22;
      roofRight.rotation.z = -0.22;
      roofLeft.position.set(px - W * 0.12, H + 0.55, pz);
      roofRight.position.set(px + W * 0.12, H + 0.55, pz);
      roofLeft.castShadow = true;
      roofRight.castShadow = true;
      this.rootGroup.add(roofLeft, roofRight);

      const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, D + 0.3), roofMat);
      ridge.position.set(px, H + 0.95, pz);
      this.rootGroup.add(ridge);

      const doorMat = new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.5, metalness: 0.4 });
      const door = new THREE.Mesh(new THREE.BoxGeometry(W * 0.55, H * 0.72, 0.08), doorMat);
      door.position.set(px, H * 0.37, pz + D / 2 + 0.01);
      this.rootGroup.add(door);
      for (let seg = 1; seg < 5; seg++) {
        const seg_mat = new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.6, metalness: 0.5 });
        const line = new THREE.Mesh(new THREE.BoxGeometry(W * 0.55, 0.025, 0.09), seg_mat);
        line.position.set(px, H * 0.37 - H * 0.72 / 2 + (H * 0.72 / 5) * seg, pz + D / 2 + 0.02);
        this.rootGroup.add(line);
      }

      const bandMat = new THREE.MeshStandardMaterial({
        color: statusColor, roughness: 0.5, metalness: 0.0,
        emissive: statusColor, emissiveIntensity: 0.08,
      });
      const band = new THREE.Mesh(new THREE.BoxGeometry(W + 0.05, 0.28, D + 0.05), bandMat);
      band.position.set(px, H - 0.14, pz);
      this.rootGroup.add(band);

      const winMat = new THREE.MeshStandardMaterial({ color: 0x93c5fd, roughness: 0.1, metalness: 0.0, transparent: true, opacity: 0.55 });
      for (let wx = -1.2; wx <= 1.2; wx += 1.2) {
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.06), winMat);
        win.position.set(px + wx, H * 0.6, pz + D / 2 + 0.01);
        this.rootGroup.add(win);
      }

      const apronMat = new THREE.MeshStandardMaterial({ color: 0xc4cdd6, roughness: 0.95 });
      const apron = new THREE.Mesh(new THREE.BoxGeometry(W + 1.5, 0.04, 2.2), apronMat);
      apron.position.set(px, 0.02, pz + D / 2 + 1.1);
      apron.receiveShadow = true;
      this.rootGroup.add(apron);

      const clickMesh = new THREE.Mesh(
        new THREE.BoxGeometry(W + 0.4, H + 1.2, D + 0.4),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      clickMesh.position.set(px, H / 2, pz);
      this.rootGroup.add(clickMesh);
      this.clickables.push({ mesh: clickMesh, data: room, entityType: 'room' });

      this.addLabel(room.name || room.code || `Salle ${i + 1}`, px, H + 1.55, pz, this.c3ToHex(statusColor));
      if (room.capacity_units > 0) {
        this.addLabel(`${Math.round(fill * 100)}%`, px, -0.4, pz, this.c3ToHex(statusColor), 0.6);
      }
    });
  }

  /* ══════════════════════════════════════════════════════════
     SALLE — Plan d'atelier réaliste
  ══════════════════════════════════════════════════════════ */
  private buildRoomScene() {
    const total = this.roomCabinets.length + this.roomLocations.length;
    if (!total) return;

    const cols = Math.max(3, Math.ceil(Math.sqrt(total * 1.4)));
    const GAP = 2.4;
    const startX = -((cols - 1) * GAP) / 2;
    const rowCount = Math.ceil(total / cols);
    const startZ = -((rowCount - 1) * GAP) / 2;

    const floorMat = new THREE.MeshStandardMaterial({ color: 0xbec5cf, roughness: 0.9 });
    const floorW = cols * GAP + 5;
    const floorD = rowCount * GAP + 5;
    const floor = new THREE.Mesh(new THREE.BoxGeometry(floorW, 0.08, floorD), floorMat);
    floor.position.set(0, -0.04, 0);
    floor.receiveShadow = true;
    this.rootGroup.add(floor);

    const wallMat = new THREE.MeshStandardMaterial({ color: 0xd9dde6, roughness: 0.9, side: THREE.BackSide });
    const wallGeom = new THREE.BoxGeometry(floorW + 0.2, 7, floorD + 0.2);
    const walls = new THREE.Mesh(wallGeom, wallMat);
    walls.position.set(0, 3.4, 0);
    walls.receiveShadow = true;
    this.rootGroup.add(walls);

    const neonMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff5e0, emissiveIntensity: 5 });
    const neonCount = Math.min(cols, 6);
    for (let i = 0; i < neonCount; i++) {
      const lx = startX + i * (floorW / Math.max(neonCount - 1, 1)) - floorW / 2 + floorW / neonCount;
      const neon = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, floorD * 0.7), neonMat);
      neon.position.set(lx, 6.5, 0);
      this.rootGroup.add(neon);
      const light = new THREE.PointLight(0xfff8e7, 1.2, 9);
      light.position.set(lx, 6.2, 0);
      this.rootGroup.add(light);
    }

    const linesMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.8 });
    for (let i = 0; i < rowCount + 1; i++) {
      const lineZ = startZ - GAP / 2 + i * GAP;
      const line = new THREE.Mesh(new THREE.BoxGeometry(floorW, 0.01, 0.06), linesMat);
      line.position.set(0, 0.005, lineZ);
      this.rootGroup.add(line);
    }

    let idx = 0;
    this.roomCabinets.forEach(c => {
      const col = idx % cols; const row = Math.floor(idx / cols);
      this.buildRealisticCabinet(startX + col * GAP, startZ + row * GAP, c);
      idx++;
    });
    this.roomLocations.forEach(l => {
      const col = idx % cols; const row = Math.floor(idx / cols);
      this.buildRealisticLocation(startX + col * GAP, startZ + row * GAP, l);
      idx++;
    });
  }

  /* ══════════════════════════════════════════════════════════
     ARMOIRE réaliste — Métal industriel (vue salle)
  ══════════════════════════════════════════════════════════ */
  private buildRealisticCabinet(px: number, pz: number, data: any) {
    const W = 1.4, D = 0.85, H = 4.8;
    const fill = data.capacity_units > 0 ? Math.min((data.current_units || 0) / data.capacity_units, 1) : 0;
    const statusColor = fill >= 0.9 ? new THREE.Color(0xef4444) : fill >= 0.7 ? new THREE.Color(0xf59e0b) : new THREE.Color(0x3b82f6);
    const N_SHELVES = 5;

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.35, metalness: 0.25 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), bodyMat);
    body.position.set(px, H / 2, pz);
    body.castShadow = true; body.receiveShadow = true;
    this.rootGroup.add(body);

    const backMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.5, metalness: 0.1 });
    const back = new THREE.Mesh(new THREE.BoxGeometry(W - 0.02, H - 0.02, 0.025), backMat);
    back.position.set(px, H / 2, pz - D / 2 + 0.015);
    this.rootGroup.add(back);

    const sideMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.4, metalness: 0.3 });
    [-W / 2, W / 2].forEach(sx => {
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.04, H, D), sideMat);
      side.position.set(px + sx, H / 2, pz);
      this.rootGroup.add(side);
    });

    const shelfMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.5, metalness: 0.45 });
    const lipMat  = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.5, metalness: 0.5 });
    for (let s = 0; s <= N_SHELVES; s++) {
      const sy = s * (H / N_SHELVES);
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(W - 0.06, 0.04, D - 0.05), shelfMat);
      shelf.position.set(px, sy + 0.02, pz);
      shelf.castShadow = true;
      this.rootGroup.add(shelf);
      const lip = new THREE.Mesh(new THREE.BoxGeometry(W - 0.06, 0.06, 0.025), lipMat);
      lip.position.set(px, sy + 0.05, pz + D / 2 - 0.035);
      this.rootGroup.add(lip);
    }

    const doorMat = new THREE.MeshStandardMaterial({ color: 0xe8eef6, roughness: 0.3, metalness: 0.2 });
    [-W / 4, W / 4].forEach((dx, di) => {
      const door = new THREE.Mesh(new THREE.BoxGeometry(W / 2 - 0.03, H - 0.06, 0.025), doorMat);
      door.position.set(px + dx, H / 2, pz + D / 2 + 0.01);
      this.rootGroup.add(door);

      const glassMat = new THREE.MeshStandardMaterial({
        color: 0xbfdbfe, roughness: 0.05, metalness: 0,
        transparent: true, opacity: 0.25
      });
      const glass = new THREE.Mesh(new THREE.BoxGeometry(W / 2 - 0.12, H * 0.55, 0.012), glassMat);
      glass.position.set(px + dx, H * 0.58, pz + D / 2 + 0.02);
      this.rootGroup.add(glass);

      const handleMat = new THREE.MeshStandardMaterial({ color: 0xc0ccd8, metalness: 0.9, roughness: 0.15 });
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.26, 10), handleMat);
      handle.rotation.z = Math.PI / 2;
      handle.position.set(px + (di === 0 ? W / 4 - 0.08 : -W / 4 + 0.08), H * 0.52, pz + D / 2 + 0.025);
      this.rootGroup.add(handle);
    });

    const ledMat = new THREE.MeshStandardMaterial({
      color: statusColor, emissive: statusColor, emissiveIntensity: 1.8
    });
    const ledH = Math.max((H - 0.1) * fill, 0.02);
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.04, ledH, 0.04), ledMat);
    led.position.set(px + W / 2 + 0.03, ledH / 2, pz);
    this.rootGroup.add(led);

    const plateMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.6 });
    const plate = new THREE.Mesh(new THREE.BoxGeometry(W * 0.55, 0.18, 0.025), plateMat);
    plate.position.set(px, 0.25, pz + D / 2 + 0.02);
    this.rootGroup.add(plate);

    const footMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.6 });
    [-W / 2 + 0.1, W / 2 - 0.1].forEach(fx => {
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.055, 0.06, 6), footMat);
      foot.position.set(px + fx, 0.03, pz);
      this.rootGroup.add(foot);
    });

    const clickMesh = new THREE.Mesh(
      new THREE.BoxGeometry(W + 0.2, H, D + 0.15),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    clickMesh.position.set(px, H / 2, pz);
    this.rootGroup.add(clickMesh);
    this.clickables.push({ mesh: clickMesh, data, entityType: 'cabinet' });

    this.addLabel(data.name || data.code || '—', px, H + 0.55, pz, this.c3ToHex(statusColor), 0.72);
  }

  /* ══════════════════════════════════════════════════════════
     EMPLACEMENT réaliste — Palette + Rack (vue salle)
  ══════════════════════════════════════════════════════════ */
  private buildRealisticLocation(px: number, pz: number, data: any) {
    const W = 1.8, D = 1.5;
    const fill = data.capacity_units > 0 ? Math.min((data.current_units || 0) / data.capacity_units, 1) : 0;
    const statusColor = fill >= 0.9 ? new THREE.Color(0xef4444) : fill >= 0.7 ? new THREE.Color(0xf59e0b) : new THREE.Color(0x22c55e);

    const woodMat  = new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.92, metalness: 0 });
    const woodDark = new THREE.MeshStandardMaterial({ color: 0x6b4f0f, roughness: 0.95, metalness: 0 });

    const palTop = new THREE.Mesh(new THREE.BoxGeometry(W, 0.06, D), woodMat);
    palTop.position.set(px, 0.12, pz);
    palTop.receiveShadow = true;
    this.rootGroup.add(palTop);

    const plankCount = 4;
    for (let pi = 0; pi < plankCount; pi++) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, D), woodDark);
      plank.position.set(px - W / 2 + 0.12 + pi * (W - 0.24) / (plankCount - 1), 0.16, pz);
      this.rootGroup.add(plank);
    }

    for (let bx = -1; bx <= 1; bx++) {
      const block = new THREE.Mesh(new THREE.BoxGeometry(W, 0.1, 0.12), woodDark);
      block.position.set(px, 0.05, pz + bx * D / 2.4);
      this.rootGroup.add(block);
    }

    const frameMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.4, metalness: 0.5 });
    const postH = 0.5;
    [[-W / 2, -D / 2], [W / 2, -D / 2], [-W / 2, D / 2], [W / 2, D / 2]].forEach(([fx, fz]) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, postH, 0.06), frameMat);
      post.position.set(px + fx, postH / 2, pz + fz);
      this.rootGroup.add(post);
    });
    const crossMat = new THREE.MeshStandardMaterial({ color: statusColor, roughness: 0.4, metalness: 0.3, emissive: statusColor, emissiveIntensity: 0.15 });
    [[W, 0.04, 0.04, pz - D / 2], [W, 0.04, 0.04, pz + D / 2]].forEach(([cw, ch, cd, cz]) => {
      const cross = new THREE.Mesh(new THREE.BoxGeometry(cw as number, ch as number, cd as number), crossMat);
      cross.position.set(px, postH, cz as number);
      this.rootGroup.add(cross);
    });
    [[0.04, 0.04, D, px - W / 2], [0.04, 0.04, D, px + W / 2]].forEach(([cw, ch, cd, cx]) => {
      const cross = new THREE.Mesh(new THREE.BoxGeometry(cw as number, ch as number, cd as number), crossMat);
      cross.position.set(cx as number, postH, pz);
      this.rootGroup.add(cross);
    });

    const markMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.9 });
    const markT = 0.06, markH = 0.01;
    [[W + markT * 2, markH, markT, px, 0.001, pz + D / 2],
     [W + markT * 2, markH, markT, px, 0.001, pz - D / 2],
     [markT, markH, D,         px + W / 2, 0.001, pz],
     [markT, markH, D,         px - W / 2, 0.001, pz]
    ].forEach(([mw, mh, md, mx, my, mz]) => {
      const mark = new THREE.Mesh(new THREE.BoxGeometry(mw as number, mh as number, md as number), markMat);
      mark.position.set(mx as number, my as number, mz as number);
      this.rootGroup.add(mark);
    });

    const clickMesh = new THREE.Mesh(
      new THREE.BoxGeometry(W, 0.9, D),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    clickMesh.position.set(px, 0.45, pz);
    this.rootGroup.add(clickMesh);
    this.clickables.push({ mesh: clickMesh, data, entityType: 'location' });

    this.addLabel(data.name || data.code || '—', px, 0.75, pz, this.c3ToHex(statusColor), 0.62);
  }

  /* ══════════════════════════════════════════════════════════
     ARMOIRE vue détail — Produits sur étagères + PORTES CLIQUABLES
  ══════════════════════════════════════════════════════════ */
  private buildCabinetScene() {
    this.percentage = this.capacityUnits > 0 ? (this.currentUnits / this.capacityUnits) * 100 : 0;

    const N_SHELVES = 5;
    const CAP_PER_SHELF = Math.ceil((this.capacityUnits || 20) / N_SHELVES);
    const cols = Math.max(2, Math.ceil(Math.sqrt(CAP_PER_SHELF * 0.6)));
    const rows = Math.ceil(CAP_PER_SHELF / cols);
    const BW = 0.44, BD = 0.36, GX = 0.08, GZ = 0.08, PAD = 0.14;
    const W = cols * (BW + GX) + PAD * 2;
    const D = rows * (BD + GZ) + PAD * 2;
    const SHELF_H = 1.36;
    const CAB_H = N_SHELVES * SHELF_H + PAD;
    const T = 0.055;

    const statusColor = this.percentage >= 90
      ? new THREE.Color(0xef4444)
      : this.percentage >= 70 ? new THREE.Color(0xf59e0b) : new THREE.Color(0x3b82f6);

    // ── Structure corps ──
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.35, metalness: 0.2 });
    const sideMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.4, metalness: 0.25 });

    [[T, CAB_H, D,      -W/2,    CAB_H/2, 0],
     [T, CAB_H, D,       W/2,    CAB_H/2, 0],
     [W, CAB_H, T,       0,      CAB_H/2, -D/2],
     [W+T*2, T, D,       0,      CAB_H,   0],
     [W+T*2, T, D,       0,      0,        0],
    ].forEach(([pw, ph, pd, ppx, ppy, ppz], idx) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(pw, ph, pd), idx < 2 ? sideMat : bodyMat);
      m.position.set(ppx, ppy, ppz);
      m.castShadow = true; m.receiveShadow = true;
      this.rootGroup.add(m);
    });

    // ── Étagères ──
    const shelfMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.5, metalness: 0.45 });
    for (let s = 0; s <= N_SHELVES; s++) {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(W - T * 2 - 0.01, 0.04, D - T - 0.01), shelfMat);
      shelf.position.set(0, s * SHELF_H + PAD / 2, 0);
      this.rootGroup.add(shelf);
    }

    // ── LED statut barre supérieure ──
    const ledMat = new THREE.MeshStandardMaterial({ color: statusColor, emissive: statusColor, emissiveIntensity: 1.5 });
    const topBar = new THREE.Mesh(new THREE.BoxGeometry(W + T * 2 + 0.04, 0.05, D + 0.04), ledMat);
    topBar.position.set(0, CAB_H + 0.02, 0);
    this.rootGroup.add(topBar);

    const topLight = new THREE.PointLight(statusColor, 0.6, 8);
    topLight.position.set(0, CAB_H + 0.3, 0);
    this.rootGroup.add(topLight);

    // ── Lumière intérieure (s'allume à l'ouverture) ──
    this.interiorLight = new THREE.PointLight(0xfff5e0, 0, 6);
    this.interiorLight.position.set(0, CAB_H * 0.5, 0);
    this.rootGroup.add(this.interiorLight);

    // ── PORTES VITRÉES CLIQUABLES avec pivots sur charnières ──
    const doorMat  = new THREE.MeshStandardMaterial({ color: 0xe8eef6, roughness: 0.3, metalness: 0.2 });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0xbfdbfe, roughness: 0.05, metalness: 0,
      transparent: true, opacity: 0.22
    });

    [-W/4, W/4].forEach((dx, di) => {
      // Pivot positionné sur la charnière (bord extérieur de chaque battant)
      const hingeX = di === 0 ? -(W / 2 - T) : (W / 2 - T);
      const pivot = new THREE.Group();
      pivot.position.set(hingeX, CAB_H / 2, D / 2 + T / 2);
      this.rootGroup.add(pivot);

      // Stocker les références de pivot pour l'animation
      if (di === 0) this.doorPivotLeft = pivot;
      else          this.doorPivotRight = pivot;

      // Offset local du centre de la porte par rapport à la charnière
      const localDx = dx - hingeX;

      // Porte
      const door = new THREE.Mesh(new THREE.BoxGeometry(W / 2 - 0.02, CAB_H - 0.04, T), doorMat);
      door.position.set(localDx, 0, 0);
      pivot.add(door);

      // Vitre centrale
      const glass = new THREE.Mesh(new THREE.BoxGeometry(W / 2 - 0.14, CAB_H * 0.72, T + 0.01), glassMat);
      glass.position.set(localDx, CAB_H * 0.05, 0.001);
      pivot.add(glass);

      // Poignée (côté intérieur)
      const handleMat = new THREE.MeshStandardMaterial({ color: 0xb0bcc8, metalness: 0.9, roughness: 0.12 });
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.24, 10), handleMat);
      handle.rotation.z = Math.PI / 2;
      const handleOffX = di === 0 ? localDx + W / 4 - 0.09 : localDx - W / 4 + 0.09;
      handle.position.set(handleOffX, CAB_H * 0.02, T + 0.02);
      pivot.add(handle);

      // Mesh clickable invisible sur la porte
      const clickDoor = new THREE.Mesh(
        new THREE.BoxGeometry(W / 2 - 0.01, CAB_H - 0.02, T + 0.08),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      clickDoor.position.set(localDx, 0, 0);
      pivot.add(clickDoor);

      // Enregistrement comme entité cliquable "door"
      this.clickables.push({ mesh: clickDoor, data: { side: di }, entityType: 'door' });
    });

    // ── Produits sur les étagères ──
    this.placeCabinetProducts(N_SHELVES, SHELF_H, PAD, cols, rows, BW, BD, GX, GZ);
    this.addLabel(this.title, 0, CAB_H + 0.85, 0, this.c3ToHex(statusColor));
  }

  private placeCabinetProducts(N: number, SHELF_H: number, PAD: number, cols: number, rows: number, BW: number, BD: number, GX: number, GZ: number) {
    const startX = -(cols * (BW + GX)) / 2 + BW / 2 + 0.03;
    const startZ = -(rows * (BD + GZ)) / 2 + BD / 2 + 0.03;

    const list: any[] = [];
    for (const p of this.products) {
      const q = p.local_quantity || p.stock_quantity || 1;
      for (let i = 0; i < Math.min(q, 20); i++) list.push(p);
    }

    list.forEach((product, idx) => {
      if (this.capacityUnits > 0 && idx >= this.capacityUnits) return;
      const shelf = Math.floor(idx / (cols * rows));
      if (shelf >= N) return;
      const pos = idx % (cols * rows);
      const r = Math.floor(pos / cols);
      const c = pos % cols;
      const y = PAD / 2 + shelf * SHELF_H + 0.06;
      const colorHex = this.toHex(product.title || String(product.id));
      const color = parseInt(colorHex, 16);
      const pColor = new THREE.Color(color);
      const BOX_H = 0.32 + Math.random() * 0.22;

      const mat = new THREE.MeshStandardMaterial({
        color: pColor, roughness: 0.65, metalness: 0.0,
        emissive: pColor, emissiveIntensity: 0.04,
      });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(BW * 0.88, BOX_H, BD * 0.88), mat);
      const ppx = startX + c * (BW + GX);
      const ppz = startZ + r * (BD + GZ);
      mesh.position.set(ppx, y + BOX_H / 2, ppz);
      mesh.rotation.y = (Math.random() - 0.5) * 0.05;
      mesh.castShadow = true;

      const labelColor = new THREE.Color().setHSL(pColor.getHSL({ h: 0, s: 0, l: 0 }).h, 0.5, 0.82);
      const labelMat = new THREE.MeshStandardMaterial({ color: labelColor, roughness: 0.7 });
      const label = new THREE.Mesh(new THREE.BoxGeometry(BW * 0.86, 0.05, 0.008), labelMat);
      label.position.set(0, BOX_H * 0.25, BD * 0.44);
      mesh.add(label);

      this.floatingMeshes.push({ mesh, baseY: mesh.position.y, speed: 0.5 + Math.random() * 0.5, amp: 0.01, phase: Math.random() * Math.PI * 2 });
      this.rootGroup.add(mesh);
      this.clickables.push({ mesh, data: product, entityType: 'product' });
    });
  }

  /* ══════════════════════════════════════════════════════════
     EMPLACEMENT vue détail — Produits sur palette
  ══════════════════════════════════════════════════════════ */
  private buildLocationScene() {
    this.percentage = this.capacityUnits > 0 ? (this.currentUnits / this.capacityUnits) * 100 : 0;

    const cap = Math.max(this.capacityUnits, 6);
    const cols = Math.ceil(Math.sqrt(cap * 1.2));
    const rows = Math.ceil(cap / cols);
    const BW = 0.88, BD = 0.72, GX = 0.28, GZ = 0.22;
    const W = cols * (BW + GX) + 0.4;
    const D = rows * (BD + GZ) + 0.4;

    const statusColor = this.percentage >= 90
      ? new THREE.Color(0xef4444)
      : this.percentage >= 70 ? new THREE.Color(0xf59e0b) : new THREE.Color(0x22c55e);

    const woodMat  = new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.92 });
    const woodDark = new THREE.MeshStandardMaterial({ color: 0x6b4f0f, roughness: 0.95 });
    const palTop = new THREE.Mesh(new THREE.BoxGeometry(W + 0.2, 0.06, D + 0.2), woodMat);
    palTop.position.set(0, 0.09, 0);
    palTop.receiveShadow = true;
    this.rootGroup.add(palTop);
    const planks = Math.max(3, Math.floor((W + 0.2) / 0.72));
    for (let pi = 0; pi < planks; pi++) {
      const plk = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.06, D + 0.2), woodDark);
      plk.position.set(-(W + 0.2) / 2 + 0.1 + pi * ((W + 0.2 - 0.2) / (planks - 1)), 0.13, 0);
      this.rootGroup.add(plk);
    }
    for (let bz = -1; bz <= 1; bz++) {
      const blk = new THREE.Mesh(new THREE.BoxGeometry(W + 0.2, 0.09, 0.1), woodDark);
      blk.position.set(0, 0.045, bz * (D + 0.2) / 2.3);
      this.rootGroup.add(blk);
    }

    const frameMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.35, metalness: 0.55 });
    const postH = 0.55;
    [[-W/2 - 0.1, -D/2 - 0.1], [W/2 + 0.1, -D/2 - 0.1],
     [-W/2 - 0.1,  D/2 + 0.1], [W/2 + 0.1,  D/2 + 0.1]].forEach(([fpx, fpz]) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, postH, 0.07), frameMat);
      post.position.set(fpx, postH / 2, fpz);
      this.rootGroup.add(post);
    });
    const crossMat = new THREE.MeshStandardMaterial({
      color: statusColor, roughness: 0.4, metalness: 0.3,
      emissive: statusColor, emissiveIntensity: 0.12
    });
    [[W + 0.24, 0.04, 0.04, 0, postH, -D/2 - 0.1],
     [W + 0.24, 0.04, 0.04, 0, postH,  D/2 + 0.1],
     [0.04, 0.04, D + 0.24, -W/2 - 0.1, postH, 0],
     [0.04, 0.04, D + 0.24,  W/2 + 0.1, postH, 0]
    ].forEach(([cw, ch, cd, cx, cy, cz]) => {
      const c = new THREE.Mesh(new THREE.BoxGeometry(cw as number, ch as number, cd as number), crossMat);
      c.position.set(cx as number, cy as number, cz as number);
      this.rootGroup.add(c);
    });

    const markMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.9 });
    const mt = 0.06;
    [[W + 0.4 + mt * 2, 0.008, mt, 0, 0.001, D/2 + 0.2 + mt/2],
     [W + 0.4 + mt * 2, 0.008, mt, 0, 0.001, -D/2 - 0.2 - mt/2],
     [mt, 0.008, D + 0.4, W/2 + 0.2 + mt/2, 0.001, 0],
     [mt, 0.008, D + 0.4, -W/2 - 0.2 - mt/2, 0.001, 0]
    ].forEach(([mw, mh, md, mx, my, mz]) => {
      const mark = new THREE.Mesh(new THREE.BoxGeometry(mw as number, mh as number, md as number), markMat);
      mark.position.set(mx as number, my as number, mz as number);
      this.rootGroup.add(mark);
    });

    this.placeLocationProducts(cols, rows, BW, BD, GX, GZ);
    this.addLabel(this.title, 0, 2.2, 0, this.c3ToHex(statusColor));
  }

  private placeLocationProducts(cols: number, rows: number, BW: number, BD: number, GX: number, GZ: number) {
    const startX = -(cols * (BW + GX)) / 2 + BW / 2;
    const startZ = -(rows * (BD + GZ)) / 2 + BD / 2;
    const list: any[] = [];
    for (const p of this.products) {
      const q = p.local_quantity || p.stock_quantity || 1;
      for (let i = 0; i < Math.min(q, 15); i++) list.push(p);
    }
    list.forEach((product, idx) => {
      if (this.capacityUnits > 0 && idx >= this.capacityUnits) return;

      const layer = Math.floor(idx / (cols * rows));
      const r = Math.floor(idx / cols);
      const c = idx % cols;
      if (r >= rows) return;
      const colorHex = this.toHex(product.title || String(product.id));
      const color = parseInt(colorHex, 16);
      const pColor = new THREE.Color(color);
      const BOX_H = 0.44 + Math.random() * 0.25;
      const mat = new THREE.MeshStandardMaterial({ color: pColor, roughness: 0.55, metalness: 0.05 });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(BW * 0.84, BOX_H, BD * 0.84), mat);
      const ppx = startX + c * (BW + GX);
      const ppz = startZ + r * (BD + GZ);
      mesh.position.set(ppx, 0.18 + BOX_H / 2, ppz);
      mesh.rotation.y = (Math.random() - 0.5) * 0.08;
      mesh.castShadow = true;
      this.floatingMeshes.push({ mesh, baseY: mesh.position.y, speed: 0.4 + Math.random() * 0.4, amp: 0.012, phase: Math.random() * Math.PI * 2 });
      this.rootGroup.add(mesh);
      this.clickables.push({ mesh, data: product, entityType: 'product' });
    });
  }

  /* ── Sprite label propre ─────────────────────────────────────── */
  private addLabel(text: string, x: number, y: number, z: number, hexColor = '3b82f6', scale = 1.0) {
    const canvas = document.createElement('canvas');
    canvas.width = 320; canvas.height = 72;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 320, 72);

    const rawHex = hexColor.replace(/^#/, '');
    const color = `#${rawHex}`;

    ctx.fillStyle = 'rgba(255,255,255,0.94)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(3, 3, 314, 66, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(3, 3, 314, 6, [10, 10, 0, 0]);
    ctx.fill();

    ctx.font = '600 24px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#1e293b';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const maxLen = 22;
    const label = text && text.length > maxLen ? text.slice(0, maxLen - 1) + '…' : (text || '—');
    ctx.fillText(label, 160, 42);

    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(x, y, z);
    sprite.scale.set(3.2 * scale, 0.72 * scale, 1);
    this.rootGroup.add(sprite);
  }

  /* ── Helpers couleur ─────────────────────────────────────────── */
  private c3ToHex(c: THREE.Color): string { return c.getHexString(); }

  toHex(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    const palettes = [
      [0.58, 0.65, 0.52],
      [0.12, 0.62, 0.5],
      [0.08, 0.72, 0.55],
      [0.02, 0.78, 0.52],
      [0.72, 0.55, 0.48],
      [0.48, 0.6, 0.52],
      [0.55, 0.62, 0.48],
      [0.18, 0.55, 0.50],
    ];
    const idx = Math.abs(hash) % palettes.length;
    const [h, s, l] = palettes[idx];
    const { r, g, b } = this.hslToRgb(h, s, l);
    return r.toString(16).padStart(2, '0') + g.toString(16).padStart(2, '0') + b.toString(16).padStart(2, '0');
  }

  private hslToRgb(h: number, s: number, l: number) {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const f = (t: number) => {
      if (t < 0) t++; if (t > 1) t--;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    return { r: Math.round(f(h+1/3)*255), g: Math.round(f(h)*255), b: Math.round(f(h-1/3)*255) };
  }
}