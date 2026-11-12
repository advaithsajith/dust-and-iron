// Measures the game's per-frame logic cost (no rendering) while standing in town, in milliseconds per tick.
import { installGlobals, makeClock, FakeRenderer, buildGameModule } from './env.mjs';
installGlobals();
globalThis.__SIM = { FakeRenderer, clock: makeClock(), errors: [] };
await import(buildGameModule() + '?cost');
const api = globalThis.__SIM.api; while (!api.built) await new Promise(r => setTimeout(r, 5));
const t0 = performance.now(); api.begin(false); const tBegin = performance.now() - t0;
const run = n => { const t = performance.now(); for (let i = 0; i < n; i++) { api.clock.elapsedTime += 1 / 60; api.tick(1 / 60); api.P.hp = 100; globalThis.__SIM.clock.advance(16); } return (performance.now() - t) / n; };
run(300);
console.log(`begin ${tBegin.toFixed(0)} ms · tick ${run(3000).toFixed(3)} ms in town · npcs ${api.npcs.length} · outlaws ${api.outlaws.length}`);
api.P.pos.set(300, 0, 300); run(200); console.log(`tick ${run(3000).toFixed(3)} ms in open desert`);
