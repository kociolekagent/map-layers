import { fileURLToPath } from 'node:url';
import { validateDataFiles } from './data-files.js';

try {
  const path = process.argv[2] ?? fileURLToPath(new URL('../public/data/catalog.json', import.meta.url));
  const result = await validateDataFiles(path);
  console.log(`Dane poprawne: ${result.datasets} zestawy, ${result.points} punkty.`);
} catch (error) {
  for (const problem of error.errors ?? [error]) console.error(problem.message);
  process.exitCode = 1;
}
