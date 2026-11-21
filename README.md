# Map Layers — etap 1

Szkielet Vite + JavaScript i walidator zaakceptowanego kontraktu danych v1.
Nie ma jeszcze mapy, znaczników, etykiet, przełączników zestawów ani pomiaru.
Przygotowano workflow GitHub Pages; samo wdrożenie wymaga konfiguracji repozytorium.

## Wymagania i uruchomienie

Node.js 22.12+ (zalecany Node.js 24 LTS) i npm.

```bash
cd /home/node/.openclaw/workspace/projects/map-layers
npm ci --include=dev --cache .npm-cache --no-audit --no-fund
npm run dev
```

Otwórz adres podany przez Vite, domyślnie http://127.0.0.1:5173.
Serwer jest dostępny lokalnie na komputerze, na którym uruchomiono polecenie.

```bash
npm run validate
npm test
npm run build
npm run preview
```

Podgląd buildu: domyślnie http://127.0.0.1:4173. Zatrzymanie serwera: Ctrl+C.
Build najpierw waliduje wszystkie dane, następnie tworzy `dist/`.
Błąd walidacji przerywa build z niezerowym kodem wyjścia.

## Struktura

- `index.html`, `src/main.js`, `src/styles.css` — minimalna strona startowa, bez mapy.
- `src/validation.js` — czysty walidator katalogu i GeoJSON, parser JSON oraz błędy z lokalizacją; bez zależności i bez operacji I/O.
- `scripts/data-files.js` — odczyt plików względem katalogu danych, kontrola dostępności i zbiorcze zgłaszanie błędów zestawów.
- `scripts/validate-data.js` — CLI walidujące wszystkie pliki, także ukrytych zestawów.
- `public/data/catalog.json` — dwa zestawy, ich nazwy, kolory i początkowa widoczność.
- `public/data/datasets/miejsca.geojson` — dwa punkty o identycznych współrzędnych.
- `public/data/datasets/pomiary.geojson` — dwa kolejne punkty; ID mogą powtarzać się między zestawami.
- `tests/validation.test.js` — reguły struktury, typów, tekstu, ID, ścieżek i współrzędnych.
- `tests/files.test.js` — integracja plikowa i CLI, brak pliku, błędny JSON, błędny katalog i ukryte zestawy.
- `docs/data-contract-v1.md` — reguły zaakceptowanego kontraktu i granica obecnego etapu.
- `vite.config.js` — względne adresy zasobów (`base: './'`).
- `package.json`, `package-lock.json` — polecenia, lokalna zależność Vite i przypięte wersje.
- `.gitignore` — wykluczenia plików generowanych i lokalnych.
- `plan.md` — zachowana bez zmian wcześniejsza notatka; zaakceptowany później kontrakt v1 ma pierwszeństwo.
- `dist/`, `node_modules/`, `.npm-cache/` — wynik buildu, zależności i lokalny cache; nie są plikami źródłowymi.

## Używanie walidatora

```js
import { validateCatalog, validateFeatureCollection, parseJson } from './src/validation.js';
const catalog = validateCatalog(parseJson(text, 'catalog.json'));
```

`validateCatalog` zwraca katalog z domyślnym `visibleByDefault: false`, nie modyfikując wejścia.
`validateFeatureCollection` zwraca cały wejściowy zestaw dopiero po poprawnej walidacji.
Błędy mają klasę `DataValidationError`, pola `source`, `path` i czytelny `message`.
Walidator kończy na pierwszym błędzie danego dokumentu; walidacja plikowa zbiera błędy
ze wszystkich zestawów w `AggregateError`. Błąd katalogu zatrzymuje odczyt zestawów.
Nieznane pola są zachowywane, ale nie wpływają na walidację.

Inny katalog danych wewnątrz projektu można sprawdzić poleceniem:

```bash
node scripts/validate-data.js public/data/catalog.json
```

## Ograniczenia etapu

- Nie ma pobierania HTTP, obsługi ponawiania ani stanów widoczności w przeglądarce.
  Brak lokalnego pliku jest obsłużony; błędy HTTP i izolacja błędów interfejsu należą do następnego etapu.
- Tekst w danych nie jest interpretowany jako HTML. Wyświetlanie nazw i opisów punktów
  oraz testy ich bezpiecznego renderowania powstaną wraz z interfejsem mapy.
- Identyczne współrzędne pozostają osobnymi rekordami; wspólne szczegóły po kliknięciu
  i jeden wierzchołek pomiaru nie są jeszcze implementowane.
- Brak testów wydajności i przeglądarkowych; testy obecnego etapu działają w Node.js.
- Około 1000 punktów to założenie skali, nie limit walidacji.
- Dane w `public/` będą publicznie dostępne po przyszłej publikacji. Nie należy umieszczać tam sekretów.

Jedyną bezpośrednią zależnością developerską jest Vite. Testy używają `node:test`
i `node:assert/strict`. Leaflet nie jest jeszcze instalowany, bo ten etap nie zawiera mapy.

## GitHub Pages

Workflow `.github/workflows/pages.yml` dla gałęzi `main` uruchamia testy,
waliduje dane, buduje projekt i publikuje wyłącznie `dist/`.
W Settings → Pages należy wybrać źródło GitHub Actions.
Vite `base: './'` zachowuje względne zasoby również pod `/map-layers/`.
Katalog jest kopiowany do `dist/data/catalog.json`, a pliki GeoJSON do
`dist/data/datasets/`; ścieżki zestawów należy rozwiązywać względem URL katalogu.
Strona oraz wszystkie dane w `public/` po wdrożeniu są publiczne.
Na planie GitHub Free również repozytorium źródłowe musi być publiczne.
