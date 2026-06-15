import { Component, OnInit, ChangeDetectorRef, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { AdminWarehouseService } from '../../core/services/admin-warehouse.service';
import { ApiService } from '../../core/services/api.service';

declare var L: any;

@Component({
  selector: 'app-warehouses',
  standalone: false,
  templateUrl: './warehouses.component.html',
  styleUrls: ['./warehouses.component.css']
})
export class WarehousesComponent implements OnInit {
  warehouses: any[] = [];
  selectedWarehouse: any = null;
  rooms: any[] = [];
  locations: any[] = [];
  selectedRoom: any = null;
  cabinets: any[] = [];
  cabinetsSearch: string = '';

  q: string = '';
  roomSearch: string = '';
  locationSearch: string = '';
  roomContentTab: 'locations' | 'cabinets' = 'locations';

  isLoading = false;
  errorMessage = '';
  successMessage = '';

  // Erreurs specifiques a chaque modal
  warehouseModalError = '';
  roomModalError = '';
  locationModalError = '';
  cabinetModalError = '';

  // Modal properties
  showWarehouseModal = false;
  showRoomModal = false;
  showLocationModal = false;
  showCabinetModal = false;

  editingWarehouseId: number | null = null;
  editingRoomId: number | null = null;
  editingLocationId: number | null = null;
  editingCabinetId: number | null = null;

  show3DViewerModal = false;
  viewerData: { title: string; capacity: number; current: number; type: 'warehouse' | 'room' | 'location' | 'cabinet'; id: number | null } = {
    title: '',
    capacity: 0,
    current: 0,
    type: 'location',
    id: null
  };

  warehouseForm = {
    name: '',
    address: '',
    latitude: null as number | null,
    longitude: null as number | null,
    phone: '',
    max_rooms: null as number | null,
  };

  map: any;
  consultMap: any;
  marker: any;
  showMapConsult = false;
  viewingMapWarehouse: any = null;

  roomForm = {
    name: '',
    max_locations: null as number | null,
    max_cabinets: null as number | null
  };
  locationForm = {
    code: '',
    name: '',
    capacity_units: ''
  };

  cabinetForm = {
    code: '',
    name: '',
    capacity_units: null as number | null
  };


  constructor(
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object,
    private warehouseService: AdminWarehouseService,
    private router: Router,
    private api: ApiService
  ) { }

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.loadWarehouses();
  }

  /* --- Warehouses Management --- */

  loadWarehouses(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.isLoading = true;
    this.errorMessage = '';

    this.warehouseService.listWarehouses(this.q || null).subscribe({
      next: (res: any) => {
        this.warehouses = Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []);
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorMessage = 'Impossible de charger les depots.';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  selectWarehouse(warehouse: any): void {
    this.selectedWarehouse = warehouse;
    this.selectedRoom = null;
    this.rooms = [];
    this.locations = [];
    this.cabinets = [];
    this.loadRooms();
  }

  openAddWarehouseModal(): void {
    this.resetWarehouseForm();
    this.editingWarehouseId = null;
    this.warehouseModalError = '';
    this.showWarehouseModal = true;
    setTimeout(() => this.initMap(), 300);
  }

  openEditWarehouseModal(warehouse: any): void {
    this.editingWarehouseId = warehouse.id;
    this.warehouseForm = {
      name: warehouse.name || '',
      address: warehouse.address || '',
      latitude: warehouse.latitude ? Number(warehouse.latitude) : null,
      longitude: warehouse.longitude ? Number(warehouse.longitude) : null,
      phone: warehouse.phone || '',
      max_rooms: warehouse.max_rooms || null,
    };
    this.warehouseModalError = '';
    this.showWarehouseModal = true;
    setTimeout(() => this.initMap(), 300);
  }

  geocodeAddress(): void {
    if (!this.warehouseForm.address) return;

    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(this.warehouseForm.address)}`;

    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) {
          const lat = parseFloat(data[0].lat);
          const lon = parseFloat(data[0].lon);
          
          this.warehouseForm.latitude = lat;
          this.warehouseForm.longitude = lon;

          if (this.map) {
            this.map.setView([lat, lon], 15);
            if (this.marker) {
              this.marker.setLatLng([lat, lon]);
            }
          }
          this.cdr.detectChanges();
        } else {
          console.warn('Adresse non trouvee sur la carte');
        }
      })
      .catch(err => console.error('Erreur de geocodage:', err));
  }

  initMap(lat = 36.8065, lng = 10.1815, retryCount = 0): void {
    if (typeof L === 'undefined') {
      if (retryCount < 10) {
        setTimeout(() => this.initMap(lat, lng, retryCount + 1), 200);
      } else {
        console.error('Leaflet not loaded after multiple retries');
      }
      return;
    }

    if (this.map) {
      this.map.remove();
    }

    const iconRetinaUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png';
    const iconUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png';
    const shadowUrl = 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png';
    const iconDefault = L.icon({
      iconRetinaUrl,
      iconUrl,
      shadowUrl,
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      tooltipAnchor: [16, -28],
      shadowSize: [41, 41]
    });
    L.Marker.prototype.options.icon = iconDefault;

    const initialLat = this.warehouseForm.latitude || lat;
    const initialLng = this.warehouseForm.longitude || lng;

    try {
      this.map = L.map('warehouseMap').setView([initialLat, initialLng], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: 'e OpenStreetMap'
      }).addTo(this.map);

      this.marker = L.marker([initialLat, initialLng], { draggable: true }).addTo(this.map);

      this.marker.on('dragend', (event: any) => {
        const position = event.target.getLatLng();
        this.warehouseForm.latitude = parseFloat(position.lat.toFixed(6));
        this.warehouseForm.longitude = parseFloat(position.lng.toFixed(6));
        this.cdr.detectChanges();
      });

      this.map.on('click', (e: any) => {
        this.marker.setLatLng(e.latlng);
        this.warehouseForm.latitude = parseFloat(e.latlng.lat.toFixed(6));
        this.warehouseForm.longitude = parseFloat(e.latlng.lng.toFixed(6));
        this.cdr.detectChanges();
      });

      setTimeout(() => {
        if (this.map) this.map.invalidateSize();
      }, 200);

    } catch (e) {
      console.error('Error initializing map:', e);
    }
  }

  openConsultMap(warehouse: any): void {
    this.viewingMapWarehouse = warehouse;
    this.showMapConsult = true;
    this.cdr.detectChanges();
    setTimeout(() => {
      this.retryInitConsultMap(warehouse, 0);
    }, 100);
  }

  private retryInitConsultMap(warehouse: any, count: number): void {
    const container = document.getElementById('consultMap');
    if (!container) {
      if (count < 10) {
        setTimeout(() => this.retryInitConsultMap(warehouse, count + 1), 100);
      }
      return;
    }
    this.initializeConsultMap(warehouse);
  }

  private initializeConsultMap(warehouse: any): void {
    if (typeof L === 'undefined') {
      console.error('Leaflet not loaded for consult map');
      return;
    }
    try {
      if (this.consultMap) {
        this.consultMap.remove();
        this.consultMap = null;
      }

      const lat = warehouse.latitude ? Number(warehouse.latitude) : 36.8065;
      const lng = warehouse.longitude ? Number(warehouse.longitude) : 10.1815;

      this.consultMap = L.map('consultMap').setView([lat, lng], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: 'e OpenStreetMap'
      }).addTo(this.consultMap);

      if (warehouse.latitude && warehouse.longitude) {
        L.marker([lat, lng]).addTo(this.consultMap)
          .bindPopup(`<b>${warehouse.name}</b><br>${warehouse.address}`).openPopup();
      }

      setTimeout(() => {
        if (this.consultMap) this.consultMap.invalidateSize();
      }, 300);
    } catch (e) {
      console.error('Error initializing consult map:', e);
    }
  }

  closeMapConsult(): void {
    if (this.consultMap) {
      this.consultMap.remove();
      this.consultMap = null;
    }
    this.showMapConsult = false;
    this.viewingMapWarehouse = null;
  }

  closeWarehouseModal(): void {
    this.showWarehouseModal = false;
    this.warehouseModalError = '';
    this.resetWarehouseForm();
  }

  saveWarehouse(): void {
    if (!this.warehouseForm.name || !this.warehouseForm.name.trim()) {
      this.warehouseModalError = 'Le nom du depot est obligatoire.';
      this.cdr.detectChanges();
      return;
    }

    this.warehouseModalError = '';

    const req$ = this.editingWarehouseId
      ? this.warehouseService.updateWarehouse(this.editingWarehouseId, this.warehouseForm)
      : this.warehouseService.createWarehouse(this.warehouseForm);

    req$.subscribe({
      next: () => {
        this.successMessage = this.editingWarehouseId ? 'Depot mis a jour !' : 'Depot cree avec succes !';
        this.closeWarehouseModal();
        this.loadWarehouses();
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: (err) => {
        this.warehouseModalError = this.api.extractErrorMessage(err, 'Erreur lors de la sauvegarde du depot.');
        this.cdr.detectChanges();
      }
    });
  }

  deleteWarehouse(id: number): void {
    const warehouse = this.warehouses.find((w) => w.id === id);
    if (warehouse && !this.canDeleteWarehouse(warehouse)) {
      this.errorMessage = 'Suppression impossible: ce depot contient des salles ou du stock.';
      this.cdr.detectChanges();
      return;
    }
    this.openConfirmModal(
      'Supprimer le depot',
      'Etes-vous sur de vouloir supprimer ce depot ?',
      () => {
        this.warehouseService.deleteWarehouse(id).subscribe({
          next: () => {
            this.successMessage = 'Depot supprime !';
            this.loadWarehouses();
            this.selectedWarehouse = null;
            this.rooms = [];
            this.locations = [];
            setTimeout(() => this.successMessage = '', 3000);
          },
          error: (err) => {
            this.errorMessage = this.api.extractErrorMessage(err, 'Impossible de supprimer ce depot.');
            this.cdr.detectChanges();
          }
        });
      },
      'danger',
      'Supprimer'
    );
  }

  resetWarehouseForm(): void {
    this.warehouseForm = {
      name: '',
      address: '',
      latitude: null,
      longitude: null,
      phone: '',
      max_rooms: null,
    };
  }

  search(): void {
    this.loadWarehouses();
  }

  /* --- Rooms Management --- */

  loadRooms(): void {
    if (!this.selectedWarehouse) return;

    this.warehouseService.listRooms(this.selectedWarehouse.id, this.roomSearch || null).subscribe({
      next: (res: any) => {
        this.rooms = Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []);
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorMessage = 'Impossible de charger les salles.';
        this.cdr.detectChanges();
      }
    });
  }

  selectRoom(room: any): void {
    this.selectedRoom = room;
    this.locations = [];
    this.cabinets = [];
    this.roomContentTab = 'locations';
    this.loadLocations();
    this.loadCabinets();
  }

  openAddRoomModal(): void {
    if (!this.selectedWarehouse) {
      this.errorMessage = 'Veuillez selectionner un depot d\'abord.';
      return;
    }
    this.resetRoomForm();
    this.editingRoomId = null;
    this.roomModalError = '';
    this.showRoomModal = true;
  }

  openEditRoomModal(room: any): void {
    this.editingRoomId = room.id;
    this.roomForm = {
      name: room.name || '',
      max_locations: room.max_locations || null,
      max_cabinets: room.max_cabinets || null
    };
    this.roomModalError = '';
    this.showRoomModal = true;
  }

  closeRoomModal(): void {
    this.showRoomModal = false;
    this.roomModalError = '';
    this.resetRoomForm();
  }

  saveRoom(): void {
    if (!this.roomForm.name || !this.roomForm.name.trim()) {
      this.roomModalError = 'Le nom de la salle est obligatoire.';
      this.cdr.detectChanges();
      return;
    }

    if (!this.selectedWarehouse) {
      this.roomModalError = 'Depot non selectionne. Veuillez fermer et selectionner un depot.';
      this.cdr.detectChanges();
      return;
    }

    this.roomModalError = '';

    const payload = {
      warehouse_id: this.selectedWarehouse.id,
      ...this.roomForm
    };

    const req$ = this.editingRoomId
      ? this.warehouseService.updateRoom(this.editingRoomId, payload)
      : this.warehouseService.createRoom(payload);

    req$.subscribe({
      next: () => {
        this.successMessage = this.editingRoomId ? 'Salle mise a jour avec succes !' : 'Salle creee avec succes !';
        this.closeRoomModal();
        this.loadRooms();
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: (err) => {
        this.roomModalError = this.api.extractErrorMessage(err, 'Erreur lors de la sauvegarde de la salle.');
        this.cdr.detectChanges();
      }
    });
  }

  deleteRoom(id: number): void {
    const room = this.rooms.find((r) => r.id === id);
    if (room && !this.canDeleteRoom(room)) {
      this.errorMessage = 'Suppression impossible: cette salle contient des emplacements, armoires ou du stock.';
      this.cdr.detectChanges();
      return;
    }
    this.openConfirmModal(
      'Supprimer la salle',
      'Etes-vous sur de vouloir supprimer cette salle ?',
      () => {
        this.warehouseService.deleteRoom(id).subscribe({
          next: () => {
            this.successMessage = 'Salle supprimee !';
            this.loadRooms();
            this.selectedRoom = null;
            this.locations = [];
            setTimeout(() => this.successMessage = '', 3000);
          },
          error: (err) => {
            this.errorMessage = this.api.extractErrorMessage(err, 'Impossible de supprimer cette salle.');
            this.cdr.detectChanges();
          }
        });
      },
      'danger',
      'Supprimer'
    );
  }

  resetRoomForm(): void {
    this.roomForm = {
      name: '',
      max_locations: null,
      max_cabinets: null
    };
  }

  /* --- Locations Management --- */

  loadLocations(): void {
    if (!this.selectedRoom) return;

    this.warehouseService.listLocations(this.selectedRoom.id, this.locationSearch || null).subscribe({
      next: (res: any) => {
        this.locations = Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []);
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorMessage = 'Impossible de charger les emplacements.';
        this.cdr.detectChanges();
      }
    });
  }

  openAddLocationModal(): void {
    if (!this.selectedRoom) {
      this.errorMessage = 'Veuillez selectionner une salle d\'abord.';
      return;
    }
    this.resetLocationForm();
    this.editingLocationId = null;
    this.locationModalError = '';
    this.showLocationModal = true;
  }

  openEditLocationModal(location: any): void {
    this.editingLocationId = location.id;
    this.locationForm = {
      code: location.code || '',
      name: location.name || '',
      capacity_units: location.capacity_units || ''
    };
    this.locationModalError = '';
    this.showLocationModal = true;
  }

  closeLocationModal(): void {
    this.showLocationModal = false;
    this.locationModalError = '';
    this.resetLocationForm();
  }

  saveLocation(): void {
    if (!this.locationForm.name || !this.locationForm.name.trim()) {
      this.locationModalError = 'Le nom de l\'emplacement est obligatoire.';
      this.cdr.detectChanges();
      return;
    }

    if (!this.selectedRoom) {
      this.locationModalError = 'Salle non selectionnee. Veuillez fermer et selectionner une salle.';
      this.cdr.detectChanges();
      return;
    }

    this.locationModalError = '';

    const payload = {
      room_id: this.selectedRoom.id,
      ...this.locationForm
    };

    const req$ = this.editingLocationId
      ? this.warehouseService.updateLocation(this.editingLocationId, payload)
      : this.warehouseService.createLocation(payload);

    req$.subscribe({
      next: () => {
        this.successMessage = this.editingLocationId ? 'Emplacement mis a jour avec succes !' : 'Emplacement cree avec succes !';
        this.closeLocationModal();
        this.loadLocations();
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: (err) => {
        this.locationModalError = this.api.extractErrorMessage(err, 'Erreur lors de la sauvegarde de l\'emplacement.');
        this.cdr.detectChanges();
      }
    });
  }

  deleteLocation(id: number): void {
    const location = this.locations.find((l) => l.id === id);
    if (location && !this.canDeleteLocation(location)) {
      this.errorMessage = 'Suppression impossible: cet emplacement n est pas vide.';
      this.cdr.detectChanges();
      return;
    }
    this.openConfirmModal(
      'Supprimer l\'emplacement',
      'Etes-vous sur de vouloir supprimer cet emplacement ?',
      () => {
        this.warehouseService.deleteLocation(id).subscribe({
          next: () => {
            this.successMessage = 'Emplacement supprime !';
            this.loadLocations();
            setTimeout(() => this.successMessage = '', 3000);
          },
          error: (err) => {
            this.errorMessage = this.api.extractErrorMessage(err, 'Impossible de supprimer cet emplacement.');
            this.cdr.detectChanges();
          }
        });
      },
      'danger',
      'Supprimer'
    );
  }

  resetLocationForm(): void {
    this.locationForm = {
      code: '',
      name: '',
      capacity_units: ''
    };
  }

  /* --- Cabinets (Armoires) --- */

  loadCabinets(): void {
    if (!this.selectedRoom) return;

    this.warehouseService.listCabinets(this.selectedRoom.id, this.cabinetsSearch || null).subscribe({
      next: (res: any) => {
        this.cabinets = Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []);
        this.cdr.detectChanges();
      },
      error: () => {
        this.errorMessage = 'Impossible de charger les armoires.';
        this.cdr.detectChanges();
      }
    });
  }

  openAddCabinetModal(): void {
    if (!this.selectedRoom) {
      this.errorMessage = 'Veuillez selectionner une salle d\'abord.';
      return;
    }
    this.resetCabinetForm();
    this.editingCabinetId = null;
    this.cabinetModalError = '';
    this.showCabinetModal = true;
  }

  openEditCabinetModal(cabinet: any): void {
    this.editingCabinetId = cabinet.id;
    this.cabinetForm = {
      code: cabinet.code || '',
      name: cabinet.name || '',
      capacity_units: cabinet.capacity_units || null
    };
    this.cabinetModalError = '';
    this.showCabinetModal = true;
  }

  closeCabinetModal(): void {
    this.showCabinetModal = false;
    this.cabinetModalError = '';
    this.resetCabinetForm();
  }

  saveCabinet(): void {
    if (!this.selectedRoom) {
      this.cabinetModalError = 'Salle non selectionnee. Veuillez fermer et selectionner une salle.';
      this.cdr.detectChanges();
      return;
    }

    if (!this.cabinetForm.name || !this.cabinetForm.name.trim()) {
      this.cabinetModalError = 'Le nom de l\'armoire est obligatoire.';
      this.cdr.detectChanges();
      return;
    }

    this.cabinetModalError = '';

    const payload = {
      room_id: this.selectedRoom?.id,
      ...this.cabinetForm
    };

    const req$ = this.editingCabinetId
      ? this.warehouseService.updateCabinet(this.editingCabinetId, payload)
      : this.warehouseService.createCabinet(payload);

    req$.subscribe({
      next: () => {
        this.successMessage = this.editingCabinetId ? 'Armoire mise a jour avec succes !' : 'Armoire creee avec succes !';
        this.closeCabinetModal();
        this.loadCabinets();
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: (err) => {
        this.cabinetModalError = this.api.extractErrorMessage(err, 'Erreur lors de la sauvegarde de l\'armoire.');
        this.cdr.detectChanges();
      }
    });
  }

  deleteCabinet(id: number): void {
    const cabinet = this.cabinets.find((x) => x.id === id);
    if (cabinet && !this.canDeleteCabinet(cabinet)) {
      this.errorMessage = 'Suppression impossible: cette armoire n est pas vide.';
      this.cdr.detectChanges();
      return;
    }
    this.openConfirmModal(
      'Supprimer l\'armoire',
      'Etes-vous sur de vouloir supprimer cette armoire ?',
      () => {
        this.warehouseService.deleteCabinet(id).subscribe({
          next: () => {
            this.successMessage = 'Armoire supprimee !';
            this.loadCabinets();
            setTimeout(() => this.successMessage = '', 3000);
          },
          error: (err) => {
            this.errorMessage = this.api.extractErrorMessage(err, 'Impossible de supprimer cette armoire.');
            this.cdr.detectChanges();
          }
        });
      },
      'danger',
      'Supprimer'
    );
  }

  resetCabinetForm(): void {
    this.cabinetForm = {
      code: '',
      name: '',
      capacity_units: null
    };
  }

  viewWarehouseProducts(warehouse: any): void {
    this.router.navigate(['/warehouse', warehouse.id, 'products']);
  }

  viewRoomProducts(room: any): void {
    this.router.navigate(['/room', room.id, 'products']);
  }

  viewLocationProducts(location: any): void {
    this.router.navigate(['/location', location.id, 'products']);
  }

  viewCabinetProducts(cabinet: any): void {
    this.router.navigate(['/cabinet', cabinet.id, 'products']);
  }

  open3DViewer(type: 'warehouse' | 'room' | 'location' | 'cabinet', item: any): void {
    this.viewerData = {
      title: item.name || item.code || 'Stockage',
      capacity: item.capacity_units || 0,
      current: item.current_units || 0,
      type: type,
      id: item.id
    };
    this.show3DViewerModal = true;
  }

  close3DViewer(): void {
    this.show3DViewerModal = false;
  }

  canDeleteWarehouse(item: any): boolean {
    const roomsCount = Number(item?.rooms_count ?? item?.roomsCount ?? 0);
    const currentUnits = Number(item?.current_units ?? item?.currentUnits ?? 0);
    return roomsCount === 0 && currentUnits === 0;
  }

  canDeleteRoom(item: any): boolean {
    const locationsCount = Number(item?.locations_count ?? 0);
    const cabinetsCount = Number(item?.cabinets_count ?? 0);
    const currentUnits = Number(item?.current_units ?? item?.currentUnits ?? 0);
    return locationsCount === 0 && cabinetsCount === 0 && currentUnits === 0;
  }

  canDeleteLocation(item: any): boolean {
    return Number(item?.current_units ?? item?.currentUnits ?? 0) === 0;
  }

  canDeleteCabinet(item: any): boolean {
    return Number(item?.current_units ?? item?.currentUnits ?? 0) === 0;
  }

  /* --- Confirm Modal helpers --- */
  confirmModalVisible = false;
  confirmModalTitle = '';
  confirmModalMessage = '';
  confirmModalConfirmText = 'Confirmer';
  confirmModalCancelText = 'Annuler';
  confirmModalType: 'danger' | 'warning' | 'info' = 'warning';
  confirmModalAlertOnly = false;
  private pendingAction: (() => void) | null = null;

  private openConfirmModal(title: string, message: string, action: () => void, type: 'danger' | 'warning' | 'info' = 'warning', confirmText = 'Confirmer'): void {
    this.confirmModalTitle = title;
    this.confirmModalMessage = message;
    this.confirmModalConfirmText = confirmText;
    this.confirmModalType = type;
    this.confirmModalAlertOnly = false;
    this.pendingAction = action;
    this.confirmModalVisible = true;
    this.cdr.detectChanges();
  }

  private showAlertModal(title: string, message: string, type: 'danger' | 'warning' | 'info' = 'warning'): void {
    this.confirmModalTitle = title;
    this.confirmModalMessage = message;
    this.confirmModalType = type;
    this.confirmModalAlertOnly = true;
    this.pendingAction = null;
    this.confirmModalVisible = true;
    this.cdr.detectChanges();
  }

  onConfirmModalConfirmed(): void {
    this.confirmModalVisible = false;
    if (this.pendingAction) {
      this.pendingAction();
      this.pendingAction = null;
    }
  }

}

