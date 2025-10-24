// super-admin.page.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SuperadminPage } from './superadmin.page';

describe('SuperAdminPage', () => {
  let component: SuperadminPage;
  let fixture: ComponentFixture<SuperadminPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(SuperadminPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
