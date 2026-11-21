// Shared by Node.js validation and future browser data loading; no I/O or mutation.
export class DataValidationError extends Error {
  constructor(source, path, reason) {
    super(`${source}: ${path}: ${reason}`);
    this.name = 'DataValidationError';
    this.source = source;
    this.path = path;
  }
}

const own = (value, key) => Object.hasOwn(value, key);
const fail = (source, path, reason) => { throw new DataValidationError(source, path, reason); };
function object(value, source, path) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail(source, path, 'wymagany obiekt');
  }
}
function literal(value, expected, source, path) {
  if (value !== expected) fail(source, path, `wymagana wartość ${JSON.stringify(expected)}`);
}
function id(value, source, path, seen) {
  if (typeof value !== 'string' || value.trim() !== value || !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(value)) {
    fail(source, path, 'wymagane ID: 1–64 znaki a-z, 0-9, _ lub -, pierwszy znak a-z lub 0-9');
  }
  if (seen.has(value)) fail(source, path, `powtórzony identyfikator "${value}"; pierwsze wystąpienie: ${seen.get(value)}`);
  seen.set(value, path);
}
function name(value, source, path) {
  if (typeof value !== 'string' || [...value].length < 1 || [...value].length > 120 ||
      value.trim() !== value || /[\r\n\u0085\u2028\u2029]/u.test(value)) {
    fail(source, path, 'wymagana jednowierszowa nazwa 1–120 znaków Unicode, bez skrajnych białych znaków');
  }
}
function description(value, source, path) {
  if (typeof value !== 'string' || [...value].length > 2000) {
    fail(source, path, 'wymagany tekst do 2000 znaków Unicode');
  }
}

export function validateFilePath(value, source = 'catalog.json', path = 'file') {
  // Decode URL escapes for inspection so encoded traversal cannot escape the data directory.
  let decoded;
  try { decoded = decodeURIComponent(value); } catch { fail(source, path, 'błędne kodowanie ścieżki'); }
  if (typeof value !== 'string' || !value || value.trim() !== value ||
      /[\\?#\u0000-\u001f\u007f]/u.test(value) || /[\\?#\u0000-\u001f\u007f]/u.test(decoded) ||
      decoded.startsWith('/') || /^[a-z][a-z0-9+.-]*:/i.test(decoded) ||
      decoded.includes('..') || !/\.(geojson|json)$/.test(decoded)) {
    fail(source, path, 'wymagana względna ścieżka .geojson lub .json wewnątrz katalogu danych, bez .., \\, parametrów i fragmentu URL');
  }
  return value;
}

export function validateCatalog(value, source = 'catalog.json') {
  object(value, source, '$');
  literal(value.version, 1, source, 'version');
  if (!Array.isArray(value.datasets) || value.datasets.length < 1 || value.datasets.length > 5) {
    fail(source, 'datasets', 'wymagana tablica od 1 do 5 zestawów');
  }
  const seen = new Map();
  const datasets = value.datasets.map((dataset, index) => {
    const path = `datasets[${index}]`;
    object(dataset, source, path);
    id(dataset.id, source, `${path}.id`, seen);
    name(dataset.name, source, `${path}.name`);
    validateFilePath(dataset.file, source, `${path}.file`);
    if (typeof dataset.color !== 'string' || dataset.color.trim() !== dataset.color || !/^#[0-9a-f]{6}$/i.test(dataset.color)) {
      fail(source, `${path}.color`, 'wymagany kolor #RRGGBB');
    }
    if (own(dataset, 'description')) description(dataset.description, source, `${path}.description`);
    if (own(dataset, 'visibleByDefault') && typeof dataset.visibleByDefault !== 'boolean') {
      fail(source, `${path}.visibleByDefault`, 'wymagana wartość boolean');
    }
    return { ...dataset, visibleByDefault: dataset.visibleByDefault ?? false };
  });
  return { ...value, datasets };
}

function noCrs(value, source, path) {
  if (own(value, 'crs')) fail(source, `${path}.crs`, 'alternatywny układ współrzędnych jest niedozwolony; wymagany WGS84');
}

export function validateFeatureCollection(value, source = 'dataset.geojson') {
  object(value, source, '$');
  literal(value.type, 'FeatureCollection', source, 'type');
  noCrs(value, source, '$');
  if (!Array.isArray(value.features)) fail(source, 'features', 'wymagana tablica');
  const seen = new Map();
  value.features.forEach((feature, index) => {
    const path = `features[${index}]`;
    object(feature, source, path);
    literal(feature.type, 'Feature', source, `${path}.type`);
    noCrs(feature, source, path);
    id(feature.id, source, `${path}.id`, seen);
    object(feature.geometry, source, `${path}.geometry`);
    noCrs(feature.geometry, source, `${path}.geometry`);
    literal(feature.geometry.type, 'Point', source, `${path}.geometry.type`);
    const c = feature.geometry.coordinates;
    if (!Array.isArray(c) || c.length !== 2 || !c.every(Number.isFinite) ||
        c[0] < -180 || c[0] > 180 || c[1] < -90 || c[1] > 90) {
      fail(source, `${path}.geometry.coordinates`, 'wymagane [longitude, latitude]: dwie skończone liczby WGS84, zakresy [-180,180] i [-90,90]');
    }
    object(feature.properties, source, `${path}.properties`);
    name(feature.properties.name, source, `${path}.properties.name`);
    if (own(feature.properties, 'description')) description(feature.properties.description, source, `${path}.properties.description`);
  });
  return value;
}

export function parseJson(text, source) {
  try { return JSON.parse(text); }
  catch { fail(source, '$', 'niepoprawny JSON'); }
}
