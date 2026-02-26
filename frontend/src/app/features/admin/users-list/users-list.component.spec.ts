import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { FormsModule } from '@angular/forms';
import { of } from 'rxjs';

import { UsersListComponent } from './users-list.component';
import { AdminUsersService } from '../services/admin-users.service';

describe('UsersListComponent', () => {
  let component: UsersListComponent;
  let fixture: ComponentFixture<UsersListComponent>;

  const adminUsersServiceMock = {
    list: jasmine.createSpy('list').and.returnValue(of([])),
    delete: jasmine.createSpy('delete').and.returnValue(of({}))
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [UsersListComponent],
      imports: [RouterTestingModule, FormsModule],
      providers: [{ provide: AdminUsersService, useValue: adminUsersServiceMock }]
    }).compileComponents();

    fixture = TestBed.createComponent(UsersListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
