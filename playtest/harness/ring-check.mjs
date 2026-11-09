// Checks the walk from the main street to the prize ring is clear, and the ring and gallows show on the map.
import { installGlobals, makeClock, FakeRenderer, buildGameModule } from './env.mjs';
installGlobals();
globalThis.__SIM = { FakeRenderer, clock: makeClock(), errors: [] };
await import(buildGameModule() + '?ring');
const api = globalThis.__SIM.api; while (!api.built) await new Promise(r => setTimeout(r, 5)); api.begin(false);
const P = api.P, ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
const blockers = api.boxes.filter(b => b.maxX > -20.5 && b.minX < -15.5 && b.maxZ > 10 && b.minZ < 33);
ok(blockers.length === 0, `alley from the main street to the ring is clear (${blockers.length} buildings in the way)`);
// walk it: from the street, straight south to the ring
P.pos.set(-18, 0, 4); P.mounted = false; let reached = false;
for (let i = 0; i < 400 && !reached; i++) { const tx = api.BOX.ring.x, tz = api.BOX.ring.z - 6.5; const a = Math.atan2(tx - P.pos.x, tz - P.pos.z);
  api.tryMove(P.pos, Math.sin(a) * 0.2, Math.cos(a) * 0.2, 0.4, 1.4); if (Math.hypot(P.pos.x - tx, P.pos.z - tz) < 1.5) reached = true; }
ok(reached, `walked from the street to Mickey Doyle (${P.pos.x.toFixed(1)}, ${P.pos.z.toFixed(1)})`);
const pois = api.mapPOIs(); ok(pois.some(p => p.label === 'Prize fight ring') && pois.some(p => p.label === 'Gallows'), 'ring and gallows on the map');
console.log('game errors:', globalThis.__SIM.errors.length);
