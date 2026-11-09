// Probes candidate plots around Coppervale for large buildings: ground relief, colliders, roads and props in the footprint.
import { installGlobals, makeClock, FakeRenderer, buildGameModule } from './env.mjs';
installGlobals();
globalThis.__SIM = { FakeRenderer, clock: makeClock(), errors: [] };
await import(buildGameModule() + '?grand');
const api = globalThis.__SIM.api; while (!api.built) await new Promise(r => setTimeout(r, 5));
const C = [['ring', -22, 40, 12, 12], ['ring2', 20, 40, 12, 12], ['mansion', -10, -70, 40, 26], ['mansion2', 20, -80, 40, 26], ['capitol', -20, 75, 36, 30], ['capitol2', 30, 80, 36, 30],
  ['casino', 60, 50, 26, 18], ['casino2', -60, 55, 26, 18], ['depot', -120, 30, 30, 14], ['depot2', 120, 40, 30, 14], ['statue', 20, 0, 4, 4], ['statue2', -100, 0, 4, 4], ['mansion3', -40, -75, 40, 26], ['capitol3', 0, 110, 36, 30]];
for (const [n, x, z, w, d] of C) {
  let lo = 1e9, hi = -1e9; for (let dx = -w / 2; dx <= w / 2; dx += w / 6) for (let dz = -d / 2; dz <= d / 2; dz += d / 6) { const y = api.groundY(x + dx, z + dz); lo = Math.min(lo, y); hi = Math.max(hi, y); }
  const hit = api.boxes.filter(b => x + w / 2 + 3 > b.minX && x - w / 2 - 3 < b.maxX && z + d / 2 + 3 > b.minZ && z - d / 2 - 3 < b.maxZ).length;
  console.log(`${n.padEnd(9)} (${x},${z}) ${w}x${d} relief=${(hi - lo).toFixed(1)} boxes=${hit}`);
}
