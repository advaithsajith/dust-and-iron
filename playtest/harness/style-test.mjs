// Outfits, horse breeds and coats, the stable, waiting for money, plot reachability, and the save round-trip.
import { installGlobals, makeClock, FakeRenderer, buildGameModule } from './env.mjs';
installGlobals();
globalThis.__SIM = { FakeRenderer, clock: makeClock(), errors: [] };
await import(buildGameModule() + '?style');
const api = globalThis.__SIM.api; while (!api.built) await new Promise(r => setTimeout(r, 5)); api.begin(false);
const P = api.P;
const step = s => { for (let i = 0; i < s * 20; i++) { api.clock.elapsedTime += 0.05; api.tick(0.05); P.hp = 100; globalThis.__SIM.clock.advance(50); } };
const flush = () => { for (let i = 0; i < 20 && (api.dlg || api.menu); i++) { if (api.dlg) api.advanceDlg(); else if (api.menu.custom?.title === 'Name your gang') api.buy(0); else api.closeMenu(); step(0.6); } };
const items = () => api.menu.custom?.items || api.menu.items;
const pickItem = s => items().findIndex(x => x.label.startsWith(s));
const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
for (const id in api.QS) api.QS[id].state = 'done';
P.money = 5000;
// outfits
const hank = api.npcs.find(n => n.shop === 'outfitter'); api.talkTo(hank); api.buy(pickItem('Wardrobe')); ok(api.menu?.custom?.title.startsWith('Wardrobe'), api.menu?.custom?.title);
const before = api.PH.torso; api.buy(pickItem('Buy and wear: Gunslinger')); ok(api.STYLE.outfit === 'gunslinger' && api.PH.torso !== before && api.PH.g.children.length > 0, 'gunslinger outfit worn (model rebuilt)');
api.talkTo(hank); api.buy(pickItem('Wardrobe')); ok(items().some(x => x.label.includes('Don\'s finery') && x.off()), 'Don outfit locked below that rank'); api.closeMenu();
// livery
const gus = api.npcs.find(n => n.shop === 'livery'); ok(!!gus, 'Gus the Stablemaster at the livery');
api.talkTo(gus); ok(items().length >= 8, 'livery: ' + items().map(i => i.label.split(':')[0]).join(' | '));
const old = api.HORSE; api.buy(pickItem('Buy a Thoroughbred')); flush();
ok(api.HORSE !== old && api.HORSE.breed === 'thoroughbred' && api.HORSE.gal === 28, `new horse: ${api.HORSE.name} the Thoroughbred, gallop ${api.HORSE.gal}`);
ok(api.STYLE.stable.length === 1 && api.STYLE.stable[0].name === 'Biscuit', 'Biscuit is stabled');
// ride it: gallop speed
P.pos.copy(api.HORSE.pos); api.mount(); api.K.KeyW = true; api.K.ShiftLeft = true; step(4); const sp = api.HORSE.speed; api.K.KeyW = false; api.K.ShiftLeft = false; step(3);
ok(sp > 24, `thoroughbred gallops at ${sp.toFixed(1)} (mustang tops out at 19)`);
api.dismount(); step(0.5);
api.talkTo(gus); api.buy(pickItem('Groom and dye')); api.buy(4); flush(); ok(api.HORSE.coat === 4, 'coat dyed palomino');
api.talkTo(gus); api.buy(pickItem('Ride a horse from your stable')); api.buy(0); flush(); ok(api.HORSE.name === 'Biscuit' && api.STYLE.stable[0].breed === 'thoroughbred', 'switched back to Biscuit');
// waiting
const c0 = P.day, m0 = P.money; api.waitHours(24); step(2); ok(P.day === c0 + 1, `waited a day: day ${c0} -> ${P.day}, money ${m0} -> ${P.money}`);
api.EMP.town = true; const m1 = P.money; api.waitHours(72); step(2); ok(P.money > m1, `waited three days owning the town: +$${P.money - m1}`);
// plots all reachable
const bad = api.LAND.plots.filter(p => { const h = api.groundY(p.x, p.z); let open = 0; for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; let o = true, prev = h; for (let r = 4; r <= 150; r += 4) { const y = api.groundY(p.x + Math.cos(a) * r, p.z + Math.sin(a) * r); if (Math.abs(y - prev) > 2.2) { o = false; break; } prev = y; } if (o) open++; } return open < 10; });
ok(bad.length === 0, 'every land plot is reachable ' + bad.map(p => p.name).join(','));
// save and reload
api.talkTo(gus); api.buy(pickItem('Ride a horse from your stable')); api.buy(0); flush();
api.save(); const keep = globalThis.localStorage.getItem('dust-iron-save-v1');
console.log('game errors:', globalThis.__SIM.errors.length, globalThis.__SIM.errors.slice(0, 3));
globalThis.__SIM = { FakeRenderer, clock: makeClock(), errors: [] };
await import(buildGameModule() + '?style2');
const a2 = globalThis.__SIM.api; while (!a2.built) await new Promise(r => setTimeout(r, 5));
globalThis.localStorage.setItem('dust-iron-save-v1', keep); a2.begin(true);
for (let i = 0; i < 40; i++) { a2.clock.elapsedTime += 0.05; a2.tick(0.05); globalThis.__SIM.clock.advance(50); }
ok(a2.STYLE.outfit === 'gunslinger' && a2.HORSE.breed === 'thoroughbred' && a2.HORSE.coat === 4 && a2.HORSE.gal === 28, `reload: outfit ${a2.STYLE.outfit}, riding ${a2.HORSE.name} the ${a2.HORSE.breed}, coat ${a2.HORSE.coat}`);
ok(a2.STYLE.stable.length === 1, 'reload: stable kept');
console.log('reload errors:', globalThis.__SIM.errors.length, globalThis.__SIM.errors.slice(0, 3));
