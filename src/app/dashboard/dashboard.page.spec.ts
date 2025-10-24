import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Router } from '@angular/router';
import { Firestore, collection, collectionData } from '@angular/fire/firestore';
import { Observable, of, map } from 'rxjs';

type ReportStatus = 'pending' | 'verified' | 'resolved';

interface Report {
  id: string;
  category: string;
  location: string;
  datetime: any;                // number | Firestore Timestamp | Date
  status: ReportStatus;
}

interface Counts {
  total: number;
  pending: number;
  verified: number;
  resolved: number;
}

interface DisplayReport {
  id: string;
  category: string;
  location: string;
  status: ReportStatus;
  dateStr: string;
  ms: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
})
export class DashboardPage implements OnInit {
  // renamed: reports$, counts$, recent$ -> reports, counts, recent
  public reports: Observable<Report[]> = of([]);
  public counts: Observable<Counts> = of({ total: 0, pending: 0, verified: 0, resolved: 0 });
  public recent: Observable<DisplayReport[]> = of([]);

  constructor(private fs: Firestore, private router: Router) {}

  ngOnInit(): void {
    const ref = collection(this.fs, 'reports');
    this.reports = collectionData(ref, { idField: 'id' }) as Observable<Report[]>;

    this.counts = this.reports.pipe(
      map(rows => ({
        total: rows.length,
        pending: rows.filter(r => (r.status ?? 'pending') === 'pending').length,
        verified: rows.filter(r => r.status === 'verified').length,
        resolved: rows.filter(r => r.status === 'resolved').length,
      }))
    );

    this.recent = this.reports.pipe(
      map(rows =>
        rows
          .map(r => this.toDisplay(r))
          .sort((a, b) => b.ms - a.ms)
          .slice(0, 5)
      )
    );
  }

  // navigation for Total Incidents
  goToTotalIncidents(): void {
    this.router.navigate(['/total-incidents']);
  }

  // ---------- helpers ----------
  private toMs(dt: any): number {
    if (!dt) return 0;
    if (typeof dt === 'number') return dt;
    if (typeof dt.toMillis === 'function') return dt.toMillis();
    if (dt instanceof Date) return dt.getTime();
    return 0;
  }

  private fmt(ms: number): string {
    if (!ms) return '';
    return new Date(ms).toLocaleString(undefined, {
      month: 'long', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit'
    });
  }

  private toDisplay(r: Report): DisplayReport {
    const ms = this.toMs(r.datetime);
    return {
      id: r.id,
      category: r.category ?? '',
      location: r.location ?? '',
      status: (r.status ?? 'pending') as ReportStatus,
      dateStr: this.fmt(ms),
      ms,
    };
  }
}
