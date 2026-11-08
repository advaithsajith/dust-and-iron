// Checks the law system: chases cool off, posses run out, and killing deputies breaks their nerve.
import { installGlobals, makeClock, FakeRenderer, buildGameModule } from './env.mjs';
installGlobals();
globalThis.__SIM = { FakeRenderer, clock: makeClock(), errors: [] };
await import(buildGameModule() + '?law');
const api = globalThis.__SIM.api; while (!api.built) await new Promise(r => setTimeout(r, 5)); api.begin(false);
const P = api.P, W = api.WANTED, dt = 0.05;
let t = 0;
const step = s => { for (let i = 0; i < s / dt; i++) { api.clock.elapsedTime += dt; api.tick(dt); P.hp = 100; globalThis.__SIM.clock.advance(dt * 1000); t += dt; } };
const chase = (label, crime, { hide = false, max = 400 } = {}) => {
  P.pos.set(300, 0, -300); step(1); const t0 = t; api.commitCrime(crime, P.pos, null, true);
  let peak = api.lawAlive();
  while (W.active && t - t0 < max) { if (hide) { P.pos.x -= 12 * dt * 20; P.pos.z += 9 * dt * 20; } step(1); peak = Math.max(peak, api.lawAlive()); }
  console.log(`${label.padEnd(36)} chase ${W.active ? 'still going' : 'ended'} after ${Math.round(t - t0)} s · deputies drawn ${W.spawned} · most at once ${peak} · bounty $${P.bounty}`);
  P.bounty = 0; step(3);
};
// 1. petty crimes standing still in the open (deputies can see you)
chase('Assault, standing still', 'assault');
chase('Horse theft, standing still', 'horseTheft');
// 2. a big crime while riding hard away
chase('Bank robbery, riding away', 'bankRobbery', { hide: true });
// 3. a big crime standing in the open: does the posse run out?
chase('Bank robbery, standing still', 'bankRobbery');
// 4. killing deputies: fear, morale breaks and refusal
P.pos.set(300, 0, -300); step(1); api.commitCrime('murder', P.pos, null, true); step(8);
let killed = 0, fled = new Set();
for (let round = 0; round < 40 && !api.LAW.refuse; round++) {
  for (const e of api.outlaws) if (e.tag === 'law' && e.fleeing) fled.add(e);
  const d = api.outlaws.filter(e => e.tag === 'law' && !e.dead && !e.fleeing)[0];
  if (d) { api.hurt(d, 999, false, d.pos.clone()); killed++; }
  if (!W.active) { api.commitCrime('murder', P.pos, null, true); }
  step(6);
}
console.log(`Killing deputies: ${killed} killed · fear ${api.LAW.fear.toFixed(1)} · ${fled.size} broke and fled · law refuses: ${api.LAW.refuse}`);
step(30); console.log(`  after refusal: chase active ${W.active}, deputies riding against you ${api.lawAlive()}`);
const b0 = P.bounty; api.commitCrime('bankRobbery', P.pos, null, true); step(2);
console.log(`  new bank robbery while feared: wanted ${W.active}, bounty $${b0} -> $${P.bounty}`);
// 5. overnight: bounty lapse/shrink, fear recovery
W.active = false; P.bounty = 25; api.onNewDay(); const small = P.bounty; P.bounty = 400; api.onNewDay();
console.log(`Overnight: $25 bounty -> $${small} · $400 bounty -> $${P.bounty} · fear ${api.LAW.fear.toFixed(1)} · law refuses ${api.LAW.refuse}`);
console.log('game errors:', globalThis.__SIM.errors.length, globalThis.__SIM.errors.slice(0, 2));
