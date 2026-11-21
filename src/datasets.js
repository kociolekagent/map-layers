import { parseJson, validateCatalog, validateFeatureCollection } from './validation.js';

export async function readJson(url, fetcher = fetch) {
  const response = await fetcher(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return parseJson(await response.text(), String(url));
}
export async function loadCatalog(url, fetcher = fetch) {
  return validateCatalog(await readJson(url, fetcher), String(url));
}
export const locationKey = coordinates => JSON.stringify(coordinates);
export function visibleLocations(states) {
  const locations = new Map();
  for (const state of states) if (state.visible && state.data) {
    for (const feature of state.data.features) {
      const key = locationKey(feature.geometry.coordinates);
      if (!locations.has(key)) locations.set(key, []);
      locations.get(key).push({ dataset: state.dataset, feature });
    }
  }
  return locations;
}
export function createDatasetStore(catalog, catalogUrl, onChange, fetcher = fetch) {
  const states = catalog.datasets.map(dataset => ({dataset, visible: false, status: 'idle', data: null, error: null, pending: null}));
  async function setVisible(id, visible) {
    const state = states.find(s => s.dataset.id === id);
    state.visible = visible;
    onChange(states);
    if (!visible || state.data) return;
    if (state.pending) return state.pending;
    state.status = 'loading'; state.error = null;
    onChange(states);
    state.pending = (async () => {
      try {
        const url = new URL(state.dataset.file, catalogUrl);
        state.data = validateFeatureCollection(await readJson(url, fetcher), String(url));
        state.status = 'ready';
      } catch (error) { state.status = 'error'; state.error = error.message; }
      finally { state.pending = null; onChange(states); }
    })();
    return state.pending;
  }
  return {states, setVisible};
}
