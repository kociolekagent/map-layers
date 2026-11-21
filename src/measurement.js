// WGS84 coordinates in GeoJSON order. Spherical model, same radius as Leaflet Earth.
export function distanceMeters([lng1, lat1], [lng2, lat2]) {
  const rad = Math.PI / 180;
  const a = Math.sin((lat2-lat1)*rad/2)**2 + Math.cos(lat1*rad)*Math.cos(lat2*rad)*Math.sin((lng2-lng1)*rad/2)**2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(Math.min(1,Math.max(0,a))), Math.sqrt(Math.max(0,1-a)));
}
export function formatDistance(meters) {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters/1000).toLocaleString('pl-PL',{minimumFractionDigits:2,maximumFractionDigits:2})} km`;
}
export function createMeasurement() {
  let active = false;
  let points = [];
  return {
    get active() { return active; },
    get points() { return points.map(p=>[...p]); },
    setActive(value) { active = value; points = []; },
    clear() { points = []; },
    add(point) { if (!active || points.length === 2) return false; points.push([...point]); return true; },
    get distance() { return points.length === 2 ? distanceMeters(...points) : null; }
  };
}
