declare module 'ml-kmeans' {
  export interface KMeansCentroid { centroid: number[] }
  export interface KMeansResult {
    clusters: number[];
    centroids: KMeansCentroid[];
  }
  export default function kmeans(
    data: number[][],
    k: number,
    options?: { initialization?: 'kmeans++' | 'random' | number[][]; maxIterations?: number }
  ): KMeansResult;
}
