import type { ClinicPlace } from "../../services/clinic";

export interface ClinicMapHtmlInput {
  latitude: number;
  longitude: number;
  clinics: ClinicPlace[];
  selectedClinicId?: string | null;
}

const safeJson = (value: unknown) =>
  JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");

export const buildClinicMapHtml = ({
  latitude,
  longitude,
  clinics,
  selectedClinicId,
}: ClinicMapHtmlInput) => {
  const payload = safeJson({ latitude, longitude, clinics, selectedClinicId });

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { width: 100%; height: 100%; margin: 0; padding: 0; background: #eef8f7; }
    .leaflet-container { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .leaflet-control-attribution { font-size: 10px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const payload = ${payload};
    const map = L.map('map', { zoomControl: true, attributionControl: true });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
    }).addTo(map);

    const bounds = [];
    const userLatLng = [payload.latitude, payload.longitude];
    bounds.push(userLatLng);

    L.circleMarker(userLatLng, {
      radius: 8,
      color: '#ffffff',
      weight: 3,
      fillColor: '#2563eb',
      fillOpacity: 1
    }).addTo(map).bindTooltip('Your location');

    function escapeHtml(value) {
      return String(value || '').replace(/[&<>\"']/g, function (char) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#39;' })[char];
      });
    }

    function emitClinic(clinicId) {
      const message = { source: 'dr-clinic-map', clinicId: clinicId };
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify(message));
      }
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(message, '*');
      }
    }

    payload.clinics.forEach(function (clinic) {
      if (!Number.isFinite(clinic.latitude) || !Number.isFinite(clinic.longitude)) return;
      const latLng = [clinic.latitude, clinic.longitude];
      bounds.push(latLng);
      const selected = clinic.id === payload.selectedClinicId;
      const marker = L.circleMarker(latLng, {
        radius: selected ? 10 : 8,
        color: selected ? '#b45309' : '#0f766e',
        weight: selected ? 4 : 3,
        fillColor: selected ? '#f59e0b' : '#14b8a6',
        fillOpacity: 0.95
      }).addTo(map);
      marker.bindTooltip(
        '<strong>' + escapeHtml(clinic.name) + '</strong><br/>' +
        escapeHtml((Number.isFinite(clinic.distanceKm) ? Number(clinic.distanceKm).toFixed(1) + ' km • ' : '') + clinic.specialty)
      );
      marker.on('click', function () { emitClinic(clinic.id); });
      if (selected) marker.openTooltip();
    });

    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [32, 32], maxZoom: 14 });
    } else {
      map.setView(userLatLng, 13);
    }
  </script>
</body>
</html>`;
};