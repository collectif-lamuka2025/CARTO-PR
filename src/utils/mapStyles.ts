import { StyleSpecification } from 'maplibre-gl';

/**
 * Open, free, keyless tile sources that are 100% cacheable and immune to adblocker domain blocking.
 * OpenStreetMap: classic global open street map (a/b/c subdomains for load balancing).
 * ArcGIS World Imagery: high-resolution satellite imagery across the globe.
 * ArcGIS World Boundaries and Places: high-contrast road labels & place names overlay.
 * OpenTopoMap: topographic relief contours and elevation shading.
 */

export type MapTypeMode = 'roadmap' | 'satellite' | 'hybrid' | 'terrain';

export function getMapLibreStyle(mode: MapTypeMode): StyleSpecification {
  switch (mode) {
    case 'satellite':
      return {
        version: 8,
        name: 'Satellite',
        sources: {
          satellite: {
            type: 'raster',
            tiles: [
              'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            ],
            tileSize: 256,
            attribution: 'Esri, Maxar, Earthstar Geographics, USDA, USGS, AeroGRID, IGN',
            maxzoom: 19,
          },
        },
        layers: [
          {
            id: 'satellite-tiles',
            type: 'raster',
            source: 'satellite',
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      };

    case 'hybrid':
      return {
        version: 8,
        name: 'Hybrid',
        sources: {
          satellite: {
            type: 'raster',
            tiles: [
              'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            ],
            tileSize: 256,
            maxzoom: 19,
          },
          labels: {
            type: 'raster',
            tiles: [
              'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
            ],
            tileSize: 256,
            attribution: 'Esri, HERE, Garmin, © OpenStreetMap contributors',
            maxzoom: 19,
          },
        },
        layers: [
          {
            id: 'satellite-tiles',
            type: 'raster',
            source: 'satellite',
            minzoom: 0,
            maxzoom: 19,
          },
          {
            id: 'labels-tiles',
            type: 'raster',
            source: 'labels',
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      };

    case 'terrain':
      return {
        version: 8,
        name: 'Terrain',
        sources: {
          terrain: {
            type: 'raster',
            tiles: [
              'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
              'https://b.tile.opentopomap.org/{z}/{x}/{y}.png',
              'https://c.tile.opentopomap.org/{z}/{x}/{y}.png',
            ],
            tileSize: 256,
            attribution: 'Map data: © OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap (CC-BY-SA)',
            maxzoom: 17,
          },
        },
        layers: [
          {
            id: 'terrain-tiles',
            type: 'raster',
            source: 'terrain',
            minzoom: 0,
            maxzoom: 17,
          },
        ],
      };

    case 'roadmap':
    default:
      return {
        version: 8,
        name: 'Roadmap',
        sources: {
          osm: {
            type: 'raster',
            tiles: [
              'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
              'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png',
            ],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors',
            maxzoom: 19,
          },
        },
        layers: [
          {
            id: 'osm-tiles',
            type: 'raster',
            source: 'osm',
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      };
  }
}
