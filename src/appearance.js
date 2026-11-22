export const DEFAULT_APPEARANCE=Object.freeze({mode:'points',radius:100,fillOpacity:0.2,weight:2});
export function appearance(value) {
  if(value!==undefined&&(value===null||typeof value!=='object'||Array.isArray(value)))throw new Error('Niepoprawne ustawienia wyglądu');
  const result={...DEFAULT_APPEARANCE,...value};
  if(!['points','circles'].includes(result.mode))throw new Error('Niepoprawny tryb wyświetlania');
  if(!Number.isFinite(result.radius)||result.radius<=0)throw new Error('Promień musi być większy od zera');
  if(!Number.isFinite(result.fillOpacity)||result.fillOpacity<0||result.fillOpacity>0.9)throw new Error('Wypełnienie musi być w zakresie 0–0,9');
  if(!Number.isFinite(result.weight)||result.weight<0||result.weight>20)throw new Error('Obrys musi być w zakresie 0–20 px');
  return result;
}
