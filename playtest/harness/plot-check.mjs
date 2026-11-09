// Reports how far each land plot sits above or below the ground around it (mesa tops and canyon floors are unreachable).
import { installGlobals, makeClock, FakeRenderer, buildGameModule } from './env.mjs';
installGlobals();
globalThis.__SIM = { FakeRenderer, clock: makeClock(), errors: [] };
await import(buildGameModule() + '?plots');
const api = globalThis.__SIM.api; while (!api.built) await new Promise(r => setTimeout(r, 5));
for (const p of api.LAND.plots) {
  const h = api.groundY(p.x, p.z); let worst = 0, steep = 0;
  for (let i = 0; i < 16; i++) for (const r of [20, 40, 70]) { const a = i / 16 * Math.PI * 2, y = api.groundY(p.x + Math.cos(a) * r, p.z + Math.sin(a) * r); worst = Math.max(worst, Math.abs(y - h)); }
  // can we walk out to 150 m in some direction without a cliff?
  let paths = 0; for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; let ok = true, prev = h; for (let r = 4; r <= 150; r += 4) { const y = api.groundY(p.x + Math.cos(a) * r, p.z + Math.sin(a) * r); if (Math.abs(y - prev) > 2.2) { ok = false; break; } prev = y; } if (ok) paths++; }
  console.log(`${p.name.padEnd(16)} (${Math.round(p.x)},${Math.round(p.z)}) h=${h.toFixed(1)} maxdiff=${worst.toFixed(1)} open-directions=${paths}/16`);
}
