import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { of } from 'rxjs';

import { ArchivedUsersComponent } from './archived-users.component';
import { AdminUsersService } from '../services/admin-users.service';

describe('ArchivedUsersComponent', () => {
  let component: ArchivedUsersComponent;
  let fixture: ComponentFixture<ArchivedUsersComponent>;

  const adminUsersServiceMock = {
    listArchived: jasmine.createSpy('listArchived').and.returnValue(of([])),
    restore: jasmine.createSpy('restore').and.returnValue(of({})),
    forceDelete: jasmine.createSpy('forceDelete').and.returnValue(of({}))
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ArchivedUsersComponent],
      imports: [FormsModule],
      providers: [{ provide: AdminUsersService, useValue: adminUsersServiceMock }]
    }).compileComponents();

    fixture = TestBed.createComponent(ArchivedUsersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
