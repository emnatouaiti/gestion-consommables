import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { UserFormComponent } from './user-form.component';
import { AdminUsersService } from '../services/admin-users.service';

describe('UserFormComponent', () => {
  let component: UserFormComponent;
  let fixture: ComponentFixture<UserFormComponent>;

  const adminUsersServiceMock = {
    get: jasmine.createSpy('get').and.returnValue(of({})),
    roles: jasmine.createSpy('roles').and.returnValue(of([])),
    update: jasmine.createSpy('update').and.returnValue(of({})),
    create: jasmine.createSpy('create').and.returnValue(of({}))
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [UserFormComponent],
      imports: [ReactiveFormsModule, RouterTestingModule],
      providers: [
        { provide: AdminUsersService, useValue: adminUsersServiceMock },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => null } } }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(UserFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
