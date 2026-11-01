import { installGlobals, makeClock, FakeRenderer, buildGameModule } from './env.mjs';

installGlobals();
globalThis.__SIM = { FakeRenderer, clock: makeClock(), errors: [] };
const url = buildGameModule();
let t0 = performance.now();
await import(url);
const api = globalThis.__SIM.api;
while (!api.built) await new Promise(r => setTimeout(r, 10));
console.log('world built in', Math.round(performance.now() - t0), 'ms');
api.begin(false);
const dt = 1 / 20;
t0 = performance.now();
for (let i = 0; i < 2000; i++) { api.clock.elapsedTime += dt; api.tick(dt); api.camera.updateMatrixWorld(); globalThis.__SIM.clock.advance(dt * 1000); }
const ms = performance.now() - t0;
console.log(`2000 ticks (${(2000 * dt).toFixed(0)} s of play) in ${Math.round(ms)} ms -> ${(ms / 2000).toFixed(2)} ms/tick`);
console.log('player at', api.P.pos.x.toFixed(1), api.P.pos.z.toFixed(1), 'quest', api.tracked, api.objText(api.tracked));
console.log('errors:', globalThis.__SIM.errors.length, globalThis.__SIM.errors.slice(0, 2));
