import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, AlertController, ToastController } from '@ionic/angular';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  deleteDoc,
  updateDoc,
  query,
  where,
} from '@angular/fire/firestore';
import { BehaviorSubject, Observable, combineLatest, map } from 'rxjs';

type ReportStatus = 'pending' | 'verified' | 'resolved' | 'rejected';

interface Report {
  id: string;
  category: string;
  location?: string;
  datetime: number | string | any;
  status: ReportStatus;
  description?: string;
  barangay: string;
  landmark?: string;
  lat?: number;
  lng?: number;
  _dt?: number;
}

@Component({
  selector: 'app-reports',
  templateUrl: './reports.page.html',
  styleUrls: ['./reports.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule],
})
export class ReportsPage {
  role: 'super_admin' | 'barangay_admin' = 'barangay_admin';
  barangay = '';
  barangayOptions = ['All Barangays', 'Carig Sur', 'Carig Norte', 'Linao East', 'Linao West', 'Linao Norte'];
  selectedBarangay = 'All Barangays';
  private barangayFilter$ = new BehaviorSubject<string>('All Barangays');

  activeTab: ReportStatus = 'pending';
  private tab$ = new BehaviorSubject<ReportStatus>('pending');
  searchTerm = '';
  private search$ = new BehaviorSubject<string>('');
  sortOrder: 'asc' | 'desc' = 'desc';
  private sort$ = new BehaviorSubject<'asc' | 'desc'>('desc');

  reports$: Observable<Report[]>;
  filtered$: Observable<Report[]>;

  summaryOpen = false;
  selected: Report | null = null;

  constructor(
    private fs: Firestore,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController
  ) {
    this.role = (localStorage.getItem('role') as any) || 'barangay_admin';
    this.barangay = this.normalizeBarangay(localStorage.getItem('barangay') || 'Carig Sur');

    const colRef = collection(this.fs, 'reports');
    const base = this.role === 'super_admin'
      ? colRef
      : query(colRef, where('barangay', '==', this.barangay));

    this.reports$ = collectionData(base, { idField: 'id' }) as Observable<Report[]>;

    this.filtered$ = combineLatest([
      this.reports$, this.tab$, this.search$, this.sort$, this.barangayFilter$
    ]).pipe(
      map(([rows, tab, q, order, brgySel]) => {
        const term = (q || '').trim().toLowerCase();
        const selected = this.normalizeBarangay(brgySel || 'All Barangays');
        return rows
          .filter(r => (r.status || 'pending') === tab)
          .filter(r =>
            !term
              ? true
              : (r.category || '').toLowerCase().includes(term) ||
                (r.location || '').toLowerCase().includes(term) ||
                (r.landmark || '').toLowerCase().includes(term) ||
                (r.barangay || '').toLowerCase().includes(term) ||
                (r.description || '').toLowerCase().includes(term)
          )
          .filter(r => {
            if (this.role !== 'super_admin') return true;
            if (!selected || selected === 'All Barangays') return true;
            return this.normalizeBarangay(r.barangay || '') === selected;
          })
          .map(r => ({ ...r, _dt: this.toMillis(r.datetime) }))
          .sort((a, b) =>
            order === 'desc' ? (b._dt || 0) - (a._dt || 0) : (a._dt || 0) - (b._dt || 0)
          );
      })
    );
  }

  // ===== Tabs, Filters, and Search =====
  setTab(tab: ReportStatus) { this.activeTab = tab; this.tab$.next(tab); }
  onSearch(q: string) { this.search$.next(q ?? ''); }
  onBarangayChange(v: string) { this.selectedBarangay = v; this.barangayFilter$.next(v || 'All Barangays'); }
  toggleSort() { this.sortOrder = this.sortOrder === 'desc' ? 'asc' : 'desc'; this.sort$.next(this.sortOrder); }

  // ===== Summary Modal =====
  openSummary(r: Report) { this.selected = r; this.summaryOpen = true; }
  closeSummary() { this.summaryOpen = false; this.selected = null; }

  // ===== Confirm Popups =====
  async confirmStatusChange(r: Report, status: ReportStatus) {
    const action = status === 'verified' ? 'verify' : 'reject';
    const alert = await this.alertCtrl.create({
      header: 'Confirmation',
      message: `Are you sure you want to ${action} this report?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Yes',
          handler: () => this.markStatus(r, status),
        },
      ],
    });
    await alert.present();
  }

  async confirmDelete(id: string) {
    const alert = await this.alertCtrl.create({
      header: 'Delete Report',
      message: 'Are you sure you want to permanently delete this report?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: () => this.deleteReport(id),
        },
      ],
    });
    await alert.present();
  }

  // ===== Actions =====
  async markStatus(r: Report, status: ReportStatus) {
    try {
      await updateDoc(doc(this.fs, 'reports', r.id), { status });
      this.toast(`Marked ${status}.`);
      if (this.selected?.id === r.id) this.selected.status = status;
    } catch (e: any) {
      this.toast(e?.message || 'Could not update status.', true);
    }
  }

  async deleteReport(id: string) {
    try {
      await deleteDoc(doc(this.fs, 'reports', id));
      this.toast('Report deleted.');
      this.closeSummary();
    } catch (e: any) {
      this.toast(e?.message || 'Could not delete report.', true);
    }
  }

  // ===== Helpers =====
  private normalizeBarangay(name: string): string {
    const s = (name || '').trim().toLowerCase();
    if (s.startsWith('carig sur')) return 'Carig Sur';
    if (s.startsWith('carig norte')) return 'Carig Norte';
    if (s.startsWith('linao east')) return 'Linao East';
    if (s.startsWith('linao west')) return 'Linao West';
    if (s.startsWith('linao norte')) return 'Linao Norte';
    if (s === 'all barangays' || s === 'all') return 'All Barangays';
    return (name || '').trim();
  }

  private toMillis(dt: any): number {
    if (!dt) return 0;
    if (typeof dt === 'number') return dt < 1e12 ? dt * 1000 : dt;
    if (dt && typeof dt.seconds === 'number')
      return dt.seconds * 1000 + Math.floor((dt.nanoseconds || 0) / 1e6);
    const n = Date.parse(dt);
    return isNaN(n) ? 0 : n;
  }

  dateOnly(dt: any): string {
    const ms = this.toMillis(dt);
    if (!ms) return '—';
    return new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'numeric', day: '2-digit' });
  }

  timeOnly(dt: any): string {
    const ms = this.toMillis(dt);
    if (!ms) return '';
    return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  badgeClass(status?: ReportStatus) {
    const s = status || 'pending';
    return {
      pending: 'badge badge--pending',
      verified: 'badge badge--verified',
      resolved: 'badge badge--resolved',
      rejected: 'badge badge--rejected',
    }[s];
  }

  private async toast(message: string, danger = false) {
    const t = await this.toastCtrl.create({
      message,
      duration: 1500,
      color: danger ? 'danger' : 'dark',
      position: 'bottom',
    });
    await t.present();
  }
}
