# Map Layers — lokalne dane, import i eksport

Strona: https://kociolekagent.github.io/map-layers/

Statyczna aplikacja Vite + JavaScript, mapa Leaflet/OSM, warstwy, szczegóły,
wyszukiwanie w panelu edycji, pomiar wielopunktowy i IndexedDB. Bez backendu.

## Uruchomienie i testy

Node.js 22.12+ (zalecany 24 LTS).

```bash
npm ci --include=dev --cache .npm-cache --no-audit --no-fund
npm run dev
npm test
npm run build
npm run preview
PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers npx playwright install chromium
PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers npm run test:browser
```

Serwery lokalne: 127.0.0.1:5173 (dev), 127.0.0.1:4173 (preview).
Testy Chromium wymagają bibliotek systemowych; CI instaluje je na runnerze.
Workflow Pages nadal testuje, buduje i publikuje `dist/` przy push do main.
Vite `base: './'` obsługuje podścieżkę repozytorium.

## Architektura danych: przed i po

W etapie 5A pierwsze uruchomienie pobierało katalog i wszystkie GeoJSON do
IndexedDB; brak dostępu do bazy uruchamiał awaryjny odczyt źródeł.
Teraz IndexedDB jest jedynym źródłem danych użytkownika. Nie ma automatycznego
pobierania przykładów, ani awaryjnego przełączania na nie. Błąd bazy pokazuje
komunikat, pozostawiając mapę i pomiar dostępne bez danych.

Zachowano nazwę `map-layers-local-v1`, schemat 1, magazyn `state` i rekord
`workspace` z `{catalog, collections}`. Zmiana nie wymaga migracji struktury:
istniejący rekord pozostaje bez zmian; nowy zawiera zero zestawów. Inicjalizacja
ponownie sprawdza rekord wewnątrz transakcji i nigdy nie nadpisuje danych.
Przyszłe migracje należy dopisywać w `upgrade`, zwiększając `SCHEMA_VERSION`,
bez zmiany nazwy bazy ani kasowania rekordów. Aktualizacje kodu/plików przykładów
nie zmieniają lokalnej bazy. Testy jawnie tworzą stare bazy z przykładami.

Lokalny workspace dopuszcza 0–5 zestawów, w tym usunięcie ostatniego. To osobna
reguła lokalnego stanu; kontrakt katalogu źródłowego v1 (1–5) pozostaje bez zmian.
Źródłowe pliki są zachowane do testów i ręcznego importu, nie sterują produkcją.

## Import i eksport

- **Pojedynczy zestaw:** wybierz `.geojson` lub `.json` typu FeatureCollection,
  zawierający wyłącznie punkty zgodne z kontraktem v1 (w tym Feature.id i nazwa).
  Podgląd pokazuje liczbę punktów oraz nazwę do nadania. Można utworzyć zestaw
  albo wybrać istniejący do zastąpienia; zastąpienie wymaga potwierdzenia,
  zachowuje ID, nazwę i kolor docelowego zestawu. Błędny rekord odrzuca cały plik.
- **Eksport wybranego:** standardowy GeoJSON zawierający bieżącą kolekcję,
  bez dopisywania pól do właściwości użytkownika. Przy imporcie do nowego
  zestawu nazwę i kolor nadaje użytkownik.
- **Eksport wszystkich:** `map-layers-backup.json`, jawna kopia JSON, NIE
  pojedyncza kolekcja GeoJSON. Format:
  `{ "format": "map-layers-backup", "version": 1, "snapshot": { "catalog": ..., "collections": ... } }`.
  Katalog zawiera metadane, a `collections` mapuje ID zestawu na jego pełny
  GeoJSON. Zachowuje puste zestawy, kolejność, wspólne ID punktów w różnych
  zestawach i nieznane pola wszystkich obiektów. Nie dopisuje własnych pól do
  danych użytkownika. Jedna płaska standardowa FeatureCollection nie określa
  podziału zestawów ani pustych zestawów, dlatego kopia używa jawnego opakowania.
- **Odtworzenie kopii:** ten sam wybór pliku rozpoznaje kopię, pokazuje nazwy
  i liczności. Przycisk „Odtwórz kopię” wymaga potwierdzenia zastąpienia CAŁEJ
  lokalnej bazy. Zapis jest atomowy; nie wykonujemy częściowego scalenia.

Przenoszenie między urządzeniami: wyeksportuj kopię wszystkich zestawów,
przenieś plik, wybierz go w aplikacji na drugim urządzeniu i potwierdź
odtworzenie. Przed zastąpieniem warto wyeksportować dotychczasową bazę.

## Moduły

- `src/repository.js` — transakcje, inicjalizacja, CRUD, import i odtworzenie.
- `src/transfer.js` — rozpoznawanie formatów, walidacja importu i eksport.
- `src/editor.js` — formularze, podgląd importu, potwierdzenia, filtr punktów.
- `src/main.js`, `src/styles.css`, `index.html` — mapa i integracja interfejsu.
- `src/measurement.js` — niezależny pomiar łamanej: suma, ostatni odcinek,
  cofnięcie, zakończenie, jawne wznowienie i czyszczenie. Esc wstrzymuje.
- `src/validation.js`, `docs/data-contract-v1.md` — niezmieniony kontrakt GeoJSON.
- `src/datasets.js`, `scripts/`, `public/data/` — obsługa i walidacja przykładów,
  testy historycznej logiki odczytu; brak produkcyjnego ładowania tych plików.
- `tests/`, `browser-tests/` — testy jednostkowe, IndexedDB i interfejsu.

## Ograniczenia

