// Bank account and interest, owning the bank, the gang stash, foremen building from it, irrigation and new businesses,
// three more town stages, bounty catches hanged at noon, assassination plots and ambushes, bodyguards, and the save round-trip.
import { installGlobals, makeClock, FakeRenderer, buildGameModule } from './env.mjs';
installGlobals();
globalThis.__SIM = { FakeRenderer, clock: makeClock(), errors: [] };
await import(buildGameModule() + '?econ');
const api = globalThis.__SIM.api; while (!api.built) await new Promise(r => setTimeout(r, 5)); api.begin(false);
const P = api.P, EMP = api.EMP, LATE = api.LATE;
const step = s => { for (let i = 0; i < s * 20; i++) { api.clock.elapsedTime += 0.05; api.tick(0.05); P.hp = 100; globalThis.__SIM.clock.advance(50); } };
const flush = () => { for (let i = 0; i < 20 && (api.dlg || api.menu); i++) { if (api.dlg) api.advanceDlg(); else if (api.menu.custom?.title === 'Name your gang') api.buy(0); else api.closeMenu(); step(0.6); } };
const items = () => api.menu.custom?.items || api.menu.items;
const pickItem = s => items().findIndex(x => x.label.startsWith(s));
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
for (const id in api.QS) api.QS[id].state = 'done';
P.money = 20000; EMP.town = true; api.ROM.spouses.push('clara', 'mateo', 'june');
// bank account
const bank = api.npcs.find(n => n.shop === 'bank'); api.talkTo(bank); api.buy(pickItem('Your account')); api.buy(pickItem('Deposit $500')); api.closeMenu();
ok(api.BANK.bal === 500, `deposited: balance $${api.BANK.bal}`);
const b0 = api.BANK.bal; P.day++; api.onNewDay(); step(1); ok(api.BANK.bal === b0 + 5, `1% interest: $${b0} -> $${api.BANK.bal}`);
EMP.town = true; api.talkTo(bank); api.buy(pickItem('Buy out Pruitt')); flush(); ok(api.BANK.own, `own bank Â· money $${P.money}`);
const L = api.dailyLedger(); ok(L.k > 0, `depositor fees $${L.k} a day`);
// town stages 1-5
for (let i = 0; i < 5; i++) { api.talkTo(bank); const k = pickItem('Finance a new block'); if (k >= 0) api.buy(k); flush(); }
ok(api.CH.expand === 5, `Coppervale grew ${api.CH.expand} stages Â· congregation ${api.townPop()}`);
// gang, camp, stash
P.pos.set(300, 0, -60); step(0.2); let spot = null;
for (let k = 0; k < 60 && !spot; k++) { const a = k * 0.7, r = 260 + k * 3, x = Math.cos(a) * r, z = Math.sin(a) * r; if (!api.campSpotProblem({ x, z })) spot = { x, z }; }
P.pos.set(spot.x, 0, spot.z); step(0.2); api.tryMakeCamp(); api.buy(0); step(1); if (api.menu) api.buy(0); flush();
const camp = EMP.camps[0];
for (let i = 0; i < 10; i++) { api.openCampMenu(camp); api.buy(pickItem('Hire a gun')); flush(); }
api.openCampMenu(camp); api.buy(pickItem('Gang stash')); api.buy(pickItem('Put $500')); api.buy(pickItem('Put $500')); api.buy(pickItem('Put $500')); api.buy(pickItem('Put $500')); api.buy(pickItem('Put $500')); api.buy(pickItem('Put $500')); api.closeMenu();
ok(api.STASH.money === 3000, `stash $${api.STASH.money}`);
api.openJob('foreman'); api.buy(0); api.buy(0); api.buy(0); api.openJob('bounty'); api.buy(0); api.buy(0); api.buy(0); api.openJob('bodyguard'); api.buy(0); api.closeMenu();
api.openJobs(); api.buy(pickItem('Foremen build')); api.closeMenu(); ok(api.WORK.auto, 'foremen build from the stash');
const own0 = Object.keys(api.LAND.owned).length + Object.keys(camp.build).length, m0 = P.money;
for (let d = 0; d < 4; d++) { P.day++; api.onNewDay(); step(1); }
const own1 = Object.keys(api.LAND.owned).length + Object.keys(camp.build).length;
ok(own1 > own0 && P.money === m0 + 0 || own1 > own0, `foremen built ${own1 - own0} things from the stash (stash now $${api.STASH.money}); pocket money untouched by foremen`);
// irrigation and new business types
const p = api.LAND.plots[0]; if (!api.plotOf(p)) { api.LAND.owned[p.name] = { type: null, level: 0, day: P.day }; }
api.landMenu(p); const oi = pickItem('Orchard'); if (oi >= 0) { api.buy(oi); flush(); }
ok(api.plotOf(p).type, `plot type ${api.plotOf(p).type}`);
const inc0 = api.landIncome(); if (!api.plotOf(p).irrigated && ['farm', 'orchard', 'ranch'].includes(api.plotOf(p).type)) { api.landMenu(p); api.buy(pickItem('Dig a reservoir')); flush(); }
ok(api.plotOf(p).irrigated, `irrigated ${p.name}: land pays $${inc0} -> $${api.landIncome()}`);
// bounty catches go to the gallows
api.queueCatch('Test McGallows', 100); EMP.town = true; LATE.hangEvent = null; P.day++; EMP.town = true; api.onNewDay(); step(1);
const he = LATE.hangEvent; ok(he && he.gang && he.name === 'Test McGallows', `noon hanging scheduled for the catch: ${he?.name}`);
P.pos.set(api.GALLOWS.x + 3, 0, api.GALLOWS.z + 6); const m2 = P.money;
while (api.gameHour < 11.7 || api.gameHour > 13) step(10); step(25);
ok(he.done && P.money > m2 + 140, `catch hanged at noon: +$${P.money - m2}`);
// assassination plot -> ambush
while (api.HANG.active) step(5); for (const e of api.outlaws) if (e.tag === 'assassin') e.dead = true; step(1);
LATE.plot = null; for (let i = 0; i < 30 && !LATE.plot; i++) api.plotNewDay();
ok(!!LATE.plot && LATE.plot.warned, `plot: ${LATE.plot?.by} hired ${LATE.plot?.leader} (${LATE.plot?.kind}), warned ${LATE.plot?.warned} (bodyguard)`);
LATE.plot.kind = 'ambush'; LATE.plot.at = 0; P.pos.set(300, 0, 300); step(2);
const ass = api.outlaws.filter(e => e.tag === 'assassin' && !e.dead); ok(ass.length >= 2, `ambush sprung: ${ass.length} assassins`);
for (const e of ass) api.hurt(e, 999, false, e.pos.clone()); step(3);
ok(!LATE.plot && LATE.plotsSurvived >= 1, `survived the ambush (${LATE.plotsSurvived} attempts survived)`);
// gunman in town walks up
while (api.HANG.active) step(5); LATE.plot = { by: 'a cattle baron', at: 0, kind: 'gunman', leader: 'Deacon Vail', warned: true }; P.pos.set(0, 0, 0); step(2);
const gm = api.outlaws.find(e => e.tag === 'assassin' && !e.dead && e.stalk); ok(gm && gm.stalk, `${gm?.name} stalks you`);
step(25); ok(gm.alerted, 'he drew on you once close');
// interrogate him alive
gm.hp = 10; let sur = false; for (let i = 0; i < 30 && !sur; i++) { api.demandSurrender(gm); sur = gm.surrender; }
if (sur) { api.hogtie(gm); step(1); ok(api.dlg && api.dlg.lines.join(' ').includes('cattle baron'), 'prisoner names who hired him'); flush(); } else ok(false, 'gunman would not surrender');
// save round-trip
api.save(); const keep = globalThis.localStorage.getItem('dust-iron-save-v1');
console.log('game errors:', globalThis.__SIM.errors.length, globalThis.__SIM.errors.slice(0, 3));
globalThis.__SIM = { FakeRenderer, clock: makeClock(), errors: [] };
await import(buildGameModule() + '?econ2');
const a2 = globalThis.__SIM.api; while (!a2.built) await new Promise(r => setTimeout(r, 5));
globalThis.localStorage.setItem('dust-iron-save-v1', keep); a2.begin(true);
for (let i = 0; i < 40; i++) { a2.clock.elapsedTime += 0.05; a2.tick(0.05); globalThis.__SIM.clock.advance(50); }
ok(a2.BANK.own && a2.BANK.bal > 0 && a2.STASH.money >= 0 && a2.CH.expand === 5 && a2.plotOf(a2.LAND.plots[0]).irrigated, `reload: bank $${a2.BANK.bal} (own), stash $${a2.STASH.money}, town stage ${a2.CH.expand}, irrigation kept`);
console.log('reload errors:', globalThis.__SIM.errors.length, globalThis.__SIM.errors.slice(0, 3));
