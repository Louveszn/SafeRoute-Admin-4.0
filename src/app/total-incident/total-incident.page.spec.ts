import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TotalIncidentPage } from './total-incident.page';

describe('TotalIncidentPage', () => {
  let component: TotalIncidentPage;
  let fixture: ComponentFixture<TotalIncidentPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(TotalIncidentPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
