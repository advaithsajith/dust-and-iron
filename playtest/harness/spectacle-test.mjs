// Death animations, kicks, the boxing ring, festivals and the parade, rigged elections, puppet mayors, grand projects, the casino.
import { installGlobals, makeClock, FakeRenderer, buildGameModule } from './env.mjs';
installGlobals();
globalThis.__SIM = { FakeRenderer, clock: makeClock(), errors: [] };
await import(buildGameModule() + '?spectacle');
const api = globalThis.__SIM.api; while (!api.built) await new Promise(r => setTimeout(r, 5)); api.begin(false);
const P = api.P;
const step = s => { for (let i = 0; i < s * 20; i++) { api.clock.elapsedTime += 0.05; api.tick(0.05); globalThis.__SIM.clock.advance(50); } };
const heal = () => { P.hp = 100; };
const flush = () => { for (let i = 0; i < 20 && (api.dlg || api.menu); i++) { if (api.dlg) api.advanceDlg(); else api.closeMenu(); step(0.3); } };
const items = () => api.menu.custom?.items || api.menu.items;
const pickItem = s => items().findIndex(x => x.label.startsWith(s));
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
for (const id in api.QS) api.QS[id].state = 'done';
P.money = 30000; api.EMP.town = true;
// death animations: shoot several outlaws and record how each fell
api.startRivals(); step(1); const kinds = new Set();
for (const e of api.outlaws.filter(e => e.tag === 'rival_creek').slice(0, 6)) { P.pos.set(e.pos.x + 6, 0, e.pos.z); api.hurt(e, 999, Math.random() < 0.3, e.pos.clone()); kinds.add(e.dieKind); }
step(2); ok(kinds.size >= 3, `death animations seen: ${[...kinds].join(', ')}`);
const fallen = api.outlaws.filter(e => e.dead && e.dieKind).every(e => e.fallT >= 1); ok(fallen, 'every fall animation finished');
// kick: sprint + V sends a man flying back
const target = api.outlaws.find(e => e.tag === 'rival_hollow' && !e.dead); P.pos.set(target.pos.x - 1.6, 0, target.pos.z); step(0.1);
api.cam.yaw = Math.atan2(target.pos.x - P.pos.x, target.pos.z - P.pos.z) + Math.PI; api.cam.pitch = 0;
const hp0 = target.hp, x0 = target.pos.x; api.K.ShiftLeft = true; api.pressV(); api.K.ShiftLeft = false; step(0.2);
ok(target.hp < hp0, `kick: ${hp0} -> ${Math.round(target.hp)} hp, pushed ${Math.abs(target.pos.x - x0).toFixed(1)} m`);
// boxing
const promoter = api.npcs.find(n => n.promoter); ok(!!promoter, 'Mickey Doyle runs the prize fights');
P.pos.set(promoter.pos.x + 1, 0, promoter.pos.z); heal(); step(0.2); api.talkTo(promoter); api.buy(pickItem('Fight, and bet $25')); step(0.5);
ok(api.BOX.active && api.BOX.opp && api.BOX.opp.melee, `bout started vs ${api.BOX.opp?.name}`);
const g0 = api.WEAPONS[0].ammo; api.K.ShiftLeft = false; step(0.2);
let hitsTaken = 0; const hp1 = P.hp; step(4); ok(P.hp < hp1, `${api.BOX.opp?.name} throws punches (you took ${Math.round(hp1 - P.hp)})`);
const m0 = P.money; let rounds = 0; while (api.BOX.active && rounds++ < 80) { const o = api.BOX.opp; if (!o) break; P.hp = Math.max(P.hp, 60); api.cam.yaw = Math.atan2(o.pos.x - P.pos.x, o.pos.z - P.pos.z) + Math.PI; api.P.punchT = 0; api.punch ? api.punch() : null; step(0.45); }
ok(!api.BOX.active && api.BOX.wins === 1 && P.money > m0, `won by knockout · +$${P.money - m0} (purse and bet) · rank ${api.BOX.rank}`);
// losing a bout doesn't kill you
api.talkTo(promoter); api.buy(pickItem('Fight ')); step(0.3); P.hp = 9; step(3); ok(!api.BOX.active && P.alive, `losing a bout leaves you standing (hp ${Math.round(P.hp)})`);
// festival
P.pos.set(0, 0, 2); heal(); while (api.gameHour >= 9.5 || api.gameHour < 6) step(20);
const hall = api.npcs.find(n => n.shop === 'x_townhall');
api.openWar(); api.buy(pickItem('Throw a festival')); flush(); ok(api.FEST.day === P.day, `festival planned for day ${api.FEST.day}`);
while (api.gameHour < 8.2) step(10); step(2); ok(api.FEST.started && api.npcs.filter(n => n.visitor).length === 14, `festival started: ${api.npcs.filter(n => n.visitor).length} visitors`);
while (api.gameHour < 12.2) step(10); ok(!!api.FEST.parade, `the parade marches (${api.FEST.parade?.list.length} marchers)`);
step(40); const fans = api.npcs.filter(n => n.paradeFan && Math.abs(Math.abs(n.pos.z) - 8.5) < 2).length; ok(fans >= 5, `${fans} townsfolk line the street`);
const m1 = P.money; P.day++; api.onNewDay(); step(2); ok(!api.FEST.started && P.money > m1, `festival over: visitors spent $${P.money - m1}`);
// elections
api.openElection(); api.buy(0); api.openElection(); ok(api.menu.custom.title.startsWith('Election on day'), api.menu.custom.title);
api.buy(pickItem('Hand out free whiskey')); api.buy(pickItem('Buy the Clarion')); api.closeMenu();
const sup = api.ELEC.support; ok(sup >= 60, `support after bribes and the newspaper: ${sup}%`);
while (P.day < api.ELEC.next) { P.day++; api.onNewDay(); api.EMP.town = true; step(1); }
while (api.gameHour < 12.2) { api.EMP.town = true; step(10); } ok(!!api.ELEC.mayor, `election day: ${api.ELEC.mayor} is mayor`);
// grand projects
P.money = 30000; api.openGrand(); for (let i = 0; i < 5; i++) { api.openGrand(); const k = items().findIndex(x => !x.off()); if (k >= 0) api.buy(k); flush(); }
ok(Object.keys(api.GRAND).length === 5 && api.rankInfo().name === 'Governor of the Arroyo', `built: ${Object.keys(api.GRAND).join(', ')} · rank ${api.rankInfo().name}`);
const L = api.dailyLedger(); ok(L.g >= 290, `grand projects pay $${L.g} a day`);
const croupier = api.npcs.find(n => n.casino); api.talkTo(croupier); const m2 = P.money; for (let i = 0; i < 20; i++) api.buy(0); ok(P.money !== m2, `20 hands of blackjack: ${P.money - m2 >= 0 ? '+' : '−'}$${Math.abs(P.money - m2)}`); api.closeMenu();
// puppet mayor in a conquered town
api.TW.owned.redrock = { day: P.day }; const rr = api.TOWNS.redrock; api.talkTo(rr.L); api.buy(pickItem('Install a puppet')); flush();
ok(!!api.TW.owned.redrock.puppet, `puppet in Red Rock: ${api.TW.owned.redrock.puppet} · tribute $${api.tributeTotal()}`);
// save
api.save(); const keep = globalThis.localStorage.getItem('dust-iron-save-v1');
console.log('game errors:', globalThis.__SIM.errors.length, globalThis.__SIM.errors.slice(0, 3));
globalThis.__SIM = { FakeRenderer, clock: makeClock(), errors: [] };
await import(buildGameModule() + '?spectacle2');
const a2 = globalThis.__SIM.api; while (!a2.built) await new Promise(r => setTimeout(r, 5));
globalThis.localStorage.setItem('dust-iron-save-v1', keep); a2.begin(true);
for (let i = 0; i < 40; i++) { a2.clock.elapsedTime += 0.05; a2.tick(0.05); globalThis.__SIM.clock.advance(50); }
ok(Object.keys(a2.GRAND).length === 5 && a2.BOX.wins >= 1 && a2.ELEC.mayor && a2.FEST.count === 1 && a2.npcs.some(n => n.casino), 'reload: grand projects, boxing record, mayor, festival count and croupier restored');
console.log('reload errors:', globalThis.__SIM.errors.length, globalThis.__SIM.errors.slice(0, 3));