Dane pozostają w przeglądarce/profilu i origin strony. Czyszczenie danych witryny,
tryb prywatny lub usunięcie danych przez przeglądarkę może je utracić — eksportuj
kopie. Brak synchronizacji. Inne karty widzą zmiany po odświeżeniu; transakcje
są serializowane, a ostatni zapis tych samych pól wygrywa. Nieznane właściwości
nieedytowane przez formularze są zachowywane. Eksport zawsze czyta bazę na nowo.
Pliki importu i cała baza są walidowane w pamięci; bardzo duże pliki mogą
obciążać przeglądarkę. Limit zestawów to 5, liczba punktów nie ma twardego limitu.

Znaczniki Canvas nie mają indywidualnego fokusu klawiatury; etykiety mogą się
nakładać. Wspólna lokalizacja pokazuje wszystkie widoczne rekordy. Podkład OSM
wymaga sieci. Pomiar korzysta z haversine (promień 6371000 m), bez wysokości
ani dróg; nie jest elipsoidalnym pomiarem geodezyjnym. Prosta łamana na mapie
nie przedstawia łuków wielkiego koła na dużych dystansach.

## Lokalizacja punktu: adres i mapa

W formularzu dodawania lub edycji punktu nadal można ręcznie wpisać longitude
oraz latitude. „Wskaż na mapie” włącza osobny tryb: kolejne kliknięcia mapy
lub istniejących znaczników ustawiają współrzędne i tymczasowy turkusowy punkt.
„Anuluj wskazywanie”/Esc wyłącza tryb, zachowując wybrane współrzędne formularza.
Anulowanie formularza, zmiana zestawu lub udany zapis usuwa podgląd. Wejście
w ten tryb wstrzymuje pomiar bez kasowania go; wznowienie pomiaru kończy wskazywanie.
Żaden z tych kroków nie zapisuje punktu — wymagany jest „Zapisz punkt”.

Adres/miejsce wyszukuje się wyłącznie przyciskiem „Szukaj adresu” lub Enter
w polu zapytania. Wybór wyniku ustawia współrzędne i przesuwa mapę. Lista wyników
jest ograniczona do 5 pozycji, ma obsługę braku wyników, błędów i oczekiwania.
Wyniki usługi i nazwy są renderowane jako tekst, nigdy HTML.

Usługa: publiczny Nominatim OpenStreetMap, zaakceptowany przez operatora do
sporadycznego użytku osobistego. Zasady:
https://operations.osmfoundation.org/policies/nominatim/
Maksimum **1 żądanie/s łącznie dla aplikacji**, nie dla użytkownika. Brak
pełnotekstowego autocomplete, zapytań masowych i automatycznych ponowień.
Przeglądarka przekazuje identyfikujący Referer origin; nie należy go blokować.
Atrybucja OSM/ODbL jest w formularzu. Zapytania trafiają do OSMF — nie należy
podawać danych poufnych. Usługa nie gwarantuje dostępności ani dokładności.

`src/geocoding.js` stosuje odstęp 1100 ms, blokadę Web Locks między kartami
(gdy dostępna), cache 20 zapytań w pamięci i localStorage (24h), timeout 15s.
Nie zapewnia globalnego limitu między urządzeniami/przeglądarkami. Przed
udostępnieniem wielu osobom należy zmienić dostawcę lub sposób limitowania.
Nie ma kluczy API ani backendu. `public/geocoding.json` umożliwia wyłączenie
usługi lub zmianę kompatybilnego endpointu bez zmiany i przebudowy JavaScript;
plik jest odczytywany bez cache przy wyszukiwaniu. Nie zapisuj sekretów w nim.

`src/location-picker.js` obsługuje wyłącznie tymczasowy podgląd. Zapis nadal
przechodzi przez repozytorium IndexedDB. Import/eksport i schemat bazy bez zmian.
Testy geokodera używają odpowiedzi zastępczych, nie obciążają publicznej usługi.

## Wygląd zestawów

Panel „Wygląd zestawu” ustawia kolor oraz tryb zwykłych punktów lub kół.
Tylko w trybie kół widoczne są: promień w metrach (>0), wypełnienie 0–0,9
(0 = przezroczyste, 0,9 = 90% krycia) i grubość obrysu 0–20 px.
Domyślnie: punkty; ustawienia kół: 100 m, krycie 0,2, obrys 2 px.
Zmiana jest stosowana dopiero po „Zapisz wygląd”.

`src/appearance.js` definiuje domyślne wartości i walidację. Ustawienia są
w opcjonalnym `snapshot.appearance[datasetId]`, nie we właściwościach punktów.
Kolor nadal pochodzi z `catalog.datasets[].color`. Brak wpisu daje dotychczasowe
punkty bez modyfikowania istniejącej bazy. Schemat IndexedDB pozostaje 1.
Backup v1 obejmuje cały snapshot wraz z wyglądem. Stare kopie bez appearance
są poprawne i renderują zwykłe punkty; pojedynczy GeoJSON pozostaje niezmieniony.
Usunięcie zestawu usuwa też jego wpis wyglądu. Zastąpienie jego punktów przez
import zachowuje ustawienia zestawu, a odtworzenie kopii przywraca jej wygląd.

Koła Leaflet (promień w metrach, nie pikselach) są w osobnej warstwie pod
znacznikami i nie przechwytują kliknięć. Środkowy punkt pozostaje uchwytem do
szczegółów, etykiet i pomiaru dokładnej lokalizacji. Kliknięcie powierzchni
koła poza środkiem trafia do mapy lub punktu innego zestawu. Koła chowają się
razem z zestawem. Nie zmieniają pomiaru ani geometrii zapisanych punktów.
Wielkie promienie i wiele nakładających się kół mogą pogarszać czytelność mapy.
