import { Component, ElementRef, Input, OnDestroy, OnInit, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as THREE from 'three';
import { AdminStockService } from '../../services/admin-stock.service';

@Component({
  selector: 'app-storage-3d-viewer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="viewer-wrap">
      <!-- Canvas -->
      <div class="viewer-container" #viewerContainer
           (mousedown)="onMouseDown($event)"
           (mousemove)="onMouseMove($event)"
           (mouseup)="onMouseUp()"
           (mouseleave)="onMouseUp()"
           (wheel)="onWheel($event)"
           (click)="onCanvasClick($event)">
      </div>

      <!-- Hint -->
      <div class="hint-bar">🖱️ Glisser pour tourner · Molette pour zoomer · Clic sur un produit pour ses détails</div>

      <!-- Top-left stats -->
      <div class="overlay-stats" [class.warn]="percentage>=70 && percentage<90" [class.danger]="percentage>=90">
        <div class="overlay-title">{{ title }}</div>
        <div class="cap-row">
          <span class="cap-label">Capacité</span>
          <span class="cap-value" [class.c-green]="percentage<70" [class.c-yellow]="percentage>=70&&percentage<90" [class.c-red]="percentage>=90">
            {{ currentUnits }} / {{ capacityUnits }}
          </span>
        </div>
        <div class="cap-bar-wrap">
          <div class="cap-bar" [style.width]="percentage+'%'"
               [class.bar-green]="percentage<70"
               [class.bar-yellow]="percentage>=70&&percentage<90"
               [class.bar-red]="percentage>=90"></div>
        </div>
        <div class="cap-pct">{{ percentage | number:'1.0-0' }}% utilisé
          <span class="cap-alert" *ngIf="percentage>=90"> ⚠️ Plein!</span>
          <span class="cap-alert warn" *ngIf="percentage>=70&&percentage<90"> ⚡ Proche limite</span>
        </div>
      </div>

      <!-- Loading -->
      <div class="loading-overlay" *ngIf="isLoading">
        <div class="spinner"></div><span>Chargement...</span>
      </div>

      <!-- Legend -->
      <div class="legend-panel" *ngIf="!isLoading && uniqueProducts.length > 0">
        <div class="legend-title">📦 Produits</div>
        <div class="legend-list">
          <div class="legend-item" *ngFor="let p of uniqueProducts">
            <span class="legend-color" [style.background]="'#'+p.colorHex"></span>
            <span class="legend-name">{{ p.title }}</span>
            <span class="legend-qty">×{{ p.qty }}</span>
          </div>
        </div>
      </div>

      <!-- Empty -->
      <div class="empty-overlay" *ngIf="!isLoading && products.length===0">
        📭 Aucun produit stocké ici
      </div>

      <!-- Product detail popup -->
      <div class="product-popup" *ngIf="selectedProduct"
           [style.left]="popupX+'px'" [style.top]="popupY+'px'">
        <button class="popup-close" (click)="selectedProduct=null">✕</button>
        <div class="popup-title">{{ selectedProduct.title }}</div>
        <div class="popup-row"><span>Référence</span><span>{{ selectedProduct.reference || '—' }}</span></div>
        <div class="popup-row"><span>Quantité locale</span><span>{{ selectedProduct.local_quantity || selectedProduct.stock_quantity || 1 }}</span></div>
        <div class="popup-row" *ngIf="selectedProduct.category?.title"><span>Catégorie</span><span>{{ selectedProduct.category.title }}</span></div>
        <div class="popup-row" *ngIf="selectedProduct.expiration_date"><span>Expiration</span><span>{{ selectedProduct.expiration_date }}</span></div>
        <div class="popup-row" *ngIf="selectedProduct.batch_number"><span>Lot</span><span>{{ selectedProduct.batch_number }}</span></div>
      </div>
    </div>
  `,
  styles: [`
    .viewer-wrap { position: relative; font-family: 'Inter', sans-serif; user-select: none; }
    .viewer-container { width: 100%; height: 560px; border-radius: 14px; overflow: hidden; cursor: grab; }
    .viewer-container:active { cursor: grabbing; }
    .hint-bar { text-align: center; font-size: 11px; color: #94a3b8; padding: 6px 0 2px; }

    .overlay-stats {
      position: absolute; top: 14px; left: 14px;
      background: rgba(255,255,255,0.94); backdrop-filter: blur(10px);
      padding: 12px 16px; border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15); pointer-events: none; min-width: 190px;
      border-left: 4px solid #22c55e; transition: border-color .3s;
    }
    .overlay-stats.warn { border-left-color: #f59e0b; }
    .overlay-stats.danger { border-left-color: #ef4444; }
    .overlay-title { font-weight: 800; font-size: 14px; color: #1e293b; margin-bottom: 8px; }
    .cap-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
    .cap-label { font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase; }
    .cap-value { font-size: 13px; font-weight: 700; }
    .c-green { color: #16a34a; } .c-yellow { color: #d97706; } .c-red { color: #dc2626; }
    .cap-bar-wrap { background: #e2e8f0; border-radius: 4px; height: 7px; overflow: hidden; margin-bottom: 4px; }
    .cap-bar { height: 100%; border-radius: 4px; transition: width 0.6s; }
    .bar-green  { background: linear-gradient(90deg, #22c55e, #16a34a); }
    .bar-yellow { background: linear-gradient(90deg, #f59e0b, #d97706); }
    .bar-red    { background: linear-gradient(90deg, #ef4444, #dc2626); animation: pulse 1s infinite; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.7} }
    .cap-pct { font-size: 11px; color: #64748b; font-weight: 600; }
    .cap-alert { font-size: 11px; font-weight: 700; } .cap-alert.warn { color: #d97706; }

    .loading-overlay {
      position: absolute; inset: 0; display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 12px;
      background: rgba(13,27,42,0.6); color: white; font-size: 14px; font-weight: 500;
      border-radius: 14px;
    }
    .spinner { width: 36px; height: 36px; border: 3px solid rgba(255,255,255,.2); border-top-color: white; border-radius: 50%; animation: spin .8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .legend-panel {
      position: absolute; top: 14px; right: 14px;
      background: rgba(255,255,255,0.94); backdrop-filter: blur(10px);
      padding: 12px 14px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      max-height: 320px; overflow-y: auto; min-width: 160px; max-width: 210px;
    }
    .legend-title { font-size: 12px; font-weight: 800; color: #1e293b; text-transform: uppercase; margin-bottom: 8px; }
    .legend-item { display: flex; align-items: center; gap: 7px; padding: 4px 0; border-bottom: 1px solid #f1f5f9; }
    .legend-item:last-child { border: none; }
    .legend-color { width: 13px; height: 13px; border-radius: 3px; flex-shrink: 0; border: 1px solid rgba(0,0,0,.12); }
    .legend-name { font-size: 12px; color: #334155; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .legend-qty { font-size: 11px; font-weight: 700; color: #64748b; }

    .empty-overlay {
      position: absolute; bottom: 40px; left: 50%; transform: translateX(-50%);
      background: rgba(255,255,255,.88); backdrop-filter: blur(6px);
      padding: 8px 18px; border-radius: 20px; font-size: 13px; font-weight: 600; color: #64748b;
    }

    .product-popup {
      position: absolute; background: white; border-radius: 12px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.18); padding: 14px 16px;
      min-width: 200px; max-width: 250px; z-index: 20;
      border-top: 3px solid #3b82f6; animation: popIn .15s ease;
    }
    @keyframes popIn { from { opacity:0; transform: scale(.95); } to { opacity:1; transform: scale(1); } }
    .popup-close { position: absolute; top: 8px; right: 10px; background: none; border: none; cursor: pointer; font-size: 14px; color: #94a3b8; }
    .popup-title { font-weight: 800; font-size: 14px; color: #1e293b; margin-bottom: 10px; padding-right: 20px; }
    .popup-row { display: flex; justify-content: space-between; font-size: 12px; padding: 4px 0; border-bottom: 1px solid #f1f5f9; }
    .popup-row span:first-child { color: #64748b; font-weight: 600; }
    .popup-row span:last-child { color: #1e293b; font-weight: 700; }
  `]
})
export class Storage3dViewerComponent implements OnInit, OnDestroy {
  @ViewChild('viewerContainer', { static: true }) viewerContainer!: ElementRef;

  @Input() title: string = 'Stockage';
  @Input() capacityUnits: number = 100;
  @Input() currentUnits: number = 0;
  @Input() storageId: number | null = null;
  @Input() type: 'location' | 'cabinet' = 'location';

  percentage = 0;
  products: any[] = [];
  uniqueProducts: { title: string; qty: number; colorHex: string }[] = [];
  isLoading = false;
  selectedProduct: any = null;
  popupX = 0; popupY = 0;

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private animationId: number | null = null;
  private group!: THREE.Group;
  private clickableMeshes: { mesh: THREE.Mesh; product: any }[] = [];

  // Orbit state
  private isDragging = false;
  private prevMouse = { x: 0, y: 0 };
  private spherical = { theta: 0.4, phi: 1.1, radius: 9 };

  constructor(private stockService: AdminStockService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.percentage = this.capacityUnits > 0 ? (this.currentUnits / this.capacityUnits) * 100 : 0;
    this.initScene();
    if (this.storageId) { this.fetchProducts(); } else { this.buildScene(); }
  }

  ngOnDestroy() {
    if (this.animationId !== null) cancelAnimationFrame(this.animationId);
    if (this.renderer) this.renderer.dispose();
  }

  /* ── Mouse orbit ── */
  onMouseDown(e: MouseEvent) { this.isDragging = true; this.prevMouse = { x: e.clientX, y: e.clientY }; }
  onMouseUp() { this.isDragging = false; }
  onMouseMove(e: MouseEvent) {
    if (!this.isDragging) return;
    const dx = e.clientX - this.prevMouse.x;
    const dy = e.clientY - this.prevMouse.y;
    this.spherical.theta -= dx * 0.008;
    this.spherical.phi = Math.max(0.2, Math.min(Math.PI - 0.2, this.spherical.phi + dy * 0.008));
    this.prevMouse = { x: e.clientX, y: e.clientY };
    this.updateCamera();
  }
  onWheel(e: WheelEvent) {
    e.preventDefault();
    this.spherical.radius = Math.max(3, Math.min(20, this.spherical.radius + e.deltaY * 0.01));
    this.updateCamera();
  }
  private updateCamera() {
    const { theta, phi, radius } = this.spherical;
    this.camera.position.set(
      radius * Math.sin(phi) * Math.sin(theta),
      radius * Math.cos(phi) + 2,
      radius * Math.sin(phi) * Math.cos(theta)
    );
    this.camera.lookAt(0, this.type === 'cabinet' ? 3 : 1, 0);
  }

  /* ── Click on product ── */
  onCanvasClick(e: MouseEvent) {
    if (!this.renderer) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, this.camera);
    const meshes = this.clickableMeshes.map(c => c.mesh);
    const hits = raycaster.intersectObjects(meshes);
    if (hits.length > 0) {
      const hit = hits[0].object as THREE.Mesh;
      const found = this.clickableMeshes.find(c => c.mesh === hit);
      if (found) {
        this.selectedProduct = found.product;
        this.popupX = e.offsetX + 12;
        this.popupY = e.offsetY + 12;
        this.cdr.detectChanges();
      }
    } else {
      this.selectedProduct = null;
    }
  }

  /* ── Scene init ── */
  private initScene() {
    const container = this.viewerContainer.nativeElement;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0d1b2a);
    this.scene.fog = new THREE.FogExp2(0x0d1b2a, 0.04);

    this.camera = new THREE.PerspectiveCamera(50, container.clientWidth / (container.clientHeight || 560), 0.1, 200);
    this.updateCamera();

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight || 560);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    container.appendChild(this.renderer.domElement);

    // Lights
    this.scene.add(new THREE.AmbientLight(0x557799, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(6, 12, 8); key.castShadow = true; this.scene.add(key);
    const fill = new THREE.DirectionalLight(0x6699cc, 0.5);
    fill.position.set(-6, 6, -4); this.scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffddaa, 0.3);
    rim.position.set(0, -3, 6); this.scene.add(rim);

    // Grid floor
    this.scene.add(new THREE.GridHelper(30, 30, 0x1e3a5f, 0x1e3a5f));

    this.animate();
  }

  private animate() {
    this.animationId = requestAnimationFrame(() => this.animate());
    this.renderer.render(this.scene, this.camera);
  }

  /* ── Fetch & build ── */
  private fetchProducts() {
    this.isLoading = true;
    const req$ = this.type === 'cabinet'
      ? this.stockService.getProductsByCabinet(this.storageId as number)
      : this.stockService.getProductsByLocation(this.storageId as number);
    req$.subscribe({
      next: (res: any) => {
        this.products = res.data || res || [];
        const map: { [id: number]: any } = {};
        for (const p of this.products) {
          const id = p.id; const q = p.local_quantity || p.stock_quantity || 1;
          if (map[id]) map[id].qty += q;
          else map[id] = { title: p.title || 'Produit', qty: q, colorHex: this.toHex(p.title || String(id)) };
        }
        this.uniqueProducts = Object.values(map);
        this.isLoading = false;
        this.buildScene();
        this.cdr.detectChanges();
      },
      error: () => { this.isLoading = false; this.buildScene(); this.cdr.detectChanges(); }
    });
  }

  private buildScene() {
    if (this.group) this.scene.remove(this.group);
    this.clickableMeshes = [];
    this.group = new THREE.Group();
    this.scene.add(this.group);

    // Frame color by capacity
    let frameColor = 0x607d8b;
    if (this.percentage >= 90) frameColor = 0xc0392b;
    else if (this.percentage >= 70) frameColor = 0xe67e22;

    const frameMat = new THREE.MeshStandardMaterial({ color: frameColor, roughness: 0.5, metalness: 0.6 });
    const shelfMat = new THREE.MeshStandardMaterial({ color: 0x90a4ae, roughness: 0.8 });

    if (this.type === 'cabinet') this.buildCabinet(frameMat, shelfMat);
    else this.buildFloorZone();

    this.placeProducts();
  }

  /* ── Cabinet: tall wardrobe with 5 shelves ── */
  private buildCabinet(frame: THREE.Material, shelf: THREE.Material) {
    // Calculate dimensions based on capacity
    // Target: exactly capacityUnits slots
    const N = 5; // 5 shelves
    const targetPerShelf = Math.ceil(this.capacityUnits / N);
    const cols = Math.ceil(Math.sqrt(targetPerShelf * (2.2/5))); // Try to keep ratio
    const rows = Math.ceil(targetPerShelf / cols);

    const BOX_W = 0.42, BOX_D = 0.38, GAP = 0.06, T = 0.12;
    const W = cols * (BOX_W + GAP) + T * 2;
    const D = rows * (BOX_D + GAP) + T * 2;
    const H = 8; // Keep height fixed at 8m for realism

    const box = (w: number, h: number, d: number, mat: THREE.Material) =>
      new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);

    const left = box(T, H, D, frame); left.position.set(-W/2, H/2, 0); this.group.add(left);
    const right = box(T, H, D, frame); right.position.set(W/2, H/2, 0); this.group.add(right);
    const back = box(W, H, T, frame); back.position.set(0, H/2, -D/2); this.group.add(back);
    const top = box(W + T*2, T, D, frame); top.position.set(0, H, 0); this.group.add(top);
    const base = box(W + T*2, T, D, frame); base.position.set(0, 0, 0); this.group.add(base);

    const shH = H / N;
    for (let i = 0; i < N; i++) {
      const s = box(W - T, T, D - T, shelf);
      s.position.set(0, i * shH + T/2, 0);
      this.group.add(s);
    }

    // Glow edge if near/over capacity
    if (this.percentage >= 70) {
      const glowColor = this.percentage >= 90 ? 0xff3333 : 0xff9900;
      const gMat = new THREE.MeshBasicMaterial({ color: glowColor, transparent: true, opacity: 0.5 });
      const gLeft = new THREE.Mesh(new THREE.BoxGeometry(T*0.5, H, D), gMat); gLeft.position.set(-W/2, H/2, 0);
      const gRight = new THREE.Mesh(new THREE.BoxGeometry(T*0.5, H, D), gMat); gRight.position.set(W/2, H/2, 0);
      this.group.add(gLeft, gRight);
    }
  }

  /* ── Location: floor zone for large items (chairs, boxes, etc.) ── */
  private buildFloorZone() {
    // Calculate dimensions based on capacity
    const BOX_W = 1.0, BOX_D = 0.85, GAP = 0.35, T = 0.08;
    const cols = Math.ceil(Math.sqrt(this.capacityUnits * (8/6)));
    const rows = Math.ceil(this.capacityUnits / cols);

    const W = cols * (BOX_W + GAP) + T * 2;
    const D = rows * (BOX_D + GAP) + T * 2;

    const borderColor = this.percentage >= 90 ? 0xef4444 : this.percentage >= 70 ? 0xf59e0b : 0x22c55e;
    const borderMat = new THREE.MeshStandardMaterial({ color: borderColor, roughness: 0.4, metalness: 0.3 });
    const floorMat  = new THREE.MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.9, transparent: true, opacity: 0.5 });

    // Floor tile
    const floor = new THREE.Mesh(new THREE.BoxGeometry(W, T, D), floorMat);
    floor.position.set(0, 0, 0);
    this.group.add(floor);

    // Border lines (4 sides, colored by capacity)
    const borderH = 0.18;
    const front = new THREE.Mesh(new THREE.BoxGeometry(W + T*2, borderH, T), borderMat); front.position.set(0, borderH/2, D/2); this.group.add(front);
    const back  = new THREE.Mesh(new THREE.BoxGeometry(W + T*2, borderH, T), borderMat); back.position.set(0, borderH/2, -D/2); this.group.add(back);
    const left  = new THREE.Mesh(new THREE.BoxGeometry(T, borderH, D), borderMat); left.position.set(-W/2, borderH/2, 0); this.group.add(left);
    const right = new THREE.Mesh(new THREE.BoxGeometry(T, borderH, D), borderMat); right.position.set(W/2, borderH/2, 0); this.group.add(right);

    // Corner posts
    const postMat = new THREE.MeshStandardMaterial({ color: borderColor, roughness: 0.3, metalness: 0.5 });
    const postH = 0.8;
    for (const [sx, sz] of [[-1,1],[1,1],[1,-1],[-1,-1]] as [number,number][]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, postH, 8), postMat);
      post.position.set(sx * W/2, postH/2, sz * D/2);
      this.group.add(post);
      // Top cap
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), postMat);
      cap.position.set(sx * W/2, postH, sz * D/2);
      this.group.add(cap);
    }

    // Dashed grid lines on floor
    const lineMat = new THREE.LineBasicMaterial({ color: borderColor, transparent: true, opacity: 0.25 });
    for (let x = -W/2 + (BOX_W + GAP); x < W/2; x += (BOX_W + GAP)) {
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, T/2+0.01, -D/2), new THREE.Vector3(x, T/2+0.01, D/2)]);
      this.group.add(new THREE.Line(geo, lineMat));
    }
    for (let z = -D/2 + (BOX_D + GAP); z < D/2; z += (BOX_D + GAP)) {
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-W/2, T/2+0.01, z), new THREE.Vector3(W/2, T/2+0.01, z)]);
      this.group.add(new THREE.Line(geo, lineMat));
    }

    // Glow overlay if near/over capacity
    if (this.percentage >= 70) {
      const glowColor = this.percentage >= 90 ? 0xff2222 : 0xff9900;
      const gMat = new THREE.MeshBasicMaterial({ color: glowColor, transparent: true, opacity: 0.08 });
      const gFloor = new THREE.Mesh(new THREE.BoxGeometry(W, T, D), gMat);
      gFloor.position.set(0, T/2 + 0.01, 0);
      this.group.add(gFloor);
    }
  }

  /* ── Place products: 1 cube per real unit (qty=5 → 5 cubes) ── */
  private placeProducts() {
    if (this.products.length === 0) return;

    const isCabinet = this.type === 'cabinet';
    const T = isCabinet ? 0.12 : 0.08;
    const BOX_W = isCabinet ? 0.42 : 1.0;
    const BOX_H = isCabinet ? 0.38 : 0.95;
    const BOX_D = isCabinet ? 0.38 : 0.85;
    const GAP   = isCabinet ? 0.06 : 0.35;
    const N_SHELVES = isCabinet ? 5 : 1;

    // Redetermine dimensions to match build functions
    let cols, rows;
    if (isCabinet) {
      const targetPerShelf = Math.ceil(this.capacityUnits / N_SHELVES);
      cols = Math.ceil(Math.sqrt(targetPerShelf * (2.2/5)));
      rows = Math.ceil(targetPerShelf / cols);
    } else {
      cols = Math.ceil(Math.sqrt(this.capacityUnits * (8/6)));
      rows = Math.ceil(this.capacityUnits / cols);
    }

    const W = cols * (BOX_W + GAP) + T * 2;
    const D = rows * (BOX_D + GAP) + T * 2;
    const SHELF_H = isCabinet ? (8 / N_SHELVES) : 0;

    const maxSlots = cols * rows * N_SHELVES;

    const startX = -((W - T * 2) / 2) + BOX_W / 2;
    const startZ = -((D - T * 2) / 2) + BOX_D / 2;

    // Build flat list: exactly 1 entry per real unit
    const renderList: any[] = [];
    for (const p of this.products) {
      const qty = p.local_quantity || p.stock_quantity || 1;
      for (let i = 0; i < qty; i++) {
        renderList.push(p);
        if (renderList.length >= maxSlots) break;
      }
      if (renderList.length >= maxSlots) break;
    }

    // Place each cube in its slot
    renderList.forEach((product, idx) => {
      const shelf      = Math.floor(idx / (cols * rows));
      const posInShelf = idx % (cols * rows);
      const row        = Math.floor(posInShelf / cols);
      const col        = posInShelf % cols;
      if (shelf >= N_SHELVES) return;

      const yBase    = isCabinet ? (shelf * SHELF_H + T / 2) : 0.08;
      const colorInt = parseInt(this.toHex(product.title || String(product.id)), 16);
      const mat = new THREE.MeshStandardMaterial({ color: colorInt, roughness: 0.3, metalness: 0.1 });
      const geo = new THREE.BoxGeometry(BOX_W, BOX_H, BOX_D);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        startX + col * (BOX_W + GAP),
        yBase + BOX_H / 2,
        startZ + row * (BOX_D + GAP)
      );
      mesh.castShadow = true;
      this.group.add(mesh);

      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geo),
        new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.2 })
      );
      edges.position.copy(mesh.position);
      this.group.add(edges);

      this.clickableMeshes.push({ mesh, product });
    });
  }

  /* ── Helpers ── */
  private toHex(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    const hue = Math.abs(hash) % 360;
    const { r, g, b } = this.hsl(hue / 360, 0.72, 0.52);
    return r.toString(16).padStart(2,'0') + g.toString(16).padStart(2,'0') + b.toString(16).padStart(2,'0');
  }

  private hsl(h: number, s: number, l: number) {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const f = (t: number) => {
      if (t < 0) t++; if (t > 1) t--;
      if (t < 1/6) return p + (q-p)*6*t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q-p)*(2/3-t)*6;
      return p;
    };
    return { r: Math.round(f(h+1/3)*255), g: Math.round(f(h)*255), b: Math.round(f(h-1/3)*255) };
  }
}
