// Re-derives the corrected headline numbers the paper cites (after peer review), with Wilson 95% intervals.
// usage: node analysis/verify.mjs [data/sessions.jsonl]
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const L = readFileSync(join(ROOT, process.argv[2] || 'data/sessions.jsonl'), 'utf8').trim().split('\n').map(JSON.parse).filter(r => !r.crash);
const wilson = (k, n) => { const z = 1.96, p = k / n, d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d, h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d; return [+(100 * (c - h)).toFixed(1), +(100 * (c + h)).toFixed(1)]; };
const share = (k, n) => ({ k, n, pct: +(100 * k / n).toFixed(1), ci: wilson(k, n) });
const median = a => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const out = {};

// 1. resource exhaustion: does money recover afterwards?
const soft = r => r.events.find(e => e.type === 'softlock');
const recovered = r => { const s = soft(r); return s && r.samples.some(x => x.t > s.t + 30 && x.money >= 10); };
for (const group of ['outlaw', 'other']) {
  const rs = L.filter(r => group === 'outlaw' ? r.persona === 'outlaw' : r.persona !== 'outlaw'), hit = rs.filter(soft);
  out[`exhaustion_${group}`] = { ...share(hit.length, rs.length), recovered: hit.filter(recovered).length, onsetMedianMin: +(median(hit.map(r => soft(r).t)) / 60).toFixed(1) };
}
out.exhaustion_unrecovered_by_persona = Object.fromEntries(['storyteller', 'empire', 'explorer', 'settler'].map(p => { const rs = L.filter(r => r.persona === p); return [p, share(rs.filter(r => soft(r) && !recovered(r)).length, rs.length)]; }));

// 2. law chases among outlaw bots
const ol = L.filter(r => r.persona === 'outlaw'); let chases = 0, died = 0;
for (const r of ol) for (const e of r.events) if (e.type === 'wanted_end') { chases++; if (e.how === 'died') died++; }
out.outlaw_chases = { ...share(died, chases), bountiesPaid: ol.reduce((s, r) => s + r.events.filter(e => e.type === 'purchase' && e.what === 'bounty_paid').length, 0) };

// 3. first real mission, censoring non-completers at session end (Kaplan-Meier median)
const firstM = r => { const e = r.events.find(e => e.type === 'quest_complete' && e.quest !== 'intro'); return e ? e.t / 60 : null; };
const km = rs => { const pts = rs.map(r => ({ t: firstM(r) ?? r.minutes, ev: firstM(r) != null })).sort((a, b) => a.t - b.t); let S = 1, n = pts.length;
  for (const p of pts) { if (p.ev) { S *= (n - 1) / n; if (S <= 0.5) return +p.t.toFixed(1); } n--; } return null; };
out.first_mission = { completed: share(L.filter(r => firstM(r) != null).length, L.length), medianAmongCompleters: +median(L.filter(r => firstM(r) != null).map(firstM)).toFixed(1),
  kmMedianAll: km(L), kmMedianStorytellers: km(L.filter(r => r.persona === 'storyteller')),
  bySkill: Object.fromEntries(['novice', 'average', 'expert'].map(s => { const rs = L.filter(r => r.skill === s); return [s, share(rs.filter(r => firstM(r) != null).length, rs.length)]; })) };

// 4. stuck: collapse repeats within 20 m and 30 s into one episode; find hotspots
let ev = 0, eps = 0; const cells = {};
for (const r of L) { let last = null; const seen = new Set();
  for (const e of r.events) { if (e.type !== 'stuck') continue; ev++;
    if (!(last && Math.hypot(e.x - last.x, e.z - last.z) < 20 && e.t - last.t < 30)) { eps++; const c = `${Math.floor(e.x / 20) * 20},${Math.floor(e.z / 20) * 20}`; if (!seen.has(c)) { seen.add(c); cells[c] = (cells[c] || 0) + 1; } }
    last = e; } }
const hrs = L.reduce((s, r) => s + r.minutes, 0) / 60;
out.stuck = { events: ev, episodes: eps, episodesPerHour: +(eps / hrs).toFixed(1), explorerEpisodesPerHour: null,
  topCells: Object.entries(cells).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([c, n]) => ({ cell: c, sessions: n })) };
{ const ex = L.filter(r => r.persona === 'explorer'); let e2 = 0; for (const r of ex) { let last = null; for (const e of r.events) { if (e.type !== 'stuck') continue; if (!(last && Math.hypot(e.x - last.x, e.z - last.z) < 20 && e.t - last.t < 30)) e2++; last = e; } }
  out.stuck.explorerEpisodesPerHour = +(e2 / (ex.length * ex[0].minutes / 60)).toFixed(1); }

// 5. where the money came from
const inc = {}; for (const r of L) { const p = r.persona; inc[p] ||= { loot: 0, robbery: 0 }; for (const e of r.events) { if (e.type === 'loot') inc[p].loot += e.gain || 0; if (e.type === 'robbery') inc[p].robbery += e.gain || 0; } }
out.income_from_events = inc;

