import { setWorkerUrl } from 'maplibre-gl';

let isWorkerConfigured = false;

export function initMapLibreWorker(): void {
  if (isWorkerConfigured) return;
  try {
    // Setting .cjs tells MapLibre v6 to create a robust classic Web Worker (new Worker(url))
    // without triggering ES module worker limitations or Vite HMR client injection.
    // The bundled IIFE file in public/maplibre-gl-worker.cjs is completely self-contained.
    setWorkerUrl('/maplibre-gl-worker.cjs');
    isWorkerConfigured = true;
  } catch (err) {
    console.warn('Configuration MapLibre worker:', err);
  }
}

// Automatically configure upon module evaluation
initMapLibreWorker();
