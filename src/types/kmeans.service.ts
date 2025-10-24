import { Injectable } from '@angular/core';

export interface Incident {
  lat: number;
  lng: number;
  category?: string;
  status?: string; // optional, still here in case you add it later
  date?: string; // for recency-based risk
}

export interface ClusteredPoint extends Incident {
  cluster: number;
  color: string;
  riskScore: number;
}

@Injectable({
  providedIn: 'root',
})
export class KMeansService {
  private data: Incident[] = [];
  private cachedClusters: ClusteredPoint[] = [];
  private lastDataHash = '';

  // ✅ Color scale from low → high
  private colors = ['#FFFF00', '#FFA500', '#FF0000']; // Yellow, Orange, Red

  // ✅ Category risk weights
  private categoryRisk: Record<string, number> = {
    Theft: 0.8,
    Assault: 1.0,
    'Car Accident': 0.7,
    Flood: 0.6,
    'Blocked Lane': 0.4,
    Other: 0.5,
  };

  // ✅ Mock data for testing
  private mockData: Incident[] = [
    { lat: 17.6132, lng: 121.7294, category: 'Theft', date: '2025-10-06' },
    { lat: 17.6145, lng: 121.7288, category: 'Assault', date: '2025-10-07' },
    { lat: 17.6109, lng: 121.7261, category: 'Flood', date: '2025-09-25' },
    { lat: 17.6173, lng: 121.7302, category: 'Car Accident', date: '2025-10-03' },
    { lat: 17.6128, lng: 121.7331, category: 'Blocked Lane', date: '2025-09-29' },
    { lat: 17.6159, lng: 121.7345, category: 'Theft', date: '2025-10-08' },
    { lat: 17.6191, lng: 121.7329, category: 'Flood', date: '2025-09-30' },
    { lat: 17.6098, lng: 121.7351, category: 'Assault', date: '2025-10-07' },
    { lat: 17.6089, lng: 121.7283, category: 'Theft', date: '2025-10-02' },
    { lat: 17.6164, lng: 121.7277, category: 'Car Accident', date: '2025-10-04' },
  ];

  constructor() {
    this.setData(this.mockData);
  }

  // ✅ Load dynamic or mock data
  setData(data: Incident[]) {
    this.data = data.length ? data : this.mockData;
  }

  // ✅ Main clustering method
  getClusteredData(k = 3): ClusteredPoint[] {
    const hash = JSON.stringify(this.data);
    if (hash === this.lastDataHash) {
      return this.cachedClusters;
    }

    this.lastDataHash = hash;
    if (this.data.length === 0) return [];

    // Initialize centroids (first k points)
    let centroids = this.data.slice(0, k).map(p => ({ lat: p.lat, lng: p.lng }));
    let assignments = new Array(this.data.length).fill(0);
    let changed = true;
    let iterations = 0;

    while (changed && iterations < 20) {
      changed = false;
      iterations++;

      // Assign each point to the nearest centroid
      for (let i = 0; i < this.data.length; i++) {
        const distances = centroids.map(c => this.distance(this.data[i], c));
        const clusterIndex = distances.indexOf(Math.min(...distances));
        if (assignments[i] !== clusterIndex) {
          assignments[i] = clusterIndex;
          changed = true;
        }
      }

      // Recalculate centroids
      for (let j = 0; j < k; j++) {
        const clusterPoints = this.data.filter((_, idx) => assignments[idx] === j);
        if (clusterPoints.length > 0) {
          const avgLat = clusterPoints.reduce((sum, p) => sum + p.lat, 0) / clusterPoints.length;
          const avgLng = clusterPoints.reduce((sum, p) => sum + p.lng, 0) / clusterPoints.length;
          centroids[j] = { lat: avgLat, lng: avgLng };
        }
      }
    }

    // ✅ Calculate risk score per cluster
    const clusterScores = Array(k).fill(0);
    const now = new Date();

    for (let j = 0; j < k; j++) {
      const clusterPoints = this.data.filter((_, idx) => assignments[idx] === j);

      let totalScore = 0;
      clusterPoints.forEach(p => {
        // Category risk (default to 0.5 if unknown)
        const categoryScore = this.categoryRisk[p.category || 'Other'] || 0.5;

        // Recency score (newer = higher risk)
        const daysOld = p.date ? (now.getTime() - new Date(p.date).getTime()) / (1000 * 3600 * 24) : 30;
        const recencyScore = Math.max(0, 1 - daysOld / 30); // 1 = today, 0 = >30 days old

        // Combine weighted factors
        const incidentRisk = (0.6 * categoryScore + 0.4 * recencyScore);
        totalScore += incidentRisk;
      });

      // Normalize by cluster size (frequency)
      clusterScores[j] = clusterPoints.length > 0 ? totalScore * clusterPoints.length : 0;
    }

    // Determine max for color scaling
    const maxRisk = Math.max(...clusterScores);

    // ✅ Assign colors per point
    const clusteredData: ClusteredPoint[] = this.data.map((point, idx) => {
      const clusterIndex = assignments[idx];
      const clusterRisk = clusterScores[clusterIndex];

      let color = '#FFFF00'; // Default yellow
      const ratio = clusterRisk / maxRisk;

      if (ratio > 0.66) color = '#FF0000'; // Red (High)
      else if (ratio > 0.33) color = '#FFA500'; // Orange (Medium)
      else color = '#FFFF00'; // Yellow (Low)

      return {
        ...point,
        cluster: clusterIndex,
        color,
        riskScore: clusterRisk,
      };
    });

    this.cachedClusters = clusteredData;
    return clusteredData;
  }

  // Euclidean distance between two points
  private distance(a: Incident, b: Incident) {
    return Math.sqrt(Math.pow(a.lat - b.lat, 2) + Math.pow(a.lng - b.lng, 2));
  }
}
