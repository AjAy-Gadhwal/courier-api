import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const couriersDir = path.dirname(fileURLToPath(import.meta.url));

export async function discoverCourierModules() {
  const modules = [];
  for (const entry of fs.readdirSync(couriersDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === 'shared') continue;

    const file = path.join(couriersDir, entry.name, 'index.js');
    if (!fs.existsSync(file)) continue;

    const { default: courierModule } = await import(pathToFileURL(file).href);
    if (courierModule && typeof courierModule.code === 'string' && typeof courierModule.create === 'function') {
      modules.push(courierModule);
    }
  }
  return modules;
}
