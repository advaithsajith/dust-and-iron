// Headless environment for running the real game script in Node: minimal DOM stand-ins, a fake WebGL renderer,
// and a virtual clock so the game's setTimeout/setInterval follow simulated time instead of wall time.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const GAME_HTML = join(HERE, '..', '..', 'index.html');
const BUILD = join(HERE, '..', '.build');

function ctx2d() {
  const noop = () => {};
  const target = {
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    measureText: t => ({ width: String(t).length * 20 }),
    createRadialGradient: () => ({ addColorStop: noop }),
    createLinearGradient: () => ({ addColorStop: noop }),
  };
  return new Proxy(target, { get: (t, k) => (k in t ? t[k] : noop), set: (t, k, v) => ((t[k] = v), true) });
}

function element(tag = 'div') {
  const el = {
    tagName: tag.toUpperCase(), hidden: false, textContent: '', innerHTML: '', className: '', value: '', checked: false,
    width: 300, height: 150, clientWidth: 420, children: [],
    style: { setProperty() {} }, classList: { add() {}, remove() {}, contains: () => false },
    // toasts fill their markup through innerHTML and then reach for first/last child, so hand back a spare element
    get firstChild() { return this.children[0] || (this._fc ||= element()); }, get lastChild() { return this.children.at(-1) || (this._lc ||= element()); },
    appendChild(c) { c.parent = this; this.children.push(c); return c; },
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(x => x !== this); },
    querySelector: () => element(), querySelectorAll: () => [], addEventListener() {}, removeEventListener() {},
    dispatchEvent() {}, focus() {}, requestPointerLock() { return Promise.reject(new Error('headless')); },
    getContext: () => ctx2d(), getBoundingClientRect: () => ({ left: 0, top: 0, width: 900, height: 900 }),
  };
  return el;
}

export function installGlobals() {
  const byId = new Map();
  const doc = {
    getElementById: id => { if (!byId.has(id)) byId.set(id, element()); return byId.get(id); },
    createElement: tag => element(tag), addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
    exitPointerLock() {}, pointerLockElement: null, hidden: false, fonts: { load: () => Promise.resolve() },
  };
  const store = new Map();
  Object.assign(globalThis, {
    document: doc, window: globalThis, innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1,
    addEventListener() {}, removeEventListener() {}, dispatchEvent() {}, requestAnimationFrame: () => 0,
    localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
  });
}

// Virtual timers: callbacks fire when simulated time passes their due time.
export function makeClock() {
  let now = 0, seq = 0; const q = [];
  const add = (fn, ms, every) => { const id = ++seq; q.push({ id, fn, due: now + Math.max(0, ms || 0), every }); return id; };
  return {
    setTimeout: (fn, ms) => add(fn, ms, 0), setInterval: (fn, ms) => add(fn, ms, ms || 1),
    clear: id => { const i = q.findIndex(t => t.id === id); if (i >= 0) q.splice(i, 1); },
    advance(ms) { now += ms; for (let guard = 0; guard < 200; guard++) { q.sort((a, b) => a.due - b.due); const t = q[0]; if (!t || t.due > now) break;
      if (t.every) t.due += t.every; else q.shift(); try { t.fn(); } catch (e) { (globalThis.__SIM.errors ||= []).push(String(e && e.stack || e)); } } },
    get now() { return now; },
  };
}

export class FakeRenderer {
  constructor() { this.shadowMap = { enabled: true, type: 0, autoUpdate: true, needsUpdate: false }; this.info = { render: { calls: 0, triangles: 0 }, reset() {} }; this._pr = 1; }
  setPixelRatio(p) { this._pr = p; } getPixelRatio() { return this._pr; } setSize() {} render() {}
}

