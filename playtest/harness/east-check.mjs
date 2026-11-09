// Probes ground height, slope, road distance and colliders east of Coppervale's main street, for town expansion.
import { installGlobals, makeClock, FakeRenderer, buildGameModule } from './env.mjs';
installGlobals();
globalThis.__SIM = { FakeRenderer, clock: makeClock(), errors: [] };
await import(buildGameModule() + '?east');
const api = globalThis.__SIM.api; while (!api.built) await new Promise(r => setTimeout(r, 5));
for (const z of [-17, 16]) for (let x = 100; x <= 190; x += 14) {
  const hit = api.boxes.filter(b => x + 7 > b.minX && x - 7 < b.maxX && z + 7 > b.minZ && z - 7 < b.maxZ).length;
  let lo = 1e9, hi = -1e9; for (let dx = -7; dx <= 7; dx += 3.5) for (let dz = -6; dz <= 6; dz += 3) { const y = api.groundY(x + dx, z + dz); lo = Math.min(lo, y); hi = Math.max(hi, y); }
  console.log(`x=${x} z=${z} relief=${(hi - lo).toFixed(1)} boxes=${hit} h=${api.groundY(x, z).toFixed(1)}`);
}
