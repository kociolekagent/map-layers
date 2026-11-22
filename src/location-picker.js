import L from 'leaflet';
// Temporary form location. Never writes to the repository.
export function createLocationPicker(map,onActivate) {
  let receive=null,notify=null,active=false,marker=null;
  function stop() { active=false;map.getContainer().classList.remove('picking');notify?.(false); }
  function preview(coordinates,move=false) {
    const [lng,lat]=coordinates;
    if(marker)map.removeLayer(marker);
    marker=L.circleMarker([lat,lng],{radius:10,color:'#fff',weight:3,fillColor:'#087e8b',fillOpacity:1,interactive:false}).addTo(map);
    marker.bindTooltip('Nowa lokalizacja — niezapisana',{permanent:true,direction:'top',className:'draft-label'});
    if(move)map.setView([lat,lng],Math.max(map.getZoom(),15));
  }
  return {
    get active(){return active;},
    start(callback,onState) {stop();receive=callback;notify=onState;onActivate();active=true;map.getContainer().classList.add('picking');notify(true);},
    click(coordinates) {if(!active)return false;preview(coordinates);receive?.([...coordinates]);return true;},
    show:preview,
    stop,
    clear(){stop();receive=null;notify=null;if(marker)map.removeLayer(marker);marker=null;}
  };
}
