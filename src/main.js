import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './styles.css';
import { createMeasurement, formatDistance } from './measurement.js';
import { loadCatalog, createDatasetStore, visibleLocations, locationKey } from './datasets.js';

const element = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
};
const map = L.map('map', {preferCanvas: true}).setView([52.23, 21.01], 12);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);
const measurement = createMeasurement();
const measurementLayer = L.layerGroup().addTo(map);
const measureToggle = document.querySelector('#measure-toggle');
const measureClear = document.querySelector('#measure-clear');
const measureResult = document.querySelector('#measure-result');
function renderMeasurement() {
  measurementLayer.clearLayers();
  const points = measurement.points.map(([lng,lat]) => [lat,lng]);
  if (points.length === 2) {
    L.polyline(points, {color:'#fff',weight:7,interactive:false}).addTo(measurementLayer);
    L.polyline(points, {color:'#8629b5',weight:4,dashArray:'8 5',interactive:false}).addTo(measurementLayer);
  }
  points.forEach((point,index) => L.circleMarker(point, {radius:9,color:'#fff',weight:3,fillColor:'#8629b5',fillOpacity:1,interactive:false})
    .bindTooltip(index === 0 ? 'A' : 'B', {permanent:true,direction:'top'}).addTo(measurementLayer));
  measureToggle.setAttribute('aria-pressed', String(measurement.active));
  measureToggle.textContent = measurement.active ? 'Zakończ pomiar' : 'Mierz odległość';
  measureClear.disabled = points.length === 0;
  map.getContainer().classList.toggle('measuring', measurement.active);
  measureResult.textContent = !measurement.active ? 'Pomiar wyłączony.' : points.length === 0 ? 'Wskaż pierwsze miejsce (A).' : points.length === 1 ? 'Wskaż drugie miejsce (B).' : `Odległość: ${formatDistance(measurement.distance)}. Wyczyść, aby zmierzyć ponownie.`;
}
function addMeasurementPoint(coordinates) {
  if (measurement.add(coordinates)) renderMeasurement();
}
measureToggle.onclick = () => {
  measurement.setActive(!measurement.active);
  if (measurement.active) { selected = null; showDetails(); map.doubleClickZoom.disable(); }
  else map.doubleClickZoom.enable();
  renderMeasurement();
};
measureClear.onclick = () => { measurement.clear(); renderMeasurement(); };
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && measurement.active) {
    measurement.setActive(false); map.doubleClickZoom.enable(); renderMeasurement();
  }
});
map.on('click', event => { if (measurement.active) addMeasurementPoint([event.latlng.lng,event.latlng.lat]); });
renderMeasurement();
const layers = new Map();
const rows = new Map();
let locations = new Map();
let selected = null;
let fitted = false;
const details = document.querySelector('#details');
function showDetails() {
  details.replaceChildren();
  const records = locations.get(selected);
  if (!records) { selected = null; details.append(element('p', 'Kliknij punkt na mapie, aby zobaczyć szczegóły.')); return; }
  details.append(element('h2', `Punkty w lokalizacji (${records.length})`));
  const close = element('button', 'Zamknij szczegóły');
  close.onclick = () => { selected = null; showDetails(); };
  details.append(close);
  for (const {dataset, feature} of records) {
    const article = element('article');
    article.append(element('small', dataset.name), element('h3', feature.properties.name));
    if (feature.properties.description) article.append(element('p', feature.properties.description));
    article.append(element('small', `ID: ${feature.id} · WGS84: ${feature.geometry.coordinates.join(', ')}`));
    details.append(article);
  }
}
function render(states) {
  locations = visibleLocations(states);
  showDetails();
  for (const state of states) {
    const row = rows.get(state.dataset.id);
    row.input.checked = state.visible;
    row.status.textContent = state.status === 'error' ? `Błąd: ${state.error}. Wyłącz i włącz, aby ponowić.` :
      state.status === 'loading' ? 'Ładowanie…' : state.data ? `${state.data.features.length} punktów${state.visible ? '' : ' · ukryte'}` : 'Nie pobrano';
    if (state.data && !layers.has(state.dataset.id)) {
      const group = L.layerGroup();
      for (const feature of state.data.features) {
        const [lng, lat] = feature.geometry.coordinates;
        const marker = L.circleMarker([lat, lng], {radius: 7, color: state.dataset.color, fillColor: state.dataset.color, fillOpacity: 0.85, weight: 2, bubblingMouseEvents: false});
        marker.bindTooltip(element('span', feature.properties.name), {permanent: true, direction: 'right', className: 'point-label'});
        marker.on('click', () => {
          if (measurement.active) { addMeasurementPoint(feature.geometry.coordinates); return; }
          selected = locationKey(feature.geometry.coordinates); showDetails();
        });
        group.addLayer(marker);
      }
      layers.set(state.dataset.id, group);
    }
    const group = layers.get(state.dataset.id);
    if (group) { if (state.visible) group.addTo(map); else map.removeLayer(group); }
  }
  if (!fitted && locations.size) {
    const points = [...locations.values()].map(records => records[0].feature.geometry.coordinates).filter(([,lat]) => Math.abs(lat) <= 85.05112878).map(([lng,lat]) => [lat,lng]);
    if (points.length) { map.fitBounds(points, {maxZoom: 14, padding: [35,35]}); fitted = true; }
  }
}
showDetails();
const catalogUrl = new URL('data/catalog.json', document.baseURI);
try {
  const catalog = await loadCatalog(catalogUrl);
  const store = createDatasetStore(catalog, catalogUrl, render);
  const panel = document.querySelector('#datasets');
  for (const dataset of catalog.datasets) {
    const row = element('div', undefined, 'dataset');
    const label = element('label');
    const input = element('input'); input.type = 'checkbox';
    input.setAttribute('aria-label', dataset.name);
    const swatch = element('span', '●'); swatch.setAttribute('aria-hidden', 'true'); swatch.style.color = dataset.color;
    label.append(input, swatch, document.createTextNode(dataset.name));
    const status = element('small'); status.setAttribute('aria-live', 'polite');
    row.append(label);
    if (dataset.description) row.append(element('p', dataset.description));
    row.append(status); panel.append(row);
    rows.set(dataset.id, {input, status});
    input.addEventListener('change', () => store.setVisible(dataset.id, input.checked));
  }
  render(store.states);
  await Promise.all(catalog.datasets.filter(d => d.visibleByDefault).map(d => store.setVisible(d.id, true)));
  document.querySelector('#status').textContent = 'Włącz zestawy, aby wyświetlić punkty. Nakładające się punkty mają wspólne szczegóły.';
} catch (error) { document.querySelector('#status').textContent = `Błąd katalogu: ${error.message}`; }
