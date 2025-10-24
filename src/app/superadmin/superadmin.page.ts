// src/app/superadmin/superadmin.page.ts
import { Component, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, AlertController } from '@ionic/angular';
import * as L from 'leaflet';
import {
  Firestore,
  collection,
  collectionData,
  where,
  query as fsQuery,
  Timestamp,
} from '@angular/fire/firestore';

type ReportStatus = 'pending' | 'verified' | 'resolved';
interface ReportDoc {
  id?: string;
  category?: string;
  description?: string;
  barangay?: string;
  datetime?: any;
  createdAt?: any;
  lat?: number | string;
  lng?: number | string;
  status?: ReportStatus;
  color?: string;
  severity?: number;
  landmark?: string;
  resolvedAt?: any;
}

type PointEx = {
  id?: string;
  lat: number;
  lng: number;
  color: string;
  category?: string;
  when?: Date;
  barangay?: string;
  landmark?: string;
  description?: string;
  status?: ReportStatus;
  severity?: number;
  datetime?: Date | string | null;
  resolvedAt?: Date | null;
};

type ClusterEx = { center: { lat: number; lng: number }; points: PointEx[] };

@Component({
  selector: 'app-superadmin',
  templateUrl: './superadmin.page.html',
  styleUrls: ['./superadmin.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule],
})
export class SuperadminPage implements AfterViewInit, OnDestroy {
  private map!: L.Map;
  private canvasRenderer!: L.Canvas;
  private popup!: L.Popup;

  private outlineLayer = L.layerGroup();
  private clusterLayer = L.layerGroup();
  private dotsLayer = L.layerGroup();
  private halosLayer = L.layerGroup();

  private SHOW_POINTS = true;
  private HALO_RADIUS_M = 40;
  private _rafId: number | null = null;


  private _renderSeq = 0;
  private reportsSub: any;

  selected = new Set<string>();
  selectedBarangay: string = 'All';
  barangayList: string[] = [
    'All',
    'Carig Sur',
    'Carig Norte',
    'Linao East',
    'Linao West',
    'Linao Norte'
  ];

  private allReports: ReportDoc[] = [];

  private readonly CLUSTER_RADIUS_M = 235;

  private readonly SCORE_WEIGHTS = {
    count: 0.20,
    compact: 0.24,
    severity: 0.38,
    recency: 0.18,
  };

  private readonly RESOLVED_SEVERITY_MULT = 0.37;
  private readonly VISIBLE_FLOOR = 0.0;

  private catColor: Record<string, string> = {
    Theft: '#0041c2',
    Assault: '#ffa500',
    Flood: '#87ceeb',
    'Car Accident': '#ee4b2b',
    'Blocked Lane': '#e5e500',
    Kidnapping: '#6a329f',
    Fire: '#dc4d01',
    'Animal Attack': '#964b00',
    Robbery: '#06402b'
  };

  constructor(private fs: Firestore, private alertCtrl: AlertController) {}

  ngAfterViewInit(): void {
    this.map = L.map('map', { zoomControl: true, attributionControl: true })
      .setView([17.6333, 121.7220], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(this.map);

    this.canvasRenderer = L.canvas({ padding: 0.25 });
    this.popup = L.popup({ maxWidth: 320, autoPan: true });

    this.outlineLayer.addTo(this.map);
    this.clusterLayer.addTo(this.map);
    this.dotsLayer.addTo(this.map);
    this.halosLayer.addTo(this.map);


    this.fitAllBarangays();
    this.subscribeReports();
  }

  ngOnDestroy(): void {
    this.reportsSub?.unsubscribe?.();
    if (this.map) this.map.remove();
    if (this._rafId) cancelAnimationFrame(this._rafId);
  }

  /* ---------------- Firestore ---------------- */
  private subscribeReports() {
    const q = fsQuery(
      collection(this.fs, 'reports'),
      where('status', 'in', ['verified', 'resolved'])
    );

    this.reportsSub?.unsubscribe?.();
    this.reportsSub = collectionData(q, { idField: 'id' }).subscribe({
      next: (rows: any[]) => {
        this.allReports = rows as ReportDoc[];
        this.render();
      },
      error: (e: any) => console.error('superadmin reports error', e),
    });
  }

  /* ---------------- Barangay polygons ---------------- */
  private POLYGONS: Record<string, [number, number][]> = {
    'Carig Sur': [
      [17.66301947673273, 121.73118056780248],
      [17.650777604730315, 121.7363049725038],
      [17.648095285699988, 121.74142937724469],
      [17.646994835565994, 121.7474198785615],
      [17.647613839593724, 121.75781303747257],
      [17.64630705081782, 121.76113307434694],
      [17.65634844734729, 121.76726792509308],
      [17.662056662792782, 121.7737636494125],
      [17.671068730302334, 121.75253549600292],
    ],
    'Carig Norte': [
      [17.671624175550466, 121.75279319559237],
      [17.672237528276824, 121.74996078301383],
      [17.67332111298083, 121.74805105029046],
      [17.671787736482027, 121.74712837043535],
      [17.681661811641, 121.73468332259671],
      [17.68650365860692, 121.741034546962],
      [17.685115906896026, 121.74414498449481],
      [17.685313, 121.757698],
      [17.683964, 121.765294],
      [17.685068, 121.772676],
      [17.684542, 121.779993],
      [17.664244, 121.770551],
    ],
    'Linao East': [
      [17.653743857017393, 121.73299772466706],
      [17.649092512763534, 121.71937432688945],
      [17.645146066156926, 121.72080126212546],
      [17.6462195899607, 121.7286011259559],
      [17.646833029272294, 121.7316266578886],
      [17.65229853844148, 121.73136629557996],
      [17.65253368248669, 121.73312582478904],
    ],
    'Linao West': [
      [17.648167710601882, 121.7070070603481],
      [17.66948759569577, 121.71155406737171],
      [17.653029482477105, 121.72105254734704],
      [17.64898010205808, 121.71935316957513],
      [17.648167710601882, 121.7070070603481],
    ],
    'Linao Norte': [
      [17.653767069733973, 121.73300244317701],
      [17.677981484640267, 121.72552487289595],
      [17.66942999982645, 121.7115730269331],
      [17.653057626072606, 121.7210653878961],
    ],
  };

  private getPolygonBounds(name: string): L.LatLngBounds | null {
    const coords = this.POLYGONS[name];
    if (!coords || coords.length < 3) return null;
    return L.latLngBounds(coords.map(([lat, lng]) => L.latLng(lat, lng)));
  }

  private fitBarangay(name: string) {
    const b = this.getPolygonBounds(name);
    if (b) this.map.fitBounds(b.pad(0.05));
  }

  private fitAllBarangays() {
    let union: L.LatLngBounds | null = null;
    for (const name of Object.keys(this.POLYGONS)) {
      const b = this.getPolygonBounds(name);
      if (!b) continue;
      union = union ? union.extend(b) : b;
    }
    if (union) this.map.fitBounds(union.pad(0.06));
  }

  /* ---------------- Rendering ---------------- */
  toggleCategory(cat: string) {
    if (this.selected.has(cat)) this.selected.delete(cat);
    else this.selected.add(cat);
    this.render();
  }

  isSelected(cat: string): boolean {
  return this.selected.has(cat);
}

  onBarangayChange() {
    this.render();
    if (this.selectedBarangay === 'All') this.fitAllBarangays();
    else this.fitBarangay(this.selectedBarangay);
  }

  private render() {
    const seq = ++this._renderSeq;
    this.clusterLayer.clearLayers();
    this.dotsLayer.clearLayers();
    this.outlineLayer.clearLayers();

    // Draw outlines
    Object.entries(this.POLYGONS).forEach(([name, coords]) => {
      if (!coords || coords.length < 3) return;
      const isSelected = this.selectedBarangay === name;
      L.polygon(coords, {
        color: '#ff4d4f',
        dashArray: isSelected ? '' : '6 6',
        weight: 2,
        fillColor: '#ffb3b6',
        fillOpacity: isSelected ? 0.35 : 0.05,
        renderer: this.canvasRenderer,
        interactive: false,
      }).addTo(this.outlineLayer);
    });

    const hasFilter = this.selected.size > 0;
    const points: PointEx[] = [];

    for (const r of this.allReports) {
      if (this.selectedBarangay !== 'All' && (r.barangay || '').trim() !== this.selectedBarangay) continue;
      if (hasFilter && (!r.category || !this.selected.has(r.category))) continue;
      const c = this.coordsOf(r);
      if (!c) continue;

      const color = this.catColor[r.category || 'Others'] || '#6b7280';
      const when = this.toDate(r.datetime) || this.toDate((r as any).createdAt);
      const resolvedAt = this.toDate((r as any).resolvedAt);

      points.push({
        id: r.id,
        lat: c.lat,
        lng: c.lng,
        color,
        category: r.category,
        when,
        datetime: when || null,
        severity: this.incidentScore(r.category || ''),
        barangay: r.barangay,
        landmark: r.landmark,
        description: r.description,
        status: r.status,
        resolvedAt,
      });
    }

    this.renderAllBarangayClusters(points);
    this.drawDots(points, seq);
  }

  private renderAllBarangayClusters(points: PointEx[]) {
    const barangayGroups = new Map<string, PointEx[]>();
    points.forEach(p => {
      const barangay = p.barangay || 'Unknown';
      if (!barangayGroups.has(barangay)) barangayGroups.set(barangay, []);
      barangayGroups.get(barangay)!.push(p);
    });

    barangayGroups.forEach((barangayPoints) => {
      const clusters = this.kmeansByProximity(barangayPoints, this.CLUSTER_RADIUS_M, 2);
      this.drawClusters(clusters, this._renderSeq);
    });
  }

  /* ---------------- Clustering Logic (same as zones) ---------------- */
  private kmeansByProximity(points: PointEx[], radiusM = 235, minPts = 2): ClusterEx[] {
    const n = points.length;
    if (n < minPts) return [];

    const parent = Array.from({ length: n }, (_, i) => i);
    const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
    const unite = (a: number, b: number) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[rb] = ra; };

    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++)
        if (this.haversine(points[i].lat, points[i].lng, points[j].lat, points[j].lng) <= radiusM)
          unite(i, j);

    const bins = new Map<number, PointEx[]>();
    for (let i = 0; i < n; i++) { const r = find(i); if (!bins.has(r)) bins.set(r, []); bins.get(r)!.push(points[i]); }

    const clusters: ClusterEx[] = [];
    for (const pts of bins.values()) {
      if (pts.length < minPts) continue;
      const { toXY, toLL } = this.llToXYFactory(pts);
      let cx = 0, cy = 0;
      for (const p of pts) { const v = toXY(p.lat, p.lng); cx += v.x; cy += v.y; }
      cx /= pts.length; cy /= pts.length;
      const center = toLL(cx, cy);
      clusters.push({ center, points: pts });
    }
    return clusters;
  }

  /* ---------------- Scoring (same as zones) ---------------- */
  private incidentScore(category: string): number {
    switch ((category || '').toLowerCase()) {
      case 'assault': return 5.25;
      case 'theft': return 3.40;
      case 'fire': return 3.40;
      case 'car accident': return 5.80;
      case 'blocked lane': return 2.20;
      case 'flood': return 6.60;
      case 'kidnapping': return 2.00;
      case 'animal attack': return 3.00;
      case 'robbery': return 1.80;
      default: return 1;
    }
  }

  private effectiveSeverity(p: PointEx): number {
    const base = this.incidentScore(p.category || '');
    if (p.status !== 'resolved') return Math.round(base * 10) / 10;

    const resolvedDate = p.when;
    if (!resolvedDate) return Math.round(base * 10) / 10;

    const today = new Date();
    const daysSinceResolved = Math.floor((today.getTime() - new Date(resolvedDate).getTime()) / (1000 * 3600 * 24));
    const periodsPassed = Math.floor(daysSinceResolved / 8);
    const severityReductionMultiplier = Math.pow(this.RESOLVED_SEVERITY_MULT, periodsPassed);
    const effectiveSeverity = base * severityReductionMultiplier;
    return Math.round(effectiveSeverity * 10) / 10;
  }

  private pointWeight(p: PointEx): number {
    const effectiveSeverity = this.effectiveSeverity(p);
    return Math.min(Math.max(effectiveSeverity / 10, 0.05), 1);
  }

  /* ---------- Normalizers (from zones) ---------- */
  private normCount(v: number): number {
    const COUNT_SAT = 10;
    return Math.min(v / COUNT_SAT, 1);
  }

  private normCompact(avgDist: number): number {
    const COMPACT_SAT_M = this.CLUSTER_RADIUS_M;
    return Math.max(0, 1 - (avgDist / COMPACT_SAT_M));
  }

  private normSeverity(avgSeverity: number): number {
    return Math.min(Math.max(avgSeverity / 10, 0), 1);
  }

  private normRecency(avgAgeDays: number): number {
    return Math.max(0, 1 - Math.min(avgAgeDays / 30, 1));
  }
// ---------------- Draw individual incident dots with halos ----------------
private drawDots(points: PointEx[], seq: number) {
  this.halosLayer.clearLayers();
  this.dotsLayer.clearLayers();

  if (this.SHOW_POINTS) {
    const CHUNK = 400;
    let i = 0;
    const len = points.length;

    const drawChunk = () => {
      if (seq !== this._renderSeq) return;
      const end = Math.min(i + CHUNK, len);
      for (; i < end; i++) {
        const p = points[i];

        // Outer halo
        L.circle([p.lat, p.lng], {
          radius: this.HALO_RADIUS_M,
          color: p.status === 'resolved' ? '#88e788' : p.color,
          fillColor: p.color,
          fillOpacity: 0.12,
          weight: 3,
          interactive: false,
          renderer: this.canvasRenderer,
        }).addTo(this.halosLayer);

        // Main dot
        const dot = L.circleMarker([p.lat, p.lng], {
          radius: 12,
          weight: 3,
          color: '#ffffff',
          fillColor: p.status === 'resolved' ? '#88e788' : p.color,
          fillOpacity: 1,
          renderer: this.canvasRenderer,
        }).addTo(this.dotsLayer);

        // Popup
        dot.on('click', () => {
          const html = this.buildReportPopup(p);
          this.popup.setLatLng(dot.getLatLng()).setContent(html);
          this.map.openPopup(this.popup);
        });
      }
      if (i < len) this._rafId = requestAnimationFrame(drawChunk);
      else this._rafId = null;
    };

    drawChunk();
  } else {
    this._rafId = null;
  }
}

  /* ---------------- Draw Clusters (same as zones) ---------------- */
private drawClusters(clusters: ClusterEx[], seqCheck: number) {
    if (!clusters.length) return;

    type Scored = { c: ClusterEx; count: number; avgD: number; avgSeverity: number; avgAgeDays: number; score: number; };

    const scored: Scored[] = clusters.map(c => {
      const ws = c.points.map(p => this.pointWeight(p));
      const sumW = ws.reduce((a, b) => a + b, 0) || 1;

      const wCount = Math.min(sumW, 8);
      const avgD = c.points.reduce((s, p, i) => s + ws[i] * this.haversine(p.lat, p.lng, c.center.lat, c.center.lng), 0) / sumW;
      const avgSeverity = c.points.reduce((s, p, i) => s + ws[i] * this.effectiveSeverity(p), 0) / sumW;
      const now = Date.now();
      const avgAgeDays = c.points.reduce((s, p, i) => {
        const raw = (p.datetime as any) || p.when || new Date();
        const d = new Date(raw as any).getTime();
        return s + ws[i] * ((now - d) / (1000 * 60 * 60 * 24));
      }, 0) / sumW;

      const sCount = this.normCount(wCount);
      const sCompact = this.normCompact(avgD);
      const sSeverity = this.normSeverity(avgSeverity);
      const sRecency = this.normRecency(avgAgeDays);

      const W = this.SCORE_WEIGHTS;
      const score = W.count * sCount + W.compact * sCompact + W.severity * sSeverity + W.recency * sRecency;

      return { c, count: c.points.length, avgD, avgSeverity, avgAgeDays, score };
    });

    const sorted = [...scored].sort((a, b) => a.score - b.score);
    let t1 = 0.33, t2 = 0.66;
    if (sorted.length >= 3) {
      const i1 = Math.floor(sorted.length * 0.33);
      const i2 = Math.floor(sorted.length * 0.66);
      t1 = sorted[Math.min(i1, sorted.length - 1)].score;
      t2 = sorted[Math.min(i2, sorted.length - 1)].score;
      if (t2 < t1) [t1, t2] = [t2, t1];
    } else if (sorted.length === 2) {
      t1 = sorted[0].score;
      t2 = sorted[1].score;
    }

    if (seqCheck !== this._renderSeq) return;

    scored.forEach(({ c, count, avgD, avgSeverity, avgAgeDays, score }) => {
      if (score < this.VISIBLE_FLOOR) return;
      const color = score < t1 ? '#ffff00' : score < t2 ? '#ffa500' : '#ff0000';
      const ring = L.circle([c.center.lat, c.center.lng], {
        color,
        fillColor: color,
        fillOpacity: 0.45,
        radius: this.CLUSTER_RADIUS_M,
        renderer: this.canvasRenderer,
      }).addTo(this.clusterLayer);

      ring.on('click', () => {
        const html = `
          <div style="font: 16px/1.3 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;">
            <div style="font-weight:700;margin-bottom:6px;">Cluster Summary</div>
            <div><b>Risk Level:</b> ${score < t1 ? 'Low' : score < t2 ? 'Medium' : 'High'}</div>
            <div><b>Total Incidents:</b> ${count}</div>
            <div><b>Avg. Severity:</b> ${avgSeverity.toFixed(1)} / 10</div>
            <div><b>Avg. Spread:</b> ${avgD.toFixed(0)} m</div>
            <div><b>Avg. Age:</b> ${avgAgeDays.toFixed(1)} days</div>
          </div>
        `;
        this.popup.setLatLng(ring.getLatLng()).setContent(html);
        this.map.openPopup(this.popup);
      });
    });
  }

  /* ---------------- Projection & Utils ---------------- */
  private llToXYFactory(points: { lat: number; lng: number }[]) {
    const lat0 = points.reduce((s, p) => s + p.lat, 0) / points.length;
    const lon0 = points.reduce((s, p) => s + p.lng, 0) / points.length;
    const cos = Math.cos(lat0 * Math.PI / 180);
    const R = 6371000;
    const toXY = (lat: number, lng: number) => ({
      x: R * (lng - lon0) * Math.PI / 180 * cos,
      y: R * (lat - lat0) * Math.PI / 180,
    });
    const toLL = (x: number, y: number) => ({
      lat: lat0 + (y / R) * 180 / Math.PI,
      lng: lon0 + (x / (R * cos)) * 180 / Math.PI,
    });
    return { toXY, toLL };
  }

  private coordsOf(r: ReportDoc): { lat: number; lng: number } | null {
    const toNum = (v: any) => (typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v) : NaN);
    const lat = toNum(r.lat); const lng = toNum(r.lng);
    return !isNaN(lat) && !isNaN(lng) ? { lat, lng } : null;
  }

  private toDate(v: any): Date | undefined {
    if (!v) return undefined;
    if (v instanceof Date) return v;
    if (typeof (v as any)?.toDate === 'function') return (v as Timestamp).toDate();
    if (typeof v?.seconds === 'number') return new Date(v.seconds * 1000);
    const d = new Date(v); return isNaN(+d) ? undefined : d;
  }

  private haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000;
    const toRad = (d: number) => d * Math.PI / 180;
    const dLat = toRad(lat2 - lat1); const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private buildReportPopup(p: PointEx): string {
    const dt = p.when ? this.formatDateTime(p.when) : '—';
    const cat = p.category || '—';
    const brgy = p.barangay || '—';
    const lm = p.landmark || '—';
    const desc = (p.description && p.description.trim().length ? p.description : ' —');

    const sevBase = typeof p.severity === 'number' ? p.severity : this.incidentScore(p.category || '');
    const sevEff = this.effectiveSeverity(p);
    const sevText = (p.status === 'resolved')
      ? `${sevBase.toFixed(0)} / 10 (eff. ${sevEff.toFixed(1)})`
      : `${sevBase.toFixed(0)} / 10`;

    const st = (p.status || 'verified').toUpperCase();

    return `
      <div style="font: 16px/1.3 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;">
        <div style="font-weight:700;margin-bottom:6px;">Incident Report</div>
        <div><b>Category: </b>${cat}</div>
        <div><b>Barangay: </b>${brgy}</div>
        <div><b>Landmark: </b>${lm}</div>
        <div><b>Description: </b>${desc}</div>
        <div><b>Severity: </b>${sevText}</div>
        <div><b>Date / Time: </b>${dt}</div>
        <div><b>Status: </b>${st}</div>
      </div>
    `;
  }

  private formatDateTime(d: Date): string {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).format(d);
  }

  private async alert(header: string, message: string) {
    const a = await this.alertCtrl.create({ header, message, buttons: ['OK'] });
    await a.present();
  }
}
