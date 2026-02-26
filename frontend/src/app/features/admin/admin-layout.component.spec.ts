import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { AdminLayoutComponent } from './admin-layout.component';
import { AuthService } from '../../core/services/auth.service';

describe('AdminLayoutComponent', () => {
  let component: AdminLayoutComponent;
  let fixture: ComponentFixture<AdminLayoutComponent>;

  const authServiceMock = {
    logout: jasmine.createSpy('logout'),
    getCurrentUserSnapshot: jasmine.createSpy('getCurrentUserSnapshot').and.returnValue(null),
    getCurrentUser: jasmine.createSpy('getCurrentUser').and.returnValue(of(null)),
    userHasAnyRole: jasmine.createSpy('userHasAnyRole').and.returnValue(false),
    getUserRoles: jasmine.createSpy('getUserRoles').and.returnValue([])
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AdminLayoutComponent],
      imports: [RouterTestingModule],
      providers: [{ provide: AuthService, useValue: authServiceMock }]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminLayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
