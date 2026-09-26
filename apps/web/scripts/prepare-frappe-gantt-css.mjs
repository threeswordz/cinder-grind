import { copyFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const jsEntry = fileURLToPath(import.meta.resolve('frappe-gantt'));
const cssSource = resolve(dirname(jsEntry), 'frappe-gantt.css');
const cssTarget = fileURLToPath(
  new URL('../src/scheduling/frappe-gantt.css', import.meta.url),
);

copyFileSync(cssSource, cssTarget);
