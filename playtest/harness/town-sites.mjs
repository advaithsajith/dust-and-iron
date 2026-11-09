// Scans the map for flat, open ground (radius 55 m) far from existing sites, mesas and land plots, to place new towns.
import { installGlobals, makeClock, FakeRenderer, buildGameModule } from './env.mjs';
installGlobals();
globalThis.__SIM = { FakeRenderer, clock: makeClock(), errors: [] };
await import(buildGameModule() + '?sites');
const api = globalThis.__SIM.api; while (!api.built) await new Promise(r => setTimeout(r, 5));
const avoid = [...Object.values(api.SITES).map(s => ({ x: s.x, z: s.z, r: s.r + 120 })), ...api.LANDMARKS.map(m => ({ x: m.x, z: m.z, r: 110 })), ...api.LAND.plots.map(p => ({ x: p.x, z: p.z, r: 100 }))];
const out = [];
for (let x = -640; x <= 640; x += 20) for (let z = -640; z <= 640; z += 20) {
  if (avoid.some(a => Math.hypot(x - a.x, z - a.z) < a.r)) continue;
  let lo = 1e9, hi = -1e9; for (let dx = -55; dx <= 55; dx += 11) for (let dz = -55; dz <= 55; dz += 11) { if (dx * dx + dz * dz > 55 * 55) continue; const y = api.groundY(x + dx, z + dz); lo = Math.min(lo, y); hi = Math.max(hi, y); }
  if (hi - lo < 4) out.push({ x, z, relief: +(hi - lo).toFixed(1), d: Math.round(Math.hypot(x, z)) });
}
// keep well-separated candidates
const pick = []; for (const c of out.sort((a, b) => a.relief - b.relief)) if (!pick.some(p => Math.hypot(p.x - c.x, p.z - c.z) < 250)) pick.push(c);
console.log(pick.slice(0, 12).map(c => `(${c.x},${c.z}) relief ${c.relief} dist ${c.d}`).join('\n'));
