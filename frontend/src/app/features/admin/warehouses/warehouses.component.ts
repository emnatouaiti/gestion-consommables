import { Component, OnInit, ChangeDetectorRef, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { AdminWarehouseService } from '../services/admin-warehouse.service';

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

  // Modal properties
  showWarehouseModal = false;
  showRoomModal = false;
  showLocationModal = false;
  showCabinetModal = false;

  editingWarehouseId: number | null = null;
  editingRoomId: number | null = null;
  editingLocationId: number | null = null;
  editingCabinetId: number | null = null;

  warehouseForm = {
    name: '',
    description: '',
    address: '',
    city: '',
    governorate: '',
    latitude: null as number | null,
    longitude: null as number | null,
    phone: '',
    status: 'active'
  };

  governorates = [
    'Tunis', 'Ariana', 'Ben Arous', 'Manouba', 'Nabeul', 'Zaghouan', 'Bizerte', 'Béja',
    'Jendouba', 'Le Kef', 'Siliana', 'Kairouan', 'Kasserine', 'Sidi Bouzid', 'Sousse',
    'Monastir', 'Mahdia', 'Sfax', 'Gafsa', 'Tozeur', 'Kebili', 'Gabès', 'Medenine', 'Tataouine'
  ];

  citiesMap: { [key: string]: string[] } = {
    'Tunis': ['Tunis', 'La Marsa', 'Carthage', 'La Goulette', 'Le Kram', 'Sidi Bou Said'],
    'Ariana': ['Ariana', 'Raoued', 'Kalaat el-Andalous', 'Soukra', 'Ettadhamen', 'Mnihla'],
    'Ben Arous': ['Ben Arous', 'Boumhel', 'El Mourouj', 'Ezzahra', 'Hammam Lif', 'Megrine', 'Radès'],
    'Manouba': ['Manouba', 'Den Den', 'Douar Hicher', 'Mornaguia', 'Oued Ellil'],
    'Nabeul': ['Nabeul', 'Hammamet', 'Korba', 'Menzel Temime', 'Grombalia', 'Kelibia'],
    'Zaghouan': ['Zaghouan', 'Bir Mcherga', 'El Fahs', 'Nadhour'],
    'Bizerte': ['Bizerte', 'Menzel Bourguiba', 'Ras Jebel', 'Sejnane', 'Zarzouna'],
    'Béja': ['Béja', 'Amdoun', 'Medjez el-Bab', 'Nefza', 'Teboursouk'],
    'Jendouba': ['Jendouba', 'Ain Draham', 'Bou Salem', 'Tabarka'],
    'Le Kef': ['Le Kef', 'Dahmani', 'Nebeur', 'Sakiet Sidi Youssef'],
    'Siliana': ['Siliana', 'Bou Arada', 'Makthar', 'Gaafour'],
    'Kairouan': ['Kairouan', 'Bou Hajla', 'Sbikha', 'Chebika'],
    'Kasserine': ['Kasserine', 'Feriana', 'Sbeitla', 'Thala'],
    'Sidi Bouzid': ['Sidi Bouzid', 'Jelma', 'Regueb', 'Menzel Bouzaiane'],
    'Sousse': ['Sousse', 'Akouda', 'Hammam Sousse', 'Kalâa Kebira', 'Kalâa Seghira', 'Msaken'],
    'Monastir': ['Monastir', 'Jemmel', 'Ksar Hellal', 'Moknine', 'Sahline'],
    'Mahdia': ['Mahdia', 'Chebba', 'El Jem', 'Ksour Essef'],
    'Sfax': ['Sfax', 'Agareb', 'Kerkennah', 'Mahres', 'Sakiet Ezzit'],
    'Gafsa': ['Gafsa', 'El Ksar', 'Metlaoui', 'Redeyef'],
    'Tozeur': ['Tozeur', 'Degache', 'Nefta', 'Tamaghza'],
    'Kebili': ['Kebili', 'Douz', 'Souk Lahad'],
    'Gabès': ['Gabès', 'El Hamma', 'Mareth', 'Matmata'],
    'Medenine': ['Medenine', 'Houmt Souk', 'Midoun', 'Zarzis', 'Ben Guerdane'],
    'Tataouine': ['Tataouine', 'Ghomrassen', 'Remada']
  };

  filteredCities: string[] = [];
  map: any;
  consultMap: any;
  marker: any;
  showMapConsult = false;
  viewingMapWarehouse: any = null;

  roomForm = {
    name: '',
    description: '',
    type: '',
    capacity_volume: '',
    status: 'active'
  };

  locationForm = {
    code: '',
    name: '',
    description: '',
    type: '',
    capacity_units: '',
    status: 'active'
  };

  cabinetForm = {
    code: '',
    name: '',
    description: '',
    status: 'active'
  };


  constructor(
    private cdr: ChangeDetectorRef,
    @Inject(PLATFORM_ID) private platformId: Object,
    private warehouseService: AdminWarehouseService,
    private router: Router
  ) { }

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.loadWarehouses();
  }

  /* ─── Warehouses Management ─── */

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
        this.errorMessage = 'Impossible de charger les dépôts.';
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
    this.showWarehouseModal = true;
    setTimeout(() => this.initMap(), 300);
  }

  openEditWarehouseModal(warehouse: any): void {
    this.editingWarehouseId = warehouse.id;
    this.warehouseForm = {
      name: warehouse.name || '',
      description: warehouse.description || '',
      address: warehouse.address || '',
      city: warehouse.city || '',
      governorate: warehouse.governorate || '',
      latitude: warehouse.latitude ? Number(warehouse.latitude) : null,
      longitude: warehouse.longitude ? Number(warehouse.longitude) : null,
      phone: warehouse.phone || '',
      status: warehouse.status || 'active'
    };
    this.updateCities();
    this.showWarehouseModal = true;
    setTimeout(() => this.initMap(), 300);
  }

  updateCities(): void {
    const gov = this.warehouseForm.governorate;
    this.filteredCities = gov ? (this.citiesMap[gov] || []) : [];
    if (this.filteredCities.length > 0 && !this.filteredCities.includes(this.warehouseForm.city)) {
      // Don't reset if it's already a valid city (for editing)
      // but if we changed governorate, we might want to reset?
      // Let's keep existing if valid, else empty
    }
  }

  onGovernorateChange(): void {
    this.updateCities();
    this.warehouseForm.city = ''; // Reset city when gov changes

    // Center map on governorate (approximate coordinates)
    const coordinatesMap: { [key: string]: [number, number] } = {
      'Tunis': [36.8065, 10.1815],
      'Ariana': [36.8625, 10.1956],
      'Ben Arous': [36.7531, 10.2222],
      'Manouba': [36.8078, 10.0864],
      'Nabeul': [36.4561, 10.7335],
      'Zaghouan': [36.4029, 10.1429],
      'Bizerte': [37.2744, 9.8739],
      'Béja': [36.7256, 9.1817],
      'Jendouba': [36.5011, 8.7802],
      'Le Kef': [36.1822, 8.7147],
      'Siliana': [36.0847, 9.3708],
      'Kairouan': [35.6781, 10.0963],
      'Kasserine': [35.1675, 8.8317],
      'Sidi Bouzid': [35.0382, 9.4849],
      'Sousse': [35.8256, 10.6369],
      'Monastir': [35.7833, 10.8333],
      'Mahdia': [35.5047, 11.0622],
      'Sfax': [34.7406, 10.7603],
      'Gafsa': [34.4250, 8.7842],
      'Tozeur': [33.9197, 8.1335],
      'Kebili': [33.7043, 8.9690],
      'Gabès': [33.8814, 10.0983],
      'Medenine': [33.3549, 10.5055],
      'Tataouine': [32.9297, 10.4518]
    };

    if (this.map && this.warehouseForm.governorate) {
      const coords = coordinatesMap[this.warehouseForm.governorate];
      if (coords) {
        this.map.setView(coords, 10);
        this.marker.setLatLng(coords);
        this.warehouseForm.latitude = coords[0];
        this.warehouseForm.longitude = coords[1];
      }
    }
  }

  initMap(lat = 36.8065, lng = 10.1815): void {
    if (typeof L === 'undefined') {
      console.error('Leaflet not loaded');
      return;
    }

    if (this.map) {
      this.map.remove();
    }

    // Fix for default marker icons in Angular
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
        attribution: '© OpenStreetMap'
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

      // Crucial: invalidateSize after initialization in a modal
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

    // Force Change Detection to ensure the modal and its #consultMap are in the DOM
    this.cdr.detectChanges();

    // Small delay to let browser finish rendering the new DOM element
    setTimeout(() => {
      this.retryInitConsultMap(warehouse, 0);
    }, 100);
  }

  private retryInitConsultMap(warehouse: any, count: number): void {
    const container = document.getElementById('consultMap');
    if (!container) {
      if (count < 10) { // Try for up to ~1 second
        setTimeout(() => this.retryInitConsultMap(warehouse, count + 1), 100);
      } else {
        console.error('Map container #consultMap still not found after multiple retries.');
      }
      return;
    }
    this.initializeConsultMap(warehouse);
  }

  private initializeConsultMap(warehouse: any): void {
    try {
      if (this.consultMap) {
        this.consultMap.remove();
        this.consultMap = null;
      }

      const lat = warehouse.latitude ? Number(warehouse.latitude) : 36.8065;
      const lng = warehouse.longitude ? Number(warehouse.longitude) : 10.1815;

      this.consultMap = L.map('consultMap').setView([lat, lng], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
      }).addTo(this.consultMap);

      if (warehouse.latitude && warehouse.longitude) {
        L.marker([lat, lng]).addTo(this.consultMap)
          .bindPopup(`<b>${warehouse.name}</b><br>${warehouse.governorate}, ${warehouse.city}`).openPopup();
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
    this.resetWarehouseForm();
  }

  saveWarehouse(): void {
    if (!this.warehouseForm.name) {
      this.errorMessage = 'Le nom du dépôt est obligatoire.';
      return;
    }

    this.errorMessage = '';

    const req$ = this.editingWarehouseId
      ? this.warehouseService.updateWarehouse(this.editingWarehouseId, this.warehouseForm)
      : this.warehouseService.createWarehouse(this.warehouseForm);

    req$.subscribe({
      next: () => {
        this.successMessage = this.editingWarehouseId ? 'Dépôt mis à jour !' : 'Dépôt créé !';
        this.closeWarehouseModal();
        this.loadWarehouses();
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || 'Erreur de sauvegarde.';
        this.cdr.detectChanges();
      }
    });
  }

  deleteWarehouse(id: number): void {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce dépôt ?')) return;

    this.warehouseService.deleteWarehouse(id).subscribe({
      next: () => {
        this.successMessage = 'Dépôt supprimé !';
        this.loadWarehouses();
        this.selectedWarehouse = null;
        this.rooms = [];
        this.locations = [];
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || 'Impossible de supprimer ce dépôt.';
        this.cdr.detectChanges();
      }
    });
  }

  resetWarehouseForm(): void {
    this.warehouseForm = {
      name: '',
      description: '',
      address: '',
      city: '',
      governorate: '',
      latitude: null,
      longitude: null,
      phone: '',
      status: 'active'
    };
  }

  search(): void {
    this.loadWarehouses();
  }

  /* ─── Rooms Management ─── */

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
      this.errorMessage = 'Veuillez sélectionner un dépôt d\'abord.';
      return;
    }
    this.resetRoomForm();
    this.editingRoomId = null;
    this.showRoomModal = true;
  }

  openEditRoomModal(room: any): void {
    this.editingRoomId = room.id;
    this.roomForm = {
      name: room.name || '',
      description: room.description || '',
      type: room.type || '',
      capacity_volume: room.capacity_volume || '',
      status: room.status || 'active'
    };
    this.showRoomModal = true;
  }

  closeRoomModal(): void {
    this.showRoomModal = false;
    this.resetRoomForm();
  }

  saveRoom(): void {
    if (!this.roomForm.name) {
      this.errorMessage = 'Le nom de la salle est obligatoire.';
      return;
    }

    if (!this.selectedWarehouse) {
      this.errorMessage = 'Dépôt non sélectionné.';
      return;
    }

    this.errorMessage = '';

    const payload = {
      warehouse_id: this.selectedWarehouse.id,
      ...this.roomForm
    };

    const req$ = this.editingRoomId
      ? this.warehouseService.updateRoom(this.editingRoomId, payload)
      : this.warehouseService.createRoom(payload);

    req$.subscribe({
      next: () => {
        this.successMessage = this.editingRoomId ? 'Salle mise à jour !' : 'Salle créée !';
        this.closeRoomModal();
        this.loadRooms();
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || 'Erreur de sauvegarde.';
        this.cdr.detectChanges();
      }
    });
  }

  deleteRoom(id: number): void {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette salle ?')) return;

    this.warehouseService.deleteRoom(id).subscribe({
      next: () => {
        this.successMessage = 'Salle supprimée !';
        this.loadRooms();
        this.selectedRoom = null;
        this.locations = [];
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || 'Impossible de supprimer cette salle.';
        this.cdr.detectChanges();
      }
    });
  }

  resetRoomForm(): void {
    this.roomForm = {
      name: '',
      description: '',
      type: '',
      capacity_volume: '',
      status: 'active'
    };
  }

  /* ─── Locations Management ─── */

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
      this.errorMessage = 'Veuillez sélectionner une salle d\'abord.';
      return;
    }
    this.resetLocationForm();
    this.editingLocationId = null;
    this.showLocationModal = true;
  }

  openEditLocationModal(location: any): void {
    this.editingLocationId = location.id;
    this.locationForm = {
      code: location.code || '',
      name: location.name || '',
      description: location.description || '',
      type: location.type || '',
      capacity_units: location.capacity_units || '',
      status: location.status || 'active'
    };
    this.showLocationModal = true;
  }

  closeLocationModal(): void {
    this.showLocationModal = false;
    this.resetLocationForm();
  }

  saveLocation(): void {
    if (!this.locationForm.code || !this.locationForm.name) {
      this.errorMessage = 'Le code et le nom de l\'emplacement sont obligatoires.';
      return;
    }

    if (!this.selectedRoom) {
      this.errorMessage = 'Salle non sélectionnée.';
      return;
    }

    this.errorMessage = '';

    const payload = {
      room_id: this.selectedRoom.id,
      ...this.locationForm
    };

    const req$ = this.editingLocationId
      ? this.warehouseService.updateLocation(this.editingLocationId, payload)
      : this.warehouseService.createLocation(payload);

    req$.subscribe({
      next: () => {
        this.successMessage = this.editingLocationId ? 'Emplacement mis à jour !' : 'Emplacement créé !';
        this.closeLocationModal();
        this.loadLocations();
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || 'Erreur de sauvegarde.';
        this.cdr.detectChanges();
      }
    });
  }

  deleteLocation(id: number): void {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet emplacement ?')) return;

    this.warehouseService.deleteLocation(id).subscribe({
      next: () => {
        this.successMessage = 'Emplacement supprimé !';
        this.loadLocations();
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || 'Impossible de supprimer cet emplacement.';
        this.cdr.detectChanges();
      }
    });
  }

  resetLocationForm(): void {
    this.locationForm = {
      code: '',
      name: '',
      description: '',
      type: '',
      capacity_units: '',
      status: 'active'
    };
  }

  /* ─── Cabinets (Armoires) ─── */

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
      this.errorMessage = 'Veuillez sélectionner une salle d\'abord.';
      return;
    }
    this.resetCabinetForm();
    this.editingCabinetId = null;
    this.showCabinetModal = true;
  }

  openEditCabinetModal(cabinet: any): void {
    this.editingCabinetId = cabinet.id;
    this.cabinetForm = {
      code: cabinet.code || '',
      name: cabinet.name || '',
      description: cabinet.description || '',
      status: cabinet.status || 'active'
    };
    this.showCabinetModal = true;
  }

  closeCabinetModal(): void {
    this.showCabinetModal = false;
    this.resetCabinetForm();
  }

  saveCabinet(): void {
    if (!this.selectedRoom) {
      this.errorMessage = 'Salle non sélectionnée.';
      return;
    }

    if (!this.cabinetForm.name) {
      this.errorMessage = 'Le nom de l\'armoire est obligatoire.';
      return;
    }

    this.errorMessage = '';

    const payload = {
      room_id: this.selectedRoom.id,
      ...this.cabinetForm
    };

    const req$ = this.editingCabinetId
      ? this.warehouseService.updateCabinet(this.editingCabinetId, payload)
      : this.warehouseService.createCabinet(payload);

    req$.subscribe({
      next: () => {
        this.successMessage = this.editingCabinetId ? 'Armoire mise à jour !' : 'Armoire créée !';
        this.closeCabinetModal();
        this.loadCabinets();
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || 'Erreur de sauvegarde.';
        this.cdr.detectChanges();
      }
    });
  }

  deleteCabinet(id: number): void {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette armoire ?')) return;

    this.warehouseService.deleteCabinet(id).subscribe({
      next: () => {
        this.successMessage = 'Armoire supprimée !';
        this.loadCabinets();
        setTimeout(() => this.successMessage = '', 3000);
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || 'Impossible de supprimer cette armoire.';
        this.cdr.detectChanges();
      }
    });
  }

  resetCabinetForm(): void {
    this.cabinetForm = {
      code: '',
      name: '',
      description: '',
      status: 'active'
    };
  }

  viewWarehouseProducts(warehouse: any): void {
    this.router.navigate(['/admin/warehouse', warehouse.id, 'products']);
  }

  viewRoomProducts(room: any): void {
    this.router.navigate(['/admin/room', room.id, 'products']);
  }
}
