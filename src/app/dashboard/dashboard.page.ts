import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { Firestore, collection, collectionData, query, where } from '@angular/fire/firestore';
import { Observable, map } from 'rxjs';

type ReportStatus = 'pending' | 'verified' | 'resolved';

interface Report {
  id: string;
  category: string;
  barangay: string;
  location?: string;
  landmark?: string;
  description?: string;
  status?: ReportStatus;
  datetime?: any; // TS/ISO/ms/s
  lat?: number;
  lng?: number;
  _dt?: number;
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, RouterModule],
})
export class DashboardPage {
  role: 'super_admin' | 'barangay_admin' = 'barangay_admin';
  barangay = '';

  counts$!: Observable<{ total: number; pending: number; verified: number; resolved: number }>;
  recent$!: Observable<Report[]>;
  recentReports$!: Observable<Report[]>; // alias if your HTML uses this name

  constructor(private fs: Firestore) {
    this.role = (localStorage.getItem('role') as any) || 'barangay_admin';
    this.barangay = this.normalizeBarangay(localStorage.getItem('barangay') || '');

    const colRef = collection(this.fs, 'reports');
    const base =
      this.role === 'super_admin'
        ? colRef
        : query(colRef, where('barangay', '==', this.barangay)); // ONLY my barangay

    const reports$ = collectionData(base, { idField: 'id' }) as Observable<Report[]>;

    const mine$ = reports$.pipe(
      map(rows =>
        rows
          .map(r => ({ ...r, _dt: this.toMillis(r.datetime) }))
          .sort((a, b) => (b._dt || 0) - (a._dt || 0))
      )
    );

    this.counts$ = mine$.pipe(
      map(rows => ({
        total: rows.length,
        pending: rows.filter(r => (r.status || 'pending') === 'pending').length,
        verified: rows.filter(r => r.status === 'verified').length,
        resolved: rows.filter(r => r.status === 'resolved').length,
      }))
    );

    this.recent$ = mine$.pipe(map(rows => rows.slice(0, 5)));
    this.recentReports$ = this.recent$;
  }

  private normalizeBarangay(name: string): string {
    const s = (name || '').trim().toLowerCase();
    if (s.startsWith('carig sur'))   return 'Carig Sur';
    if (s.startsWith('carig norte')) return 'Carig Norte';
    if (s.startsWith('linao east'))  return 'Linao East';
    if (s.startsWith('linao west'))  return 'Linao West';
    if (s.startsWith('linao norte')) return 'Linao Norte';
    return (name || '').trim();
  }

  private toMillis(dt: any): number {
    if (!dt) return 0;
    if (typeof dt === 'number') return dt < 1e12 ? dt * 1000 : dt;
    if (dt && typeof dt.seconds === 'number') {
      return dt.seconds * 1000 + Math.floor((dt.nanoseconds || 0) / 1e6);
    }
    const n = Date.parse(dt);
    return isNaN(n) ? 0 : n;
  }

  dateOnly(v: any) { const ms = this.toMillis(v); return ms ? new Date(ms).toLocaleDateString() : '—'; }
  timeOnly(v: any) { const ms = this.toMillis(v); return ms ? new Date(ms).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : ''; }

  badgeClass(status?: ReportStatus) {
    const s = status || 'pending';
    return {
      pending: 'badge badge--pending',
      verified: 'badge badge--verified',
      resolved: 'badge badge--resolved',
    }[s];
  }
}