// 6. would-quit with intervals, and the reward events the model credits
out.would_quit = Object.fromEntries(['storyteller', 'outlaw', 'empire', 'explorer', 'settler'].map(p => [p, null]));
const csv = readFileSync(join(ROOT, 'analysis', 'per-session.csv'), 'utf8').trim().split('\n').slice(1).map(l => l.split(','));
for (const p in out.would_quit) { const rs = csv.filter(c => c[1] === p); out.would_quit[p] = share(rs.filter(c => c[15] !== '').length, rs.length); }
out.empire_don = { all: share(L.filter(r => r.persona === 'empire' && r.final.rank === 'Don of the Territory').length, 60),
  medianMinToDon: +median(L.filter(r => r.persona === 'empire').map(r => r.events.find(e => e.type === 'rank_up' && e.rank === 'Don of the Territory')).filter(Boolean).map(e => e.t / 60)).toFixed(1) };
out.fast_travel_duplicates = L.reduce((s, r) => { const ft = r.events.filter(e => e.type === 'fast_travel'); return s + ft.filter((e, i) => i && e.t - ft[i - 1].t < 2).length; }, 0);
// 7. sensitivity of the quit model: the same definition as analyze.mjs, with its weights, decay and patience perturbed
const MEAN = new Set(['quest_start', 'quest_stage', 'quest_complete', 'kill', 'crime', 'wanted_start', 'wanted_end', 'discovered', 'rank_up', 'gang_join',
  'camp_built', 'still_level', 'racket', 'blackmail', 'town_taken', 'married', 'child_born', 'robbery', 'loot', 'skin', 'purchase', 'fast_travel', 'court', 'horse_theft', 'solicit_success']);
const perMin = L.map(r => { const m = []; for (let i = 0; i < r.minutes; i++) m.push({ death: 0, stuck: 0, soft: 0, mean: false, reward: 0 });
  for (const e of r.events) { const b = m[Math.min(r.minutes - 1, Math.floor(e.t / 60))]; if (e.type === 'death') b.death++; if (e.type === 'stuck') b.stuck++; if (e.type === 'softlock') b.soft++;
    if (MEAN.has(e.type)) b.mean = true; if (['quest_complete', 'rank_up', 'married', 'town_taken', 'camp_built'].includes(e.type)) b.reward++; }
  return { persona: r.persona, theta: 10 + ((r.seed * 2654435761) >>> 0) % 7, m }; });
const quits = (w) => perMin.map(s => { let F = 0; for (const b of s.m) { F = Math.max(0, w.decay * F + w.death * b.death + w.stuck * b.stuck + w.soft * b.soft + (b.mean ? 0 : w.idle) - w.reward * b.reward); if (F >= s.theta + w.dTheta) return true; } return false; });
const BASE = { death: 3, stuck: 1.5, soft: 4, idle: 2, reward: 2, decay: 0.8, dTheta: 0 };
const rateBy = q => Object.fromEntries(['storyteller', 'outlaw', 'empire', 'explorer', 'settler'].map(p => { const idx = perMin.map((s, i) => s.persona === p ? i : -1).filter(i => i >= 0); return [p, +(100 * idx.filter(i => q[i]).length / idx.length).toFixed(1)]; }));
let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const draws = []; let worstHolds = 0, bestHolds = 0;
for (let k = 0; k < 200; k++) {
  const w = { death: 3 * (0.5 + rnd()), stuck: 1.5 * (0.5 + rnd()), soft: 4 * (0.5 + rnd()), idle: 2 * (0.5 + rnd()), reward: 2 * (0.5 + rnd()), decay: 0.7 + 0.2 * rnd(), dTheta: -4 + 8 * rnd() };
  const q = quits(w), all = 100 * q.filter(Boolean).length / q.length, by = rateBy(q), order = Object.entries(by).sort((a, b) => b[1] - a[1]).map(x => x[0]);
  draws.push(all); if (['outlaw', 'explorer'].includes(order[0])) worstHolds++; if (['settler', 'empire'].includes(order.at(-1))) bestHolds++;
}
draws.sort((a, b) => a - b);
out.quit_sensitivity = { base: rateBy(quits(BASE)), baseOverall: +(100 * quits(BASE).filter(Boolean).length / L.length).toFixed(1),
  joint200: { p5: +draws[10].toFixed(1), median: +draws[100].toFixed(1), p95: +draws[190].toFixed(1), worstIsOutlawOrExplorer: worstHolds, bestIsSettlerOrEmpire: bestHolds },
  ablation_noStuck: rateBy(quits({ ...BASE, stuck: 0 })), ablation_noIdle: rateBy(quits({ ...BASE, idle: 0 })) };
writeFileSync(join(ROOT, 'analysis', 'verified.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 1));
