import { Routes } from '@angular/router';
import { MainLayoutComponent } from './main-layout/main-layout.component';
import { superAdminCanMatch } from './guards/superadmin.guard'; 

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./login/login.page').then(m => m.LoginPage),
  },
  {
    path: '',
    component: MainLayoutComponent,
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./dashboard/dashboard.page').then(m => m.DashboardPage),
      },
      {
        path: 'total-incidents',
        loadComponent: () => import('./total-incident/total-incident.page').then(m => m.TotalIncidentPage),
      },
      {
        path: 'reports',
        loadComponent: () => import('./reports/reports.page').then(m => m.ReportsPage),
      },
      {
        path: 'zones',
        loadComponent: () => import('./zones/zones.page').then(m => m.ZonesPage),
      },
      {
        path: 'contacts',
        loadComponent: () => import('./contacts/contacts.page').then(m => m.ContactsPage),
      },
      {
        path: 'superadmin',
        canMatch: [superAdminCanMatch], 
        loadComponent: () => import('./superadmin/superadmin.page').then(m => m.SuperadminPage),
      },
    ],
  },
];
