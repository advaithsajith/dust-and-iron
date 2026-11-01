// Turns data/sessions.jsonl into analysis/summary.json and the paper's SVG figures.
// usage: node analysis/analyze.mjs [data/sessions.jsonl]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const runs = readFileSync(join(ROOT, process.argv[2] || 'data/sessions.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
const ok = runs.filter(r => !r.crash), crashed = runs.length - ok.length;
const PERS = ['storyteller', 'outlaw', 'empire', 'explorer', 'settler'], SK = ['novice', 'average', 'expert'];
const LABEL = { storyteller: 'Storyteller', outlaw: 'Outlaw', empire: 'Empire builder', explorer: 'Explorer', settler: 'Settler' };
const COLOR = { storyteller: '#2a78d6', outlaw: '#eb6834', empire: '#1baf7a', explorer: '#eda100', settler: '#e87ba4' };

const mean = a => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const median = a => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const ci95 = a => { const m = mean(a), sd = Math.sqrt(mean(a.map(x => (x - m) ** 2))) || 0; return 1.96 * sd / Math.sqrt(Math.max(1, a.length)); };
const r1 = x => Math.round(x * 10) / 10, r2 = x => Math.round(x * 100) / 100;

// Events that change the player's situation; used for event density and "dead air".
const MEANINGFUL = new Set(['quest_start', 'quest_stage', 'quest_complete', 'kill', 'crime', 'wanted_start', 'wanted_end', 'discovered', 'rank_up', 'gang_join',
  'camp_built', 'still_level', 'racket', 'blackmail', 'town_taken', 'married', 'child_born', 'robbery', 'loot', 'skin', 'purchase', 'fast_travel', 'court', 'horse_theft', 'solicit_success']);
// Systems a session can touch, for breadth of play.
const SYSTEMS = {
  missions: r => r.events.some(e => e.type === 'quest_complete' && e.quest !== 'intro'),
  hunting: r => r.events.some(e => e.type === 'skin'),
  crime: r => r.events.some(e => e.type === 'crime' || e.type === 'robbery' || e.type === 'horse_theft'),
  law_chase: r => r.events.some(e => e.type === 'wanted_start'),
  gang: r => r.events.some(e => e.type === 'gang_join'),
  camp_moonshine: r => r.events.some(e => e.type === 'camp_built' || e.type === 'still_level'),
  rackets_blackmail: r => r.events.some(e => e.type === 'racket' || e.type === 'blackmail'),
  town_takeover: r => r.events.some(e => e.type === 'town_taken'),
  romance: r => r.events.some(e => e.type === 'court' || e.type === 'married'),
  exploration: r => r.final.explored >= 30,
  fast_travel: r => r.events.some(e => e.type === 'fast_travel'),
};

// Simulated quitting. Frustration builds each minute from deaths, getting stuck, soft-locks and minutes with nothing
// happening, decays by 20 % a minute, and drops on big rewards. A bot "would quit" the first minute it passes its
// patience threshold. The weights are a stated model, not measured from people; the paper reports a sensitivity check.
function quitMinute(r, theta, w = { death: 3, stuck: 1.5, soft: 4, idle: 2, reward: 2 }) {
  const mins = Math.ceil(r.minutes);
  let F = 0;
  for (let m = 0; m < mins; m++) {
    const ev = r.events.filter(e => e.t >= m * 60 && e.t < (m + 1) * 60);
    const n = t => ev.filter(e => e.type === t).length;
    const meaningful = ev.some(e => MEANINGFUL.has(e.type));
    const reward = n('quest_complete') + n('rank_up') + n('married') + n('town_taken') + n('camp_built');
    F = Math.max(0, 0.8 * F + w.death * n('death') + w.stuck * n('stuck') + w.soft * n('softlock') + (meaningful ? 0 : w.idle) - w.reward * reward);
    if (F >= theta) return m + 1;
  }
  return null;
}
const thetaFor = r => 10 + ((r.seed * 2654435761) >>> 0) % 7;  // 10..16, fixed per bot

