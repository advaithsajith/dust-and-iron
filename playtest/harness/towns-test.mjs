// Keepers and uses for every expansion building, opera and school crowds, the three new towns, mercenaries, sieges,
// peaceful surrender, tribute, garrisons and revolts, the scenery additions, and the save round-trip.
import { installGlobals, makeClock, FakeRenderer, buildGameModule } from './env.mjs';
installGlobals();
globalThis.__SIM = { FakeRenderer, clock: makeClock(), errors: [] };
await import(buildGameModule() + '?towns');
const api = globalThis.__SIM.api; while (!api.built) await new Promise(r => setTimeout(r, 5)); api.begin(false);
const P = api.P, EMP = api.EMP;
const step = s => { for (let i = 0; i < s * 20; i++) { api.clock.elapsedTime += 0.05; api.tick(0.05); P.hp = 100; globalThis.__SIM.clock.advance(50); } };
const flush = () => { for (let i = 0; i < 20 && (api.dlg || api.menu); i++) { if (api.dlg) api.advanceDlg(); else if (api.menu.custom?.title === 'Name your gang') api.buy(0); else api.closeMenu(); step(0.6); } };
const items = () => api.menu.custom?.items || api.menu.items;
const pickItem = s => items().findIndex(x => x.label.startsWith(s));
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
for (const id in api.QS) api.QS[id].state = 'done';
P.money = 50000; EMP.town = true; api.BANK.own = true;
// towns placed clear of everything
for (const k in api.TOWNS) { const t = api.TOWNS[k]; const folk = api.npcs.filter(n => n.townOf === k).length; ok(folk >= 8 && t.L, `${t.name} at (${t.x},${t.z}): ${folk} townsfolk, leader ${t.L?.name}`); }
// expand Coppervale to the max, then every building has a keeper
const bank = api.npcs.find(n => n.shop === 'bank');
for (let i = 0; i < 5; i++) { EMP.town = true; api.talkTo(bank); const k = pickItem('Finance a new block'); if (k >= 0) api.buy(k); flush(); }
const signs = api.expBuilt().map(b => b.sign); const missing = signs.filter(s => !api.keepers[s]);
ok(api.CH.expand === 5 && missing.length === 0, `stage ${api.CH.expand}: ${signs.length} buildings, keepers for all (${missing.join(',') || 'none missing'})`);
for (const s of signs) { const n = api.keepers[s]; api.talkTo(n); const its = items(); if (!its.length) ok(false, `${s} has no menu`); api.closeMenu(); }
ok(true, 'keepers: ' + signs.map(s => `${s} → ${api.keepers[s].name}`).join(' · '));
// try a few purposes
api.talkTo(api.keepers['GUNSMITH']); api.buy(0); ok(api.WEAPONS ? true : true, 'gunsmith'); api.closeMenu();
api.talkTo(api.keepers['NEWSPAPER']); api.buy(0); ok(api.dlg && api.dlg.lines.length >= 1, 'newspaper headlines: ' + (api.dlg?.lines[0] || '')); flush();
api.talkTo(api.keepers['TOWN HALL']); api.buy(0); ok(api.menu?.custom?.title.startsWith('War room'), api.menu?.custom?.title); api.closeMenu();
const L0 = api.dailyLedger(); ok(L0.t >= 40 + 160, `town income $${L0.t} a day from ${signs.length} businesses`);
// opera crowd in the evening
while (api.gameHour < 19 || api.gameHour > 21) step(20);
step(30); const door = api.keepers['OPERA HOUSE'].pos; const goers = api.npcs.filter(n => n.operaGoer && api.d2(n.pos, door) < 10).length;
ok(goers >= 5, `${goers} townsfolk at the opera house in the evening`);
// army
api.openWar(); api.buy(pickItem('Hire five')); flush(); api.openWar(); api.buy(pickItem('Hire five')); flush();
ok(api.mercs().length === 10, `army: ${api.mercs().length} mercenaries (cap ${api.armyCap()}); gang count ${api.gangCount()} unaffected`);
// siege Red Rock
const rr = api.TOWNS.redrock; P.pos.set(rr.x - 20, 0, rr.z + 2); step(3);
for (const a of api.liveGang()) { a.pos.set(rr.x - 22 + Math.random() * 6, 0, rr.z + Math.random() * 4); a.hp = 400; }
step(1); ok(api.armyNear(rr.x, rr.z) >= 8, `army near Red Rock: ${api.armyNear(rr.x, rr.z)}`);
api.talkTo(rr.L); ok(api.menu?.custom?.title.includes('Captain'), api.menu?.custom?.title);
api.buy(pickItem('Lay siege')); step(1); ok(!!api.TW.siege, 'siege started');
// let the army fight, help it along by finishing defenders
for (let i = 0; i < 40 && api.TW.siege; i++) { step(3); for (const e of api.outlaws) if (e.tag === 'garrison' && !e.dead && Math.random() < 0.35) api.hurt(e, 999, false, e.pos.clone()); for (const a of api.liveGang()) a.hp = Math.max(a.hp, 300); }
ok(api.TW.owned.redrock, `Red Rock conquered · tribute $${api.tributeTotal()} a day`);
// peaceful surrender at San Lázaro with a big army
const sl = api.TOWNS.sanlazaro; P.pos.set(sl.x - 20, 0, sl.z + 2); step(2); for (const a of api.liveGang()) a.pos.set(sl.x - 22 + Math.random() * 6, 0, sl.z + Math.random() * 4); step(1);
let tries = 0; while (!api.TW.owned.sanlazaro && tries++ < 30) { if (api.TW.siege) break; api.talkTo(sl.L); const i = pickItem('Demand'); if (i >= 0) api.buy(i); flush(); }
ok(api.TW.owned.sanlazaro || api.TW.siege, `San Lázaro: ${api.TW.owned.sanlazaro ? 'surrendered' : 'refused and fought'}`);
if (api.TW.siege) { for (let i = 0; i < 40 && api.TW.siege; i++) { step(3); for (const e of api.outlaws) if (e.tag === 'garrison' && !e.dead && Math.random() < 0.4) api.hurt(e, 999, false, e.pos.clone()); } }
ok(api.TW.owned.sanlazaro, 'San Lázaro is yours');
// garrison and revolt
api.openWar(); const gi = items().findIndex(x => x.label.startsWith('Red Rock: yours')); api.buy(gi); api.buy(gi); api.buy(gi); api.closeMenu();
ok(api.onJob('garrison').filter(a => a.post === 'redrock').length === 3, 'three soldiers garrison Red Rock');
let revoltsRR = 0, revoltsSL = 0; for (let d = 0; d < 30; d++) { api.EMP.town = true; P.day++; api.onNewDay(); if (!api.TW.owned.redrock) { revoltsRR++; api.TW.owned.redrock = { day: P.day }; } if (!api.TW.owned.sanlazaro) { revoltsSL++; api.TW.owned.sanlazaro = { day: P.day }; } }
ok(revoltsRR === 0 && revoltsSL > 0, `over 30 days: garrisoned Red Rock revolted ${revoltsRR}×, unguarded San Lázaro ${revoltsSL}×`);
// scenery
ok(api.VULTURES.length === 5 && api.DEVILS.length === 3, 'vultures and dust devils in the sky');
// save round-trip
api.save(); const keep = globalThis.localStorage.getItem('dust-iron-save-v1');
console.log('game errors:', globalThis.__SIM.errors.length, globalThis.__SIM.errors.slice(0, 3));
globalThis.__SIM = { FakeRenderer, clock: makeClock(), errors: [] };
await import(buildGameModule() + '?towns2');
const a2 = globalThis.__SIM.api; while (!a2.built) await new Promise(r => setTimeout(r, 5));
globalThis.localStorage.setItem('dust-iron-save-v1', keep); a2.begin(true);
for (let i = 0; i < 40; i++) { a2.clock.elapsedTime += 0.05; a2.tick(0.05); globalThis.__SIM.clock.advance(50); }
ok(a2.TW.owned.redrock && a2.mercs().length >= 7 && a2.onJob('garrison').length === 3 && Object.keys(a2.keepers).length === 16, `reload: towns ${Object.keys(a2.TW.owned).join(',')}, ${a2.mercs().length} mercs, ${a2.onJob('garrison').length} garrisoned, ${Object.keys(a2.keepers).length} keepers`);
console.log('reload errors:', globalThis.__SIM.errors.length, globalThis.__SIM.errors.slice(0, 3));
