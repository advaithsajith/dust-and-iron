// Gang jobs: assign riders, let a game day pass, check each job's work, auto-expand, guards, and the save round-trip.
import { installGlobals, makeClock, FakeRenderer, buildGameModule } from './env.mjs';
installGlobals();
globalThis.__SIM = { FakeRenderer, clock: makeClock(), errors: [] };
await import(buildGameModule() + '?jobs');
const api = globalThis.__SIM.api; while (!api.built) await new Promise(r => setTimeout(r, 5)); api.begin(false);
const P = api.P, EMP = api.EMP;
const step = s => { for (let i = 0; i < s * 20; i++) { api.clock.elapsedTime += 0.05; api.tick(0.05); P.hp = 100; globalThis.__SIM.clock.advance(50); } };
const flush = () => { for (let i = 0; i < 20 && (api.dlg || api.menu); i++) { if (api.dlg) api.advanceDlg(); else if (api.menu.custom?.title === 'Name your gang') api.buy(0); else api.closeMenu(); step(0.6); } };
const items = () => api.menu.custom?.items || api.menu.items;
const pickItem = s => items().findIndex(x => x.label.startsWith(s));
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
for (const id in api.QS) api.QS[id].state = 'done';
P.money = 3000;
// a camp with a still, and a gang of 16
P.pos.set(300, 0, -60); step(0.2); let spot = null;
for (let k = 0; k < 60 && !spot; k++) { const a = k * 0.7, r = 260 + k * 3, x = Math.cos(a) * r, z = Math.sin(a) * r; if (!api.campSpotProblem({ x, z })) spot = { x, z }; }
P.pos.set(spot.x, 0, spot.z); step(0.2); api.tryMakeCamp(); api.buy(0); step(1); if (api.menu) api.buy(0); flush();
const camp = EMP.camps[0]; camp.build.cabin = 1;
api.EMP.town = true; api.ROM.spouses.push('clara', 'mateo', 'june'); for (let i = 0; i < 16; i++) { const a = api.spawnAlly ? null : null; }
const g0 = api.liveGang().length; for (let i = g0; i < 16; i++) { api.ROM.spouses.length; }
// hire up to 16 riders at the camp
for (let i = 0; i < 16 && api.liveGang().length < api.gangCap(); i++) { api.openCampMenu(camp); api.buy(pickItem('Hire a gun')); flush(); }
ok(api.liveGang().length >= 10, `gang of ${api.liveGang().length} (cap ${api.gangCap()})`);
// the menu
api.openJobs(); ok(api.menu?.custom?.title.startsWith('Gang work'), api.menu.custom.title + ` Â· ${items().length} rows`);
const plan = { runner: 1, bounty: 2, hunter: 1, robber: 1, racket: 1, guard: 2, foreman: 2, recruit: 1 };
for (const [k, n] of Object.entries(plan)) for (let i = 0; i < n; i++) { api.openJob(k); api.buy(0); }
api.closeMenu();
ok(Object.entries(plan).every(([k, n]) => api.onJob(k).length === n), 'jobs assigned: ' + Object.keys(plan).map(k => `${k} ${api.onJob(k).length}`).join(', '));
const hidden = api.liveGang().filter(a => api.jobOf(a) !== 'ride' && api.jobOf(a) !== 'guard');
ok(hidden.every(a => !a.h.g.visible), `${hidden.length} workers are off on their jobs (hidden)`);
const guards = api.onJob('guard'); ok(guards.every(a => a.h.g.visible && api.d2(a.pos, camp) < 20), 'guards stand at the homestead');
ok(api.homeDefense() >= 4, `home defense ${api.homeDefense()}`);
// a game day of work, away from home
P.pos.set(0, 0, 0); camp.stock = 12;
const m0 = P.money, r0 = Object.keys(EMP.rackets).length, b0 = P.bounty;
for (let h = 0; h < 24; h++) step(40);
ok(camp.stock <= 2, `runners emptied the camp (stock ${camp.stock})`);
const today = api.WORK.today; ok(true, 'earned in 24 h: ' + Object.entries(today).map(([k, v]) => `${k} $${v}`).join(', ') + ` Â· money ${m0} -> ${P.money}`);
ok((today.runner || 0) > 0 && (today.hunter || 0) > 0, 'runner and hunter earned');
ok(Object.keys(EMP.rackets).length > r0, `racketeer added rackets: ${r0} -> ${Object.keys(EMP.rackets).length}`);
ok(api.liveGang().length >= 10, `recruiter kept the gang growing: ${api.liveGang().length}`);
// auto-expand: give money, toggle on, new day
api.LAND.plots; P.money = 4000; api.WORK.auto = true; api.WORK.reserve = 500; const own0 = Object.keys(api.LAND.owned).length + Object.keys(camp.build).length;
P.day++; api.onNewDay(); step(2);
{ const own1 = Object.keys(api.LAND.owned).length + Object.keys(camp.build).length; ok(own1 >= own0 + 2 && P.money >= 500, `foremen expanded holdings: ${own0} -> ${own1} (homestead: ${Object.keys(camp.build).join(',')}; deeds ${Object.keys(api.LAND.owned).length}), money $${P.money}`); }
// call everyone back
api.openJobs(); api.buy(pickItem('Call everyone back')); ok(api.liveGang().every(a => api.jobOf(a) === 'ride' && a.h.g.visible), 'everyone called back');
// save and reload with jobs
api.openJob('runner'); api.buy(1); api.closeMenu(); const nRun = api.onJob('runner').length;
api.save(); const keep = globalThis.localStorage.getItem('dust-iron-save-v1');
console.log('game errors:', globalThis.__SIM.errors.length, globalThis.__SIM.errors.slice(0, 3));
globalThis.__SIM = { FakeRenderer, clock: makeClock(), errors: [] };
await import(buildGameModule() + '?jobs2');
const a2 = globalThis.__SIM.api; while (!a2.built) await new Promise(r => setTimeout(r, 5));
globalThis.localStorage.setItem('dust-iron-save-v1', keep); a2.begin(true);
for (let i = 0; i < 40; i++) { a2.clock.elapsedTime += 0.05; a2.tick(0.05); globalThis.__SIM.clock.advance(50); }
ok(a2.onJob('runner').length === nRun && a2.WORK.auto, `reload: ${nRun} runners still working, auto-expand on`);
console.log('reload errors:', globalThis.__SIM.errors.length, globalThis.__SIM.errors.slice(0, 3));
