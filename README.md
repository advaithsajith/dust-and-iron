# Dust & Iron

An original open-world Western that runs in a web browser: ride a horse across a 1.6 km frontier, take story missions in the copper town of Coppervale, hunt, rob, run from the law, and build an outlaw empire with a gang, desert camps, moonshine, rackets, blackmail, a family, and finally the town itself.

The whole game is one file, [`index.html`](index.html), built on [three.js](https://threejs.org/) 0.160.

## Play

Open `index.html` through any local web server (browsers block the game's module script when opened straight from disk), for example:

```bash
python -m http.server 8790
```

Then visit http://localhost:8790. It needs a keyboard and mouse. The title screen lists the controls; press **K** in game for the empire screen and **M** for the map.

## Playtest study

[`paper/PAPER.md`](paper/PAPER.md) reports a simulated playtest of 300 sessions (200 hours of play) by scripted bot players, and what it says about engagement, friction and balance.

The harness in [`playtest/`](playtest) runs the real game code headless in Node:

```bash
cd playtest
npm install
node harness/run.mjs 300 40 data/sessions.jsonl   # 300 sessions of 40 simulated minutes
node analysis/analyze.mjs data/sessions.jsonl     # summary.json, per-session.csv and the paper's figures
```

| Path | What it is |
|---|---|
| `playtest/harness/env.mjs` | Headless environment: DOM stand-ins, a fake renderer, simulated-time timers |
| `playtest/harness/bot.mjs` | The five bot personas and how they play |
| `playtest/harness/session.mjs` | Runs one session and records its telemetry |
| `playtest/harness/run.mjs` | Runs many sessions in parallel |
| `playtest/analysis/analyze.mjs` | Metrics, the quit model, and figures |
| `playtest/data/sessions.jsonl` | Raw telemetry, one session per line |
| `playtest/analysis/summary.json` | Aggregated results the paper cites |
