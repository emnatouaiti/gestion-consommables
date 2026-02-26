import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { of } from 'rxjs';
import { ConsumableRequestComponent } from './consumable-request';
import { ConsumableRequestService } from '../services/consumable-request.service';
import { AuthService } from '../core/services/auth.service';
import { ActivatedRoute } from '@angular/router';

describe('ConsumableRequestComponent', () => {
  let component: ConsumableRequestComponent;
  let fixture: ComponentFixture<ConsumableRequestComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConsumableRequestComponent],
      providers: [
        {
          provide: ConsumableRequestService,
          useValue: {
            getProducts: () => of([]),
            getRequests: () => of([]),
            createRequest: () => of({}),
            approveRequest: () => of({}),
            rejectRequest: () => of({})
          }
        },
        {
          provide: AuthService,
          useValue: {
            getCurrentUser: () => of({ roles: [{ name: 'utilisateur' }] }),
            userHasAnyRole: () => false
          }
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              data: {
                mode: 'request'
              }
            }
          }
        },
        {
          provide: PLATFORM_ID,
          useValue: 'browser'
        }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ConsumableRequestComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
