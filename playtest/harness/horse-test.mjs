// Checks deputies' horses: loose when he dismounts, grazing, shootable, skinnable, stealable.
import { installGlobals, makeClock, FakeRenderer, buildGameModule } from './env.mjs';
installGlobals();
globalThis.__SIM = { FakeRenderer, clock: makeClock(), errors: [] };
await import(buildGameModule() + '?horse');
const api = globalThis.__SIM.api; while (!api.built) await new Promise(r => setTimeout(r, 5)); api.begin(false);
const P = api.P, dt = 0.05;
const step = s => { for (let i = 0; i < s / dt; i++) { api.clock.elapsedTime += dt; api.tick(dt); P.hp = 100; globalThis.__SIM.clock.advance(dt * 1000); } };
P.pos.set(300, 0, -300); step(1);
const n0 = api.horses.length;
const a = api.spawnLawman(320, -300), b = api.spawnLawman(280, -300);
api.dismountLaw(a); api.dismountLaw(b); step(2);
const ha = a.loose, hb = b.loose;
console.log(`loose horses after dismount: ${api.horses.length - n0} · named "${ha.name}" · owned ${ha.owned}`);
const neck0 = ha.q.neck.rotation.x; step(3);
console.log(`grazing: neck ${neck0.toFixed(2)} -> ${ha.q.neck.rotation.x.toFixed(2)} (head lowers)`);
// shoot one horse dead, then skin it
api.hurt(ha, 60, false, ha.pos.clone()); step(0.5);
console.log(`shot once: hp ${ha.hp} · bolting ${ha.fearT > 0} · moved ${Math.hypot(ha.pos.x - 320, ha.pos.z + 300).toFixed(1)} m`);
api.hurt(ha, 200, false, ha.pos.clone()); step(1);
P.pos.set(ha.pos.x + 1.5, 0, ha.pos.z); step(0.2); const it = api.findInteract(); const p0 = P.pelts;
console.log(`dead: ${ha.dead} · prompt "${it && it.label}"`); if (it) it.act(); step(3);
console.log(`skinned: hides ${p0} -> ${P.pelts} · carcass removed ${!api.horses.includes(ha)}`);
// steal the other horse, then make its deputy try to remount
P.pos.set(hb.pos.x + 1.5, 0, hb.pos.z); step(0.2); const ok = api.mount();
console.log(`stole: mounted ${ok} · riding "${api.HORSE.name}" · owned ${api.HORSE.owned} · bounty $${P.bounty}`);
api.remountLaw(b); console.log(`deputy whose horse was stolen remounted: ${b.mounted} (stays on foot)`);
console.log('game errors:', globalThis.__SIM.errors.length, globalThis.__SIM.errors.slice(0, 2));
