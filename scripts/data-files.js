import { readFile, realpath } from 'node:fs/promises';
import { dirname, relative, isAbsolute, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DataValidationError, parseJson, validateCatalog, validateFeatureCollection } from '../src/validation.js';

async function readJson(path, source) {
  let text;
  try { text = await readFile(path, 'utf8'); }
  catch (error) { throw new DataValidationError(source, '$', `nie można odczytać pliku (${error.code})`); }
  return parseJson(text, source);
}

// Validate every dataset, including hidden ones. Never return a partial dataset.
export async function validateDataFiles(catalogPath) {
  const absolute = resolve(catalogPath);
  const catalog = validateCatalog(await readJson(absolute, absolute), absolute);
  const root = await realpath(dirname(absolute));
  const errors = [];
  let points = 0;
  for (const dataset of catalog.datasets) {
    try {
      const path = fileURLToPath(new URL(dataset.file, pathToFileURL(absolute)));
      let actual;
      try { actual = await realpath(path); }
      catch (error) { throw new DataValidationError(dataset.file, '$', `nie można odczytać pliku (${error.code})`); }
      const offset = relative(root, actual);
      if (offset === '..' || offset.startsWith('../') || isAbsolute(offset)) {
        throw new DataValidationError(dataset.file, '$', 'plik poza katalogiem danych');
      }
      const collection = validateFeatureCollection(await readJson(actual, dataset.file), dataset.file);
      points += collection.features.length;
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length) throw new AggregateError(errors, 'Walidacja zestawów nie powiodła się');
  return { datasets: catalog.datasets.length, points };
}
