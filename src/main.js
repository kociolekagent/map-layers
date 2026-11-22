import { appearance } from './appearance.js';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './styles.css';
import { createLocationPicker } from './location-picker.js';
import { openRepository } from './repository.js';
import { mountEditor } from './editor.js';
import { createMeasurement, formatDistance } from './measurement.js';
import { visibleLocations, locationKey } from './datasets.js';

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
const circlePane=map.createPane('dataset-circles');circlePane.style.zIndex='390';circlePane.style.pointerEvents='none';
const circleRenderer=L.svg({pane:'dataset-circles'});
const measurement = createMeasurement();
const measurementLayer = L.layerGroup().addTo(map);
const measureToggle = document.querySelector('#measure-toggle');
const measureClear = document.querySelector('#measure-clear');
const measureUndo = document.querySelector('#measure-undo');
const measureFinish = document.querySelector('#measure-finish');
const measureResume = document.querySelector('#measure-resume');
const measureResult = document.querySelector('#measure-result');
function renderMeasurement() {
  measurementLayer.clearLayers();
  const points = measurement.points.map(([lng,lat]) => [lat,lng]);
  if (points.length >= 2) {
    L.polyline(points, {color:'#fff',weight:7,interactive:false}).addTo(measurementLayer);
    L.polyline(points, {color:'#8629b5',weight:4,dashArray:'8 5',interactive:false}).addTo(measurementLayer);
  }
  points.forEach((point,index) => L.circleMarker(point, {radius:6,color:'#fff',weight:3,fillColor:'#8629b5',fillOpacity:1,interactive:false})
    .bindTooltip(String(index + 1), {permanent:true,direction:'top'}).addTo(measurementLayer));
  measureToggle.setAttribute('aria-pressed', String(measurement.active));
  measureToggle.textContent = measurement.active ? 'Wstrzymaj' : 'Mierz odległość';
  measureClear.disabled = points.length === 0;
  measureUndo.disabled = points.length === 0;
  measureFinish.disabled = !measurement.active || points.length < 2;
  measureResume.disabled = measurement.active || points.length === 0;
  measureToggle.disabled = !measurement.active && points.length > 0;
  if (measurement.active) map.doubleClickZoom.disable(); else map.doubleClickZoom.enable();
  map.getContainer().classList.toggle('measuring', measurement.active);
  const status = measurement.active ? 'Dodawanie aktywne.' : points.length ? 'Dodawanie zakończone. Wznów, aby kontynuować.' : 'Pomiar wyłączony.';
  measureResult.textContent = `${status} Punkty: ${points.length}. ` + (points.length < 2 ? (points.length === 1 ? 'Wskaż drugie miejsce po włączeniu dodawania.' : 'Włącz pomiar i wskaż pierwsze miejsce.') : `Łącznie: ${formatDistance(measurement.distance)}. Ostatni odcinek: ${formatDistance(measurement.lastDistance)}.`);
}
const locationPicker=createLocationPicker(map,()=>{
  measurement.setActive(false);renderMeasurement();selected=null;showDetails();
});
function addMeasurementPoint(coordinates) {
  if (measurement.add(coordinates)) renderMeasurement();
}
measureToggle.onclick = () => {
  locationPicker.clear();
  measurement.setActive(!measurement.active);
  if (measurement.active) { selected = null; showDetails(); map.doubleClickZoom.disable(); }
  else map.doubleClickZoom.enable();
  renderMeasurement();
};
measureClear.onclick = () => { measurement.clear(); renderMeasurement(); };
measureUndo.onclick = () => { measurement.undo(); renderMeasurement(); };
measureFinish.onclick = () => { measurement.finish(); renderMeasurement(); };
measureResume.onclick = () => {
  locationPicker.clear();
  if (measurement.resume()) { selected = null; showDetails(); renderMeasurement(); }
};
document.addEventListener('keydown', event => {
  if(event.key === 'Escape' && locationPicker.active) {locationPicker.stop();return;}
  if (event.key === 'Escape' && measurement.active) {
    measurement.setActive(false); map.doubleClickZoom.enable(); renderMeasurement();
  }
});
map.on('click', event => { const p=event.latlng.wrap();if(locationPicker.click([p.lng,p.lat]))return;if (measurement.active) addMeasurementPoint([event.latlng.lng,event.latlng.lat]); });
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
        const style=appearance(state.appearance);
        if(style.mode==='circles') group.addLayer(L.circle([lat,lng],{radius:style.radius,color:state.dataset.color,fillColor:state.dataset.color,fillOpacity:style.fillOpacity,weight:style.weight,interactive:false,renderer:circleRenderer,className:'dataset-radius'}));
        const marker = L.circleMarker([lat, lng], {radius: 7, color: state.dataset.color, fillColor: state.dataset.color, fillOpacity: 0.85, weight: 2, bubblingMouseEvents: false});
        marker.bindTooltip(element('span', feature.properties.name), {permanent: true, direction: 'right', className: 'point-label'});
        marker.on('click', () => {
          if(locationPicker.click(feature.geometry.coordinates))return;
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
let localStates = [];
function applyLocal(snapshot) {
  const visibility=new Map(localStates.map(s=>[s.dataset.id,s.visible]));
  for(const layer of layers.values())map.removeLayer(layer);
  layers.clear();rows.clear();document.querySelector('#datasets').replaceChildren();
  localStates=snapshot.catalog.datasets.map(dataset=>({dataset,visible:visibility.get(dataset.id)??dataset.visibleByDefault??false,status:'ready',data:snapshot.collections[dataset.id],appearance:snapshot.appearance?.[dataset.id]}));
  for(const state of localStates) {
    const row=element('div',undefined,'dataset'),label=element('label'),input=element('input');input.type='checkbox';input.setAttribute('aria-label',state.dataset.name);
    const swatch=element('span','●');swatch.style.color=state.dataset.color;swatch.setAttribute('aria-hidden','true');
    label.append(input,swatch,document.createTextNode(state.dataset.name));
    const status=element('small');row.append(label,status);document.querySelector('#datasets').append(row);rows.set(state.dataset.id,{input,status});
    input.onchange=()=>{state.visible=input.checked;render(localStates);};
  }
  render(localStates);
}
const editorRoot=document.querySelector('#editor');
let repository;
try {
  repository=await openRepository(undefined,message=>{
    const warning=element('p',message);warning.setAttribute('role','alert');editorRoot.prepend(warning);
    const fieldset=editorRoot.querySelector('fieldset');if(fieldset)fieldset.disabled=true;
  });
  const snapshot=await repository.initialize();
  applyLocal(snapshot);
  mountEditor(editorRoot,repository,snapshot,applyLocal,(id,point)=>{
    const state=localStates.find(s=>s.dataset.id===id);state.visible=true;render(localStates);
    const [lng,lat]=point.geometry.coordinates;map.setView([lat,lng],Math.max(map.getZoom(),14));
    selected=locationKey(point.geometry.coordinates);showDetails();
  },locationPicker);
  document.querySelector('#status').textContent='Dane lokalne z IndexedDB. Zmiany dotyczą tylko tej przeglądarki.';
} catch(error) {
  repository?.close();
  editorRoot.textContent=`Edycja niedostępna: ${error.message}. Baza nie została zmieniona. Odśwież stronę, aby ponowić.`;
  document.querySelector('#status').textContent='Baza niedostępna. Mapa i pomiar pozostają dostępne.';
}
