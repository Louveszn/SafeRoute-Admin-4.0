import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, AlertController } from '@ionic/angular';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  deleteDoc,
  where,
  query as fsQuery,
} from '@angular/fire/firestore';
import { BehaviorSubject, Observable, combineLatest, map } from 'rxjs';
import { ActivatedRoute } from '@angular/router';

type ReportStatus = 'pending' | 'verified' | 'resolved';
type Tab = 'all' | ReportStatus;

interface Report {
  id: string;
  category: string;
  location?: string;
  datetime: any; // Firestore Timestamp | ISO string | epoch seconds/ms | Date
  status: ReportStatus;
  barangay?: string;
}

@Component({
  selector: 'app-total-incident',
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
  templateUrl: './total-incident.page.html',
  styleUrls: ['./total-incident.page.scss'],
})
export class TotalIncidentPage implements OnInit {
  role: 'super_admin' | 'barangay_admin' = 'barangay_admin';
  barangay = '';

  // ---- UI ----
  activeTab: Tab = 'all';
  searchTerm = '';

  // keep sort API used by your HTML
  sortOrder: 'asc' | 'desc' = 'desc';

  // Super-admin barangay dropdown
  barangayOptions = ['All Barangays', 'Carig Sur', 'Carig Norte', 'Linao East', 'Linao West', 'Linao Norte'];
  selectedBarangay = 'All Barangays';

  // ---- streams ----
  reports$!: Observable<Report[]>;
  filtered$!: Observable<Report[]>;
  counts$!: Observable<{ total: number; pending: number; verified: number; resolved: number }>;

  // ---- controls ----
  private tab$ = new BehaviorSubject<Tab>('all');
  private search$ = new BehaviorSubject<string>('');
  private sort$ = new BehaviorSubject<'asc' | 'desc'>('desc');
  private barangayFilter$ = new BehaviorSubject<string>('All Barangays');

  constructor(
    private fs: Firestore,
    private alertCtrl: AlertController,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    // determine tab from query param
    const qp = (this.route.snapshot.queryParamMap.get('tab') || 'all').toLowerCase();
    this.setTab((['all', 'pending', 'verified', 'resolved'].includes(qp) ? qp : 'all') as Tab);

    // logged-in user
    this.role = (localStorage.getItem('role') as any) || 'barangay_admin';
    this.barangay = this.normalizeBarangay(localStorage.getItem('barangay') || '');

    const ref = collection(this.fs, 'reports');

    // base reports stream
    const base$: Observable<Report[]> =
      this.role === 'super_admin'
        ? (collectionData(ref, { idField: 'id' }) as Observable<Report[]>)
        : (collectionData(fsQuery(ref, where('barangay', '==', this.barangay)), { idField: 'id' }) as Observable<Report[]>);

    this.reports$ = base$;

    // counts summary (from the unfiltered base)
    this.counts$ = this.reports$.pipe(
      map(rows => ({
        total: rows.length,
        pending: rows.filter(r => (r.status || 'pending') === 'pending').length,
        verified: rows.filter(r => r.status === 'verified').length,
        resolved: rows.filter(r => r.status === 'resolved').length,
      }))
    );

    // filtered + sorted + (super admin) barangay dropdown filter
    this.filtered$ = combineLatest([
      this.reports$,
      this.tab$,
      this.search$,
      this.sort$,
      this.barangayFilter$,
    ]).pipe(
      map(([rows, tab, q, dir, brgySel]) => {
        const term = (q || '').toLowerCase().trim();
        const selected = this.normalizeBarangay(brgySel || 'All Barangays');

        let out = rows;

        // tab filter
        if (tab !== 'all') out = out.filter(r => (r.status || 'pending') === tab);

        // search filter
        if (term) {
          out = out.filter(r =>
            (r.category || '').toLowerCase().includes(term) ||
            (r.location || '').toLowerCase().includes(term) ||
            (r.barangay || '').toLowerCase().includes(term)
          );
        }

        // super admin barangay filter
        if (this.role === 'super_admin' && selected && selected !== 'All Barangays') {
          out = out.filter(r => this.normalizeBarangay(r.barangay || '') === selected);
        }

        // sort by time
        out = out
          .map(r => ({ ...r, _ms: this.toMillis(r.datetime) }))
          .sort((a: any, b: any) => (dir === 'desc' ? b._ms - a._ms : a._ms - b._ms));

        return out;
      })
    );
  }

  // ---------- datetime helpers ----------
  private toMillis(dt: any): number {
    if (!dt) return 0;
    if (typeof dt === 'number') return dt < 1e12 ? dt * 1000 : dt;
    if (dt && typeof dt.seconds === 'number')
      return dt.seconds * 1000 + Math.floor((dt.nanoseconds || 0) / 1e6);
    if (typeof dt?.toMillis === 'function') return dt.toMillis();
    if (dt instanceof Date) return dt.getTime();
    if (typeof dt === 'string') {
      const n = Date.parse(dt);
      return isNaN(n) ? 0 : n;
    }
    return 0;
  }

  dateOnly(dt: any): string {
    const ms = this.toMillis(dt);
    if (!ms) return '—';
    return new Date(ms).toLocaleDateString(undefined, {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }

  timeOnly(dt: any): string {
    const ms = this.toMillis(dt);
    if (!ms) return '';
    return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

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

  // ---------- UI actions ----------
  setTab(tab: Tab) {
    this.activeTab = tab;
    this.tab$.next(tab);
  }

  onSearch(v: string) {
    this.searchTerm = v;
    this.search$.next(v);
  }

  // Keep your existing sort control, plus a toggle (used by your HTML)
  setSort(dir: 'asc' | 'desc') {
    this.sortOrder = dir;
    this.sort$.next(dir);
  }
  toggleSort() {
    this.sortOrder = this.sortOrder === 'desc' ? 'asc' : 'desc';
    this.sort$.next(this.sortOrder);
  }

  // Dropdown handler used by your HTML
  onBarangayChange(v: string) {
    this.selectedBarangay = v || 'All Barangays';
    this.barangayFilter$.next(this.selectedBarangay);
  }

  statusBadgeClass(status: ReportStatus) {
    return {
      pending: status === 'pending',
      verified: status === 'verified',
      resolved: status === 'resolved',
    };
  }

  async deleteReport(id: string) {
    const alert = await this.alertCtrl.create({
      header: 'Delete Report',
      message: 'Are you sure you want to delete this report?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: async () => {
            // fixed path
            await deleteDoc(doc(this.fs, 'reports', id));
          },
        },
      ],
    });
    await alert.present();
  }
}
