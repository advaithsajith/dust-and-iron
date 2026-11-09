// Kill the sheriff after the story, stand still, and see when the Marshal arrives.
import { installGlobals, makeClock, FakeRenderer, buildGameModule } from './env.mjs';
installGlobals();
globalThis.__SIM = { FakeRenderer, clock: makeClock(), errors: [] };
await import(buildGameModule() + '?marshal');
const api = globalThis.__SIM.api; while (!api.built) await new Promise(r => setTimeout(r, 5)); api.begin(false);
const P = api.P, LATE = api.LATE;
const step = s => { for (let i = 0; i < s * 20; i++) { api.clock.elapsedTime += 0.05; api.tick(0.05); P.hp = 100; globalThis.__SIM.clock.advance(50); } };
for (const id in api.QS) api.QS[id].state = 'done';
const sh = api.NPC.sheriff; P.pos.set(sh.pos.x + 3, 0, sh.pos.z); step(0.5);
api.hurtNPC(sh, false, 999);
sh.hp = 0; api.hurtNPC(sh);
console.log('sheriff dead', sh.dead, 'marshal state', LATE.marshal.state, 'bounty', P.bounty);
for (let t = 0; t < 600; t += 10) { step(10); if (LATE.marshal.group) { const b = LATE.marshal.group[0]; console.log(`after ${t + 10}s: Marshal spawned ${Math.round(api.d2(b.pos, P.pos))} m away, state ${LATE.marshal.state}, bounty ${P.bounty}, wanted ${api.WANTED.active}`); break; } }
if (!LATE.marshal.group) console.log('no marshal after 600 s', LATE.marshal, 'hours', P.day, api.gameHour);
const b=LATE.marshal.group&&LATE.marshal.group[0]; const lawNow=api.outlaws.filter(e=>e.tag==='law'&&!e.dead).length; if(b){b.hp=1; api.hurt(b,999,false,b.pos.clone()); step(2);} console.log('town deputies riding', lawNow, '| marshal killed -> state', LATE.marshal.state, 'bounty', P.bounty, 'law forever', api.LAW.forever);
console.log('errors', globalThis.__SIM.errors.slice(0, 3));