const rows = ok.map(r => {
  const mins = r.minutes, hrs = mins / 60, t = r.events.filter(e => MEANINGFUL.has(e.type)).map(e => e.t);
  const gaps = []; let last = 0; for (const x of t) { gaps.push(x - last); last = x; } gaps.push(mins * 60 - last);
  const firstQuest = r.events.find(e => e.type === 'quest_complete' && e.quest !== 'intro');
  const cnt = ty => r.events.filter(e => e.type === ty).length;
  return {
    id: r.id, persona: r.persona, skill: r.skill, ...r.final,
    epm: t.length / mins, longestGap: Math.max(...gaps) / 60, firstMission: firstQuest ? firstQuest.t / 60 : null,
    deathsPerHr: cnt('death') / hrs, stuckPerHr: cnt('stuck') / hrs, softlock: cnt('softlock') > 0, crimes: cnt('crime'), robberies: cnt('robbery'),
    breadth: Object.values(SYSTEMS).filter(f => f(r)).length, systems: Object.keys(SYSTEMS).filter(k => SYSTEMS[k](r)),
    quit: quitMinute(r, thetaFor(r)), quitLow: quitMinute(r, thetaFor(r) - 4), quitHigh: quitMinute(r, thetaFor(r) + 4),
    time: r.time, samples: r.samples, deathCauses: r.events.filter(e => e.type === 'death').map(e => e.cause),
    gaveUp: cnt('gave_up'), goalFails: cnt('goal_failed'), errors: r.errors.length,
  };
});

const by = (key, val) => rows.filter(x => x[key] === val);
const group = list => ({
  n: list.length,
  missions: r2(mean(list.map(x => x.questsDone))), missionsCI: r2(ci95(list.map(x => x.questsDone))),
  finishedStory: r1(100 * list.filter(x => x.questsDone >= 6).length / list.length),  // 6 missions in all, counting the introduction
  money: Math.round(median(list.map(x => x.money))),
  epm: r2(mean(list.map(x => x.epm))), longestGapMin: r1(median(list.map(x => x.longestGap))),
  firstMissionMin: r1(median(list.filter(x => x.firstMission != null).map(x => x.firstMission))),
  reachedFirstMission: r1(100 * list.filter(x => x.firstMission != null).length / list.length),
  deathsPerHr: r1(mean(list.map(x => x.deathsPerHr))), stuckPerHr: r1(mean(list.map(x => x.stuckPerHr))),
  softlockPct: r1(100 * list.filter(x => x.softlock).length / list.length),
  breadth: r1(mean(list.map(x => x.breadth))), explored: r1(mean(list.map(x => x.explored))),
  rank: Object.fromEntries(['Drifter', 'Outlaw', 'Gang Boss', 'Kingpin', 'Don of the Territory'].map(k => [k, list.filter(x => x.rank === k).length])),
  married: list.filter(x => x.spouse).length, tookTown: list.filter(x => x.town).length, gangAvg: r1(mean(list.map(x => x.gang))),
  wouldQuit: r1(100 * list.filter(x => x.quit != null).length / list.length),
  medianQuitMin: r1(median(list.filter(x => x.quit != null).map(x => x.quit))),
  wouldQuitLowPatience: r1(100 * list.filter(x => x.quitLow != null).length / list.length),
  wouldQuitHighPatience: r1(100 * list.filter(x => x.quitHigh != null).length / list.length),
});

const timeKeys = ['story', 'combat', 'hunting', 'crime', 'law', 'empire', 'romance', 'exploration', 'shopping', 'looting', 'retreat', 'dialogue', 'dead'];
const timeShare = list => { const tot = {}; let all = 0; for (const x of list) for (const [k, v] of Object.entries(x.time)) { tot[k] = (tot[k] || 0) + v; all += v; }
  return Object.fromEntries(timeKeys.map(k => [k, r1(100 * (tot[k] || 0) / all)])); };
