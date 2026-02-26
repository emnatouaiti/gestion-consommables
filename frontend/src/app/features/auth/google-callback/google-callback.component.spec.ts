import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';

import { GoogleCallbackComponent } from './google-callback.component';
import { AuthService } from '../../../core/services/auth.service';

describe('GoogleCallbackComponent', () => {
  let component: GoogleCallbackComponent;
  let fixture: ComponentFixture<GoogleCallbackComponent>;

  const authServiceMock = {
    handleGoogleCallback: jasmine.createSpy('handleGoogleCallback')
  };

  const routerMock = {
    navigate: jasmine.createSpy('navigate')
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [GoogleCallbackComponent],
      providers: [
        { provide: AuthService, useValue: authServiceMock },
        { provide: Router, useValue: routerMock },
        { provide: ActivatedRoute, useValue: { queryParams: of({ token: 'abc' }) } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(GoogleCallbackComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