// Turn the game's inline module into a Node module that imports npm three and exposes its internals to the harness.
export function buildGameModule() {
  const html = readFileSync(GAME_HTML, 'utf8');
  let src = html.match(/<script type="module">([\s\S]*)<\/script>/)[1];
  src = src.replace(/^import \* as THREE from .*?;$/m, "import * as THREE from 'three';");
  src = src.replace('new THREE.WebGLRenderer(', 'new globalThis.__SIM.FakeRenderer(');
  const prelude = 'const setTimeout=(f,ms)=>globalThis.__SIM.clock.setTimeout(f,ms),setInterval=(f,ms)=>globalThis.__SIM.clock.setInterval(f,ms);\n';
  const api = `
globalThis.__SIM.api={THREE,P,QS,QDEF,curStage,stageTarget,objText,npcs,NPC,outlaws,animals,EMP,ROM,WANTED,RAID,WEAPONS,cam,camera,K,mouse,SITES,DEER_ZONES,pickups,fog,horses,
  CRIMES,crimeLog,SHOPS,BUSINESS,SECRETS,FOG_N,tick,begin,talkTo,buy,openShop,openCampMenu,tryMakeCamp,makeCamp,startRaid,canRaid,findInteract,fire,punch,rob,startReload,
  advanceDlg,closeMenu,groundY,mount,dismount,nearestHorse,liveGang,gangCap,rankInfo,setFocus,focusMark,focusRelease,fastTravel,mapPOIs,courtMenu,campSpotProblem,
  setOrder,commitCrime,inTown,d2,angDiff,clock,LAW,hurt,lawAlive,posseCap,wantedLevel,onNewDay,spawnLawman,dismountLaw,remountLaw,
  LATE,CH,hurtNPC,NATION,kehalaMenu,pellMenu,signTreaty,crisisCheck,resolveCrisis,defendValley,updateCrisis,BOX,BOXERS,FEST,ELEC,GRAND,GRANDS,REFORMER,startBout,boxMenu,kick,pressV,scheduleFestival,openElection,countVotes,openGrand,buildGrand,casinoMenu,playHand,electionTick,HIDEOUTS,HID,ENC,DUEL,updateHideouts,updateEncounters,updateDuels,SQ,startQuest,completeQuest,TOWNS,TW,TOWN,armyCap,startSiege,conquer,hireMercs,openWar,townBossMenu,armyNear,mercs,gangCount,updateSiege,BPURP,keepers,expBuilt,headlines,VULTURES,DEVILS,tributeTotal,BANK,STASH,openBankAccount,deposit,withdraw,buyBank,openStash,irrigate,expandTown,EXPANSIONS,plotNewDay,updatePlot,queueCatch,updateHangEvent,openWardrobe,wearOutfit,STYLE,OUTFITS_P,BREEDS,COATS,buyHorse,switchHorse,openCoats,recoatHorse,waitHours,openWait,PH,openJobs,openJob,assignJob,recallJob,setJob,jobOf,onJob,workHour,workDay,autoExpand,WORK,JOBS,HANG,GALLOWS,HAG,demandSurrender,hogtie,hangPrisoner,turnIn,pardon,scheduleHanging,peddlerMenu,haggle,canDemand,SUITORS,LAND,LAND_TYPES,landMenu,openLandOffice,landIncome,territoryControl,holdings,plotOf,CHURCH_LAWS,churchMenu,churchIncome,townPop,hasLaw,home,hb,homeMenu,homeDefense,dailyLedger,openBoard,startCoach,digGold,startRivals,homeRaid,sheriffKilled,
  growChildren,birthChild,showEmpire,drawBigMap,mapOpen,save,loadSave,LANDMARKS,boxes,showJournal,
  get HORSE(){return HORSE;},get menu(){return menu;},get dlg(){return dlg;},get gameHour(){return gameHour;},get tracked(){return tracked;},get built(){return built;},
  get running(){return running;},get focusOn(){return focusOn;},get FOCUS(){return FOCUS;}};
`;
  mkdirSync(BUILD, { recursive: true });
  const out = join(BUILD, 'game.mjs');
  writeFileSync(out, prelude + src + api);
  return pathToFileURL(out).href;
}