const systemReach = Object.fromEntries(Object.keys(SYSTEMS).map(k => [k, r1(100 * rows.filter(x => x.systems.includes(k)).length / rows.length)]));
const survival = list => { const mins = Math.max(...list.map(() => ok[0].minutes)); const out = [];
  for (let m = 0; m <= mins; m += 2) out.push([m, r1(100 * list.filter(x => x.quit == null || x.quit > m).length / list.length)]); return out; };
const curve = (list, key) => { const T = list[0]?.samples.map(s => s.t) || []; return T.map((t, i) => [t / 60, median(list.map(x => x.samples[i]?.[key] ?? 0))]); };
const deathCauses = {}; for (const x of rows) for (const c of x.deathCauses) deathCauses[c] = (deathCauses[c] || 0) + 1;

const summary = {
  generated: new Date().toISOString(), sessions: runs.length, crashed, minutesPerSession: ok[0]?.minutes, totalHours: r1(ok.reduce((s, r) => s + r.minutes, 0) / 60),
  gameErrors: rows.reduce((s, x) => s + x.errors, 0),
  overall: group(rows),
  byPersona: Object.fromEntries(PERS.map(p => [p, group(by('persona', p))])),
  bySkill: Object.fromEntries(SK.map(s => [s, group(by('skill', s))])),
  timeShareByPersona: Object.fromEntries(PERS.map(p => [p, timeShare(by('persona', p))])),
  systemReach, deathCauses,
  survivalByPersona: Object.fromEntries(PERS.map(p => [p, survival(by('persona', p))])),
  moneyCurve: Object.fromEntries(PERS.map(p => [p, curve(by('persona', p), 'money')])),
  missionCurve: Object.fromEntries(PERS.map(p => [p, curve(by('persona', p), 'quests')])),
  exploredCurve: Object.fromEntries(PERS.map(p => [p, curve(by('persona', p), 'explored')])),
  gapP90Min: r1(pct(rows.map(x => x.longestGap), 0.9)),
};
mkdirSync(join(ROOT, 'analysis'), { recursive: true });
writeFileSync(join(ROOT, 'analysis', 'summary.json'), JSON.stringify(summary, null, 2));
writeFileSync(join(ROOT, 'analysis', 'per-session.csv'), ['id,persona,skill,missions,money,rank,kills,deaths_per_hr,stuck_per_hr,softlock,breadth,explored,epm,longest_gap_min,first_mission_min,would_quit_min',
  ...rows.map(x => [x.id, x.persona, x.skill, x.questsDone, x.money, `"${x.rank}"`, x.kills, r2(x.deathsPerHr), r2(x.stuckPerHr), x.softlock ? 1 : 0, x.breadth, x.explored, r2(x.epm), r2(x.longestGap), x.firstMission == null ? '' : r2(x.firstMission), x.quit ?? ''].join(','))].join('\n'));

