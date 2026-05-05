import { Component, ElementRef, Input, OnDestroy, OnInit, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as THREE from 'three';
import { AdminStockService } from '../../services/admin-stock.service';
import { AdminWarehouseService } from '../../services/admin-warehouse.service';

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
      <div class="hint-bar">{{ hintText }}</div>

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
      <div class="legend-panel" *ngIf="!isLoading && type !== 'room' && type !== 'warehouse' && uniqueProducts.length > 0">
        <div class="legend-title">📦 Produits</div>
        <div class="legend-list">
          <div class="legend-item" *ngFor="let p of uniqueProducts">
            <span class="legend-color" [style.background]="'#'+p.colorHex"></span>
            <span class="legend-name">{{ p.title }}</span>
            <span class="legend-qty">×{{ p.qty }}</span>
          </div>
        </div>
      </div>

      <!-- Navigation Bar (for rooms) -->
      <div class="nav-bar" *ngIf="viewStack.length > 0">
        <button class="btn-back" (click)="goBack()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          {{ backLabel }}
        </button>
      </div>

      <!-- Room Stats -->
      <div class="room-overlay" *ngIf="type === 'room' && !isLoading">
        <div class="room-title">Configuration de la Salle</div>
        <div class="room-meta">
          <span>{{ roomCabinets.length }} Armoires</span>
          <span>{{ roomLocations.length }} Emplacements</span>
        </div>
      </div>

      <div class="room-overlay" *ngIf="type === 'warehouse' && !isLoading">
        <div class="room-title">Plan 3D du Dépôt</div>
        <div class="room-meta">
          <span>{{ warehouseRooms.length }} Salles</span>
          <span>Cliquez une salle pour l'ouvrir</span>
        </div>
      </div>

      <!-- Empty -->
      <div class="empty-overlay" *ngIf="!isLoading && type !== 'warehouse' && type !== 'room' && products.length===0">
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
    .viewer-wrap { position: relative; font-family: 'Inter', system-ui, sans-serif; user-select: none; background: #0a192f; border-radius: 14px; box-shadow: inset 0 0 80px rgba(0,0,0,0.5); }
    .viewer-container { width: 100%; height: 600px; border-radius: 14px; overflow: hidden; cursor: grab; }
    .viewer-container:active { cursor: grabbing; }
    .hint-bar { text-align: center; font-size: 11px; color: #475569; padding: 8px 0; background: rgba(15, 23, 42, 0.4); border-bottom-left-radius: 14px; border-bottom-right-radius: 14px; }

    .overlay-stats {
      position: absolute; top: 20px; left: 20px;
      background: rgba(255,255,255,0.05); backdrop-filter: blur(16px);
      padding: 16px 20px; border-radius: 16px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1);
      min-width: 210px; transition: all .4s cubic-bezier(.16,1,.3,1); color: white;
    }
    .overlay-title { font-weight: 800; font-size: 15px; color: #fff; margin-bottom: 12px; letter-spacing: -0.3px; }
    .cap-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .cap-label { font-size: 10px; color: rgba(255,255,255,0.5); font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
    .cap-value { font-size: 14px; font-weight: 800; }
    .c-green { color: #4ade80; } .c-yellow { color: #fbbf24; } .c-red { color: #f87171; }
    .cap-bar-wrap { background: rgba(255,255,255,0.1); border-radius: 6px; height: 6px; overflow: hidden; margin-bottom: 6px; }
    .cap-bar { height: 100%; border-radius: 6px; transition: width 0.8s ease-out; }
    .bar-green  { background: #22c55e; }
    .bar-yellow { background: #f59e0b; }
    .bar-red    { background: #ef4444; box-shadow: 0 0 10px #ef4444; }
    .cap-pct { font-size: 11px; color: rgba(255,255,255,0.6); font-weight: 600; }

    .loading-overlay {
      position: absolute; inset: 0; display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 16px;
      background: rgba(10, 25, 47, 0.8); backdrop-filter: blur(8px);
      color: #64ffda; font-size: 16px; font-weight: 600; z-index: 100;
    }
    .spinner { width: 44px; height: 44px; border: 3px solid rgba(100, 255, 218, 0.1); border-top-color: #64ffda; border-radius: 50%; animation: spin 1s infinite cubic-bezier(.55,0,.1,1); }

    .legend-panel {
      position: absolute; top: 20px; right: 20px;
      background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(12px);
      padding: 16px; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.3);
      max-height: 350px; overflow-y: auto; width: 220px; border: 1px solid rgba(255,255,255,0.1);
    }
    .legend-title { font-size: 11px; font-weight: 800; color: #64ffda; text-transform: uppercase; margin-bottom: 12px; letter-spacing: 1px; }
    .legend-item { display: flex; align-items: center; gap: 10px; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
    .legend-color { width: 14px; height: 14px; border-radius: 4px; flex-shrink: 0; box-shadow: 0 0 5px rgba(0,0,0,0.3); }
    .legend-name { font-size: 12px; color: #ccd6f6; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .legend-qty { font-size: 11px; font-weight: 700; color: #8892b0; }

    .product-popup {
      position: absolute; background: rgba(17, 34, 64, 0.95); backdrop-filter: blur(12px);
      border-radius: 16px; box-shadow: 0 15px 40px rgba(0,0,0,0.5); padding: 20px;
      min-width: 240px; z-index: 200; border: 1px solid #64ffda44; color: #ccd6f6;
      animation: popIn 0.3s var(--ease-out);
    }
    .popup-title { font-weight: 800; font-size: 16px; color: #64ffda; margin-bottom: 14px; }
    .popup-row { display: flex; justify-content: space-between; font-size: 13px; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
    .popup-row span:first-child { color: #8892b0; }
    .popup-row span:last-child { color: #fff; font-weight: 700; }

    .nav-bar { position: absolute; bottom: 30px; left: 30px; z-index: 10; }
    .btn-back { 
      background: #64ffda11; backdrop-filter: blur(8px);
      color: #64ffda; border: 1px solid #64ffda33; padding: 12px 20px; border-radius: 50px;
      display: flex; align-items: center; gap: 10px; font-size: 14px; font-weight: 700;
      cursor: pointer; transition: all 0.3s ease;
    }
    .btn-back:hover { background: #64ffda; color: #0a192f; transform: translateY(-2px); box-shadow: 0 5px 15px rgba(100, 255, 218, 0.3); }

    .room-overlay {
      position: absolute; top: 20px; left: 20px;
      background: rgba(10, 25, 47, 0.85); backdrop-filter: blur(12px);
      padding: 16px 24px; border-radius: 18px; color: #fff;
      box-shadow: 0 10px 40px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1);
    }
    .room-title { font-weight: 800; font-size: 17px; margin-bottom: 6px; color: #64ffda; }
    .room-meta { display: flex; gap: 15px; font-size: 13px; color: #8892b0; font-weight: 500; }
  `]
})
export class Storage3dViewerComponent implements OnInit, OnDestroy {
  @ViewChild('viewerContainer', { static: true }) viewerContainer!: ElementRef;

  @Input() title: string = 'Stockage';
  @Input() capacityUnits: number = 100;
  @Input() currentUnits: number = 0;
  @Input() storageId: number | null = null;
  @Input() type: 'warehouse' | 'room' | 'location' | 'cabinet' = 'location';

  percentage = 0;
  products: any[] = [];
  uniqueProducts: { title: string; qty: number; colorHex: string }[] = [];
  isLoading = false;
  selectedProduct: any = null;
  popupX = 0; popupY = 0;

  roomCabinets: any[] = [];
  roomLocations: any[] = [];
  warehouseRooms: any[] = [];
  viewStack: any[] = [];

  get backLabel(): string {
    const previous = this.viewStack[this.viewStack.length - 1];
    return previous?.type === 'warehouse' ? 'Retour au dépôt' : 'Retour à la salle';
  }

  get hintText(): string {
    if (this.type === 'warehouse') return '🖱️ Glisser pour tourner · Molette pour zoomer · Clic sur une salle pour l\'ouvrir';
    if (this.type === 'room') return '🖱️ Glisser pour tourner · Molette pour zoomer · Clic sur une armoire/emplacement';
    return '🖱️ Glisser pour tourner · Molette pour zoomer · Clic sur un produit pour ses détails';
  }

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private animationId: number | null = null;
  private group!: THREE.Group;
  private clickableMeshes: { mesh: THREE.Mesh; data: any; type: string }[] = [];

  // Orbit state
  private isDragging = false;
  private prevMouse = { x: 0, y: 0 };
  private spherical = { theta: 0.4, phi: 1.1, radius: 9 };

  constructor(
    private stockService: AdminStockService, 
    private warehouseService: AdminWarehouseService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.percentage = this.capacityUnits > 0 ? (this.currentUnits / this.capacityUnits) * 100 : 0;
    this.initScene();
    if (this.storageId) { this.fetchProducts(); } else { this.buildScene(); }
  }

  ngOnDestroy() {
    if (this.animationId !== null) cancelAnimationFrame(this.animationId);
    if (this.renderer) this.renderer.dispose();
  }

  /* ── Navigation ── */
  goBack() {
    const prev = this.viewStack.pop();
    if (prev) {
      this.type = prev.type;
      this.storageId = prev.id;
      this.title = prev.title;
      this.capacityUnits = prev.capacity;
      this.currentUnits = prev.current;
      this.fetchProducts();
    }
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
    this.spherical.radius = Math.max(3, Math.min(25, this.spherical.radius + e.deltaY * 0.01));
    this.updateCamera();
  }
  private updateCamera() {
    const { theta, phi, radius } = this.spherical;
    this.camera.position.set(
      radius * Math.sin(phi) * Math.sin(theta),
      radius * Math.cos(phi) + 2,
      radius * Math.sin(phi) * Math.cos(theta)
    );
    const targetY = this.type === 'cabinet' ? 3 : (this.type === 'room' || this.type === 'warehouse' ? 0 : 1);
    this.camera.lookAt(0, targetY, 0);
  }

  /* ── Click on 3D Object ── */
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
      if (!found) return;

      if (this.type === 'warehouse' || this.type === 'room') {
        this.viewStack.push({
          type: this.type,
          id: this.storageId,
          title: this.title,
          capacity: this.capacityUnits,
          current: this.currentUnits
        });
        this.type = found.type as any;
        this.storageId = found.data.id;
        this.title = found.data.name || found.data.code;
        this.capacityUnits = found.data.capacity_units || 0;
        this.currentUnits = found.data.current_units || 0;
        this.fetchProducts();
      } else {
        this.selectedProduct = found.data;
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
    this.scene.background = new THREE.Color(0x0a192f);
    this.scene.fog = new THREE.FogExp2(0x0a192f, 0.03);

    this.camera = new THREE.PerspectiveCamera(50, container.clientWidth / (container.clientHeight || 560), 0.1, 250);
    this.updateCamera();

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight || 560);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const mainLight = new THREE.SpotLight(0xffffff, 2);
    mainLight.position.set(10, 20, 10);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 1024;
    mainLight.shadow.mapSize.height = 1024;
    this.scene.add(mainLight);

    const fillLight = new THREE.PointLight(0x4488ff, 1);
    fillLight.position.set(-10, 5, -10);
    this.scene.add(fillLight);

    const grid = new THREE.GridHelper(40, 40, 0x233554, 0x112240);
    this.scene.add(grid);

    this.animate();
  }

  private animate() {
    this.animationId = requestAnimationFrame(() => this.animate());
    this.renderer.render(this.scene, this.camera);
  }

  /* ── Fetch & build ── */
  fetchProducts() {
    this.isLoading = true;
    this.selectedProduct = null;
    this.cdr.detectChanges();

    if (this.type === 'warehouse') {
      this.fetchWarehouseRooms();
      return;
    }

    if (this.type === 'room') {
      this.fetchRoomData();
      return;
    }

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

  private fetchRoomData() {
    if (!this.storageId) return;
    
    import('rxjs').then(({ forkJoin }) => {
      forkJoin({
        cabinets: this.warehouseService.listCabinets(this.storageId as number),
        locations: this.warehouseService.listLocations(this.storageId as number)
      }).subscribe({
        next: (res: any) => {
          this.roomCabinets = res.cabinets.data || res.cabinets || [];
          this.roomLocations = res.locations.data || res.locations || [];
          this.isLoading = false;
          this.buildScene();
          this.cdr.detectChanges();
        },
        error: () => { this.isLoading = false; this.buildScene(); this.cdr.detectChanges(); }
      });
    });
  }

  private fetchWarehouseRooms() {
    if (!this.storageId) return;

    this.warehouseService.listRooms(this.storageId as number).subscribe({
      next: (res: any) => {
        this.warehouseRooms = res?.data || res || [];
        this.products = [];
        this.uniqueProducts = [];
        this.roomCabinets = [];
        this.roomLocations = [];
        this.isLoading = false;
        this.buildScene();
        this.cdr.detectChanges();
      },
      error: () => {
        this.warehouseRooms = [];
        this.isLoading = false;
        this.buildScene();
        this.cdr.detectChanges();
      }
    });
  }

  private buildScene() {
    if (this.group) this.scene.remove(this.group);
    this.clickableMeshes = [];
    this.group = new THREE.Group();
    this.scene.add(this.group);

    if (this.type === 'warehouse') {
      this.buildWarehouseScene();
      this.spherical.radius = 18;
    } else if (this.type === 'room') {
      this.buildRoomScene();
      this.spherical.radius = 15;
    } else {
      this.buildSingleEntityScene();
      this.spherical.radius = 9;
    }
    this.updateCamera();
  }

  private buildWarehouseScene() {
    const total = this.warehouseRooms.length;
    if (total === 0) return;

    const boxW = 2.2;
    const boxH = 1.6;
    const boxD = 1.8;
    const gap = 1.1;
    const cols = Math.ceil(Math.sqrt(total));
    const rows = Math.ceil(total / cols);
    const startX = -((cols - 1) * (boxW + gap)) / 2;
    const startZ = -((rows - 1) * (boxD + gap)) / 2;

    this.warehouseRooms.forEach((room, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const px = startX + col * (boxW + gap);
      const pz = startZ + row * (boxD + gap);
      const roomColor = parseInt(this.toHex(room?.name || `room-${idx}`), 16);
      const mat = new THREE.MeshStandardMaterial({
        color: roomColor,
        roughness: 0.45,
        metalness: 0.25,
        emissive: roomColor,
        emissiveIntensity: 0.14
      });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(boxW, boxH, boxD), mat);
      mesh.position.set(px, boxH / 2, pz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      this.clickableMeshes.push({ mesh, data: room, type: 'room' });
      this.addLabel(room?.name || room?.code || `Salle ${idx + 1}`, px, boxH + 0.45, pz);
    });
  }

  private buildRoomScene() {
    const BOX_W = 1.2, BOX_D = 1.0;
    const GAP = 1.5;
    
    const total = this.roomCabinets.length + this.roomLocations.length;
    const cols = Math.ceil(Math.sqrt(total));
    const startX = -((cols - 1) * (BOX_W + GAP)) / 2;
    const startZ = -((cols - 1) * (BOX_D + GAP)) / 2;

    const frameMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.2 });
    const locMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 0.2 });

    let idx = 0;
    
    this.roomCabinets.forEach(c => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const h = 4;
      const px = startX + col * (BOX_W + GAP);
      const pz = startZ + row * (BOX_D + GAP);
      
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(BOX_W, h, BOX_D), frameMat);
      mesh.position.set(px, h/2, pz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      this.clickableMeshes.push({ mesh, data: c, type: 'cabinet' });

      // Label
      this.addLabel(c.name || c.code, px, h + 0.5, pz);
      idx++;
    });

    this.roomLocations.forEach(l => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const px = startX + col * (BOX_W + GAP);
      const pz = startZ + row * (BOX_D + GAP);

      const mesh = new THREE.Mesh(new THREE.BoxGeometry(BOX_W, 0.1, BOX_D), locMat);
      mesh.position.set(px, 0.05, pz);
      this.group.add(mesh);
      this.clickableMeshes.push({ mesh, data: l, type: 'location' });

      // Label
      this.addLabel(l.name || l.code, px, 0.6, pz);
      idx++;
    });
  }

  private addLabel(text: string, x: number, y: number, z: number) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = 256;
    canvas.height = 64;
    ctx.fillStyle = 'rgba(10, 25, 47, 0.8)';
    if (ctx.roundRect) { ctx.roundRect(0, 0, 256, 64, 12); ctx.fill(); } else { ctx.fillRect(0,0,256,64); }
    ctx.font = 'bold 28px Inter';
    ctx.fillStyle = '#64ffda';
    ctx.textAlign = 'center';
    ctx.fillText(text, 128, 42);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.set(x, y, z);
    sprite.scale.set(3, 0.75, 1);
    this.group.add(sprite);
  }

  private buildSingleEntityScene() {
    this.percentage = this.capacityUnits > 0 ? (this.currentUnits / this.capacityUnits) * 100 : 0;
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
    const N = 5;
    const targetPerShelf = Math.ceil(this.capacityUnits / N) || 10;
    const cols = Math.ceil(Math.sqrt(targetPerShelf * 0.4));
    const rows = Math.ceil(targetPerShelf / cols);

    const BOX_W = 0.42, BOX_D = 0.38, GAP = 0.06, T = 0.12;
    const W = cols * (BOX_W + GAP) + T * 2;
    const D = rows * (BOX_D + GAP) + T * 2;
    const H = 6;

    const box = (w: number, h: number, d: number, mat: THREE.Material) =>
      new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);

    const left = box(T, H, D, frame); left.position.set(-W/2, H/2, 0); this.group.add(left);
    const right = box(T, H, D, frame); right.position.set(W/2, H/2, 0); this.group.add(right);
    const back = box(W, H, T, frame); back.position.set(0, H/2, -D/2); this.group.add(back);
    const top = box(W + T*2, T, D, frame); top.position.set(0, H, 0); this.group.add(top);
    const base = box(W + T*2, T, D, frame); base.position.set(0, 0, 0); this.group.add(base);

    const shH = H / N;
    for (let i = 1; i < N; i++) {
      const s = box(W - T, 0.05, D - T, shelf);
      s.position.set(0, i * shH, 0);
      this.group.add(s);
    }
  }

  /* ── Location: floor zone ── */
  private buildFloorZone() {
    const cap = this.capacityUnits || 1;
    const cols = Math.ceil(Math.sqrt(cap * 1.3));
    const rows = Math.ceil(cap / cols);
    const BOX_W = 1.0, BOX_D = 0.85, GAP = 0.35, T = 0.08;

    const W = cols * (BOX_W + GAP) + T * 2;
    const D = rows * (BOX_D + GAP) + T * 2;

    const borderColor = this.percentage >= 90 ? 0xef4444 : this.percentage >= 70 ? 0xf59e0b : 0x22c55e;
    const borderMat = new THREE.MeshStandardMaterial({ color: borderColor, roughness: 0.4, metalness: 0.3 });
    const floorMat  = new THREE.MeshStandardMaterial({ color: 0x1e3a5f, transparent: true, opacity: 0.3 });

    const floor = new THREE.Mesh(new THREE.BoxGeometry(W, T, D), floorMat);
    floor.position.set(0, 0, 0);
    this.group.add(floor);

    const borderH = 0.15;
    const f = new THREE.Mesh(new THREE.BoxGeometry(W+T*2, borderH, T), borderMat); f.position.set(0, borderH/2, D/2); this.group.add(f);
    const b = new THREE.Mesh(new THREE.BoxGeometry(W+T*2, borderH, T), borderMat); b.position.set(0, borderH/2, -D/2); this.group.add(b);
    const l = new THREE.Mesh(new THREE.BoxGeometry(T, borderH, D), borderMat); l.position.set(-W/2, borderH/2, 0); this.group.add(l);
    const r = new THREE.Mesh(new THREE.BoxGeometry(T, borderH, D), borderMat); r.position.set(W/2, borderH/2, 0); this.group.add(r);
  }

  /* ── Place products ── */
  private placeProducts() {
    if (this.products.length === 0) return;

    const isCabinet = this.type === 'cabinet';
    const cap = this.capacityUnits || 1;
    const N_SHELVES = isCabinet ? 5 : 1;
    const targetPerShelf = Math.ceil(cap / N_SHELVES);
    const cols = Math.ceil(Math.sqrt(targetPerShelf * (isCabinet ? 0.4 : 1.3)));
    const rows = Math.ceil(targetPerShelf / cols);

    const BOX_W = isCabinet ? 0.42 : 1.0;
    const BOX_H = isCabinet ? 0.38 : 0.6;
    const BOX_D = isCabinet ? 0.38 : 0.85;
    const GAP   = isCabinet ? 0.06 : 0.35;
    const T = 0.12;
    const H = 6;
    const SHELF_H = H / N_SHELVES;

    const startX = -((cols * (BOX_W + GAP)) / 2) + BOX_W/2;
    const startZ = -((rows * (BOX_D + GAP)) / 2) + BOX_D/2;

    const renderList: any[] = [];
    for (const p of this.products) {
      const q = p.local_quantity || p.stock_quantity || 1;
      for (let i = 0; i < q; i++) renderList.push(p);
    }

    renderList.forEach((product, idx) => {
      if (idx >= cap) return;
      const shelf = Math.floor(idx / (cols * rows));
      const pos = idx % (cols * rows);
      const r = Math.floor(pos / cols);
      const c = pos % cols;

      const y = isCabinet ? (shelf * SHELF_H + 0.1) : 0.1;
      const colorInt = parseInt(this.toHex(product.title || String(product.id)), 16);
      const mat = new THREE.MeshStandardMaterial({ color: colorInt, roughness: 0.4, metalness: 0.2 });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(BOX_W, BOX_H, BOX_D), mat);
      mesh.position.set(startX + c * (BOX_W+GAP), y + BOX_H/2, startZ + r * (BOX_D+GAP));
      mesh.castShadow = true;
      this.group.add(mesh);
      this.clickableMeshes.push({ mesh, data: product, type: 'product' });
    });
  }

  /* ── Helpers ── */
  private toHex(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    const hue = Math.abs(hash) % 360;
    const { r, g, b } = this.hsl(hue / 360, 0.7, 0.5);
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