// ---------- SVG figures: static, light surface, direct labels, recessive grid ----------
const INK = '#0b0b0b', INK2 = '#52514e', MUTED = '#898781', GRID = '#e1e0d9', AXIS = '#c3c2b7', SURF = '#fcfcfb';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
function frame(w, h, title, sub, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="system-ui,-apple-system,'Segoe UI',sans-serif" role="img" aria-label="${esc(title)}">
<rect width="${w}" height="${h}" fill="${SURF}"/>
<text x="24" y="30" font-size="16" font-weight="600" fill="${INK}">${esc(title)}</text>
<text x="24" y="50" font-size="12.5" fill="${INK2}">${esc(sub)}</text>
${body}</svg>`;
}
function lineChart(file, title, sub, series, { yMax, yLabel, xLabel = 'Minutes played', yFmt = v => v }) {
  const W = 760, H = 400, L = 58, R = 150, T = 70, B = 48, pw = W - L - R, ph = H - T - B;
  const xMax = Math.max(...series.flatMap(s => s.pts.map(p => p[0])));
  const X = x => L + x / xMax * pw, Y = y => T + ph - y / yMax * ph;
  let g = '';
  for (let i = 0; i <= 4; i++) { const v = yMax * i / 4, y = Y(v); g += `<line x1="${L}" x2="${L + pw}" y1="${y}" y2="${y}" stroke="${i ? GRID : AXIS}" stroke-width="1"/><text x="${L - 8}" y="${y + 4}" font-size="11" fill="${MUTED}" text-anchor="end">${yFmt(Math.round(v * 10) / 10)}</text>`; }
  for (let x = 0; x <= xMax; x += 10) g += `<text x="${X(x)}" y="${T + ph + 18}" font-size="11" fill="${MUTED}" text-anchor="middle">${x}</text>`;
  g += `<text x="${L + pw / 2}" y="${H - 10}" font-size="11.5" fill="${INK2}" text-anchor="middle">${esc(xLabel)}</text>`;
  g += `<text transform="translate(16 ${T + ph / 2}) rotate(-90)" font-size="11.5" fill="${INK2}" text-anchor="middle">${esc(yLabel)}</text>`;
  // direct labels at the line ends, nudged apart so they never collide
  const ends = series.map(s => ({ s, y: Y(s.pts.at(-1)[1]) })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 15) ends[i].y = ends[i - 1].y + 15;
  for (const s of series) { const d = s.pts.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join('');
    g += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    const last = s.pts.at(-1); g += `<circle cx="${X(last[0])}" cy="${Y(last[1])}" r="4" fill="${s.color}" stroke="${SURF}" stroke-width="2"/>`; }
  for (const e of ends) g += `<text x="${L + pw + 10}" y="${e.y + 4}" font-size="12" fill="${INK}"><tspan fill="${e.s.color}">■</tspan> ${esc(e.s.name)} <tspan fill="${INK2}">${yFmt(Math.round(e.s.pts.at(-1)[1] * 10) / 10)}</tspan></text>`;
  writeFileSync(join(ROOT, '..', 'paper', 'figures', file), frame(W, H, title, sub, g));
}
function barChart(file, title, sub, cats, { max, fmt = v => v, unit = '' }) {
  const W = 760, rowH = 34, L = 170, R = 70, T = 70, H = T + cats.length * rowH + 20, pw = W - L - R;
  let g = '';
  cats.forEach((c, i) => { const y = T + i * rowH, w = Math.max(2, c.v / max * pw);
    g += `<text x="${L - 10}" y="${y + rowH / 2 + 4}" font-size="12.5" fill="${INK}" text-anchor="end">${esc(c.name)}</text>`;
    g += `<path d="M${L},${y + 7} h${w - 4} a4,4 0 0 1 4,4 v${rowH - 22} a4,4 0 0 1 -4,4 h${-(w - 4)} z" fill="${c.color || '#2a78d6'}"/>`;
    g += `<text x="${L + w + 8}" y="${y + rowH / 2 + 4}" font-size="12" fill="${INK2}">${fmt(c.v)}${unit}</text>`; });
  g += `<line x1="${L}" x2="${L}" y1="${T}" y2="${T + cats.length * rowH}" stroke="${AXIS}"/>`;
  writeFileSync(join(ROOT, '..', 'paper', 'figures', file), frame(W, H, title, sub, g));
}
function stacked(file, title, sub, rowsIn, keys, colors) {
  const W = 760, rowH = 38, L = 130, R = 24, T = 96, H = T + rowsIn.length * rowH + 24, pw = W - L - R;
  let g = '', lx = 24;
  keys.forEach((k, i) => { g += `<rect x="${lx}" y="62" width="10" height="10" rx="2" fill="${colors[i]}"/><text x="${lx + 14}" y="71" font-size="11.5" fill="${INK2}">${esc(k.label)}</text>`; lx += 24 + k.label.length * 6.6; });
  rowsIn.forEach((r, i) => { const y = T + i * rowH; let x = L;
    g += `<text x="${L - 10}" y="${y + rowH / 2 + 4}" font-size="12.5" fill="${INK}" text-anchor="end">${esc(r.name)}</text>`;
    keys.forEach((k, j) => { const w = r.v[k.key] / 100 * pw; if (w < 0.5) return;
      g += `<rect x="${x.toFixed(1)}" y="${y + 6}" width="${Math.max(0, w - 2).toFixed(1)}" height="${rowH - 14}" fill="${colors[j]}"/>`;
      if (w > 34) g += `<text x="${(x + w / 2 - 1).toFixed(1)}" y="${y + rowH / 2 + 4}" font-size="11" fill="${['#eda100'].includes(colors[j]) ? INK : '#ffffff'}" text-anchor="middle">${Math.round(r.v[k.key])}%</text>`;
      x += w; }); });
  writeFileSync(join(ROOT, '..', 'paper', 'figures', file), frame(W, H, title, sub, g));
}
mkdirSync(join(ROOT, '..', 'paper', 'figures'), { recursive: true });
const S = summary, ser = obj => PERS.map(p => ({ name: LABEL[p], color: COLOR[p], pts: obj[p] }));
lineChart('fig1-retention.svg', 'Simulated retention by play style', `Share of bots still under their frustration threshold, ${S.sessions} sessions`, ser(S.survivalByPersona), { yMax: 100, yLabel: 'Still playing (%)', yFmt: v => `${v}%` });
lineChart('fig2-missions.svg', 'Story missions completed over time', 'Median per play style (6 missions, counting the introduction)', ser(S.missionCurve), { yMax: 6, yLabel: 'Missions completed' });
lineChart('fig3-money.svg', 'Cash on hand over time', 'Median dollars per play style', ser(S.moneyCurve), { yMax: Math.ceil(Math.max(50, ...PERS.flatMap(p => S.moneyCurve[p].map(x => x[1]))) * 1.05 / 200) * 200, yLabel: 'Dollars', yFmt: v => `$${Math.round(v)}` });
lineChart('fig4-explored.svg', 'Map explored over time', 'Median share of the territory revealed', ser(S.exploredCurve), { yMax: 100, yLabel: 'Map revealed (%)', yFmt: v => `${v}%` });
const TK = [{ key: 'story', label: 'Missions' }, { key: 'combat', label: 'Combat' }, { key: 'hunting', label: 'Hunting' }, { key: 'crime', label: 'Crime' }, { key: 'empire', label: 'Empire' },
  { key: 'romance', label: 'Romance' }, { key: 'exploration', label: 'Exploring' }, { key: 'dead', label: 'Dead/respawn' }];
const TC = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#898781'];
stacked('fig5-timeuse.svg', 'Where play time goes', 'Share of session time by activity (remaining time: travel, shopping, dialogue, retreating)', PERS.map(p => ({ name: LABEL[p], v: S.timeShareByPersona[p] })), TK, TC);
barChart('fig6-systems.svg', 'How many sessions touched each system', `Share of all ${S.sessions} sessions`, Object.entries(S.systemReach).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ name: k.replace(/_/g, ' '), v })), { max: 100, unit: '%' });
barChart('fig7-friction.svg', 'Deaths per hour by aiming skill', 'Mean across all play styles', SK.map(s => ({ name: s[0].toUpperCase() + s.slice(1), v: S.bySkill[s].deathsPerHr, color: '#e34948' })), { max: Math.max(...SK.map(s => S.bySkill[s].deathsPerHr)) * 1.2 });
console.log(JSON.stringify({ sessions: S.sessions, crashed, overall: S.overall, systemReach }, null, 1));
