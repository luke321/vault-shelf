#!/usr/bin/env node
// design/0007

import { attach } from "./cdp.mjs";
// github#50 -- the one copy of it
import { findChrome } from "./chrome.mjs";
import { currentFixture } from "./fixture-store.mjs";
import { spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf("--" + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const ONLY = (arg("act", "") || "").toLowerCase().split(",").map((v) => v.trim()).filter(Boolean);
const FPS = Number(arg("fps", "24"));
const W = Number(arg("width", "1440"));
const H = Number(arg("height", "900"));
const OUT = resolve(arg("out", join(ROOT, "demo-vault-shelf.mp4")));
const HERO = arg("hero", "");
/* github#21 -- the hero is an excerpt, named by act; design/0007. */
const HERO_ACTS = (arg("hero-acts", "hero"))
  .toLowerCase().split(",").map((v) => v.trim()).filter(Boolean);
const HERO_CLIP = arg("hero-clip", "") ? arg("hero-clip", "").split(",").map(Number) : null;
/* github#21 -- leather unless asked; a fresh library opens in it. */
const LOOK = arg("look", "leather");
/* github#21 -- the hero's budget: fps first, then width, then quality. */
const HERO_FPS = Number(arg("hero-fps", "8"));
const HERO_W = Number(arg("hero-width", "1000"));
const HERO_Q = Number(arg("hero-q", "75"));
const KEEP = argv.includes("--keep-frames");
const QUIET = argv.includes("--quiet");
/* github#23 -- shoot an act from the empty shelf. */
const EMPTY_PICKS = argv.includes("--empty-picks");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const say = (m) => { if (!QUIET) console.log(m); };

/* ------------------------------------------------------------------ tools -- */

function findFfmpeg() {
  const named = arg("ffmpeg", "");
  if (named) return named;
  const which = spawnSync(process.platform === "win32" ? "where" : "which", ["ffmpeg"],
                          { encoding: "utf8" });
  const first = (which.stdout || "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean)[0];
  if (first && existsSync(first)) return first;
  const winget = process.env.LOCALAPPDATA &&
    join(process.env.LOCALAPPDATA, "Microsoft", "WinGet", "Links", "ffmpeg.exe");
  if (winget && existsSync(winget)) return winget;
  throw new Error("ffmpeg not found. Install it with:  winget install Gyan.FFmpeg");
}

function freePort() {
  return new Promise((res, rej) => {
    const s = createServer();
    s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); });
    s.on("error", rej);
  });
}

function fixtureStore() {
  const g = spawnSync("git", ["-C", ROOT, "rev-parse", "--git-common-dir"], { encoding: "utf8" });
  const common = g.status === 0 ? g.stdout.trim() : "";
  const abs = common ? (/^[A-Za-z]:[\\/]|^\//.test(common) ? common : join(ROOT, common)) : join(ROOT, ".git");
  return join(dirname(abs), ".fixtures");
}

/* decisions/0014 -- the film is shot in the vault the checks run on; design/0013's mirror is
 * `--mirror-of <path>` now, on purpose, because a default nobody typed is the one that
 * drifts. Never read from a commit: check-pii refuses a vault path in a tracked file. */
function mirrorSource() {
  const explicit = arg("mirror-of", "");
  return explicit ? resolve(explicit) : "";
}

function sourceVault() {
  const explicit = arg("vault", "");
  if (explicit) return resolve(explicit);

  const source = mirrorSource();
  if (source) {
    if (!existsSync(source)) throw new Error("mirror source does not exist: " + source);
    const out = join(ROOT, "mirror-vault");
    say("mirroring a real vault (its shape only) -> " + out);
    const made = spawnSync(process.execPath,
      [join(ROOT, "scripts", "make-mirror-vault.mjs"), "--vault", source, "--out", out],
      { encoding: "utf8" });
    process.stdout.write(made.stdout || "");
    if (made.status !== 0) {
      // A failed mirror does NOT fall through to the fixture: the reason it failed is the
      // reason it exists, and a silent downgrade would hide it behind a film that still works.
      throw new Error("make-mirror-vault failed:\n" + (made.stderr || made.stdout));
    }
    return out;
  }

  const store = fixtureStore();
  const hit = existsSync(store) ? (basename(currentFixture(ROOT, "vault")) || undefined) : null;
  if (!hit) {
    throw new Error("no vault-* fixture in " + store +
      ' -- run `node scripts/smoke.mjs --only "no console errors"` once to generate the store');
  }
  say("shooting in the fixture the suite measures: " + hit);
  return join(store, hit);
}

/* ------------------------------------------------------------ the easings -- */

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a, b, t) => a + (b - a) * t;

/* ------------------------------------------------------- the caption layer --
 * design/0007 -- injected by the recorder, never by the page.
 */
const BAR = 128;

const CAPTION_CSS = `
html, body { background: #0b0c0d; }
#vs-app { height: calc(100% - ${BAR}px) !important; }
#vsrec {
  position: fixed; left: 0; right: 0; bottom: 0; height: ${BAR}px; z-index: 99;
  box-sizing: border-box;
  display: flex; flex-direction: column; justify-content: center;
  padding: 0 44px;
  font: 500 27px/1.25 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  letter-spacing: 0.005em;
  color: #f4f2ee;
  background: #0b0c0d;
  border-top: 1px solid #2f3338;
  opacity: 0; pointer-events: none;
}
#vsrec .t { display: block; }
#vsrec b { color: #d8b46a; font-weight: 600; }
#vsrec .sub {
  display: block; margin-top: 9px;
  font-size: 17px; font-weight: 400; color: #a5a29b; letter-spacing: 0.012em;
}
#vsrec.paper {
  color: #2a241e; background: #efe8da; border-top-color: #c3b69b;
}
#vsrec.paper b { color: #7a5c22; }
#vsrec.paper .sub { color: #5c534b; }
/* design/0020 -- A POINTER THE CAMERA CAN SEE. A screenshot has no cursor in it, and an act
 * about a right-click is nothing without one, so the recorder draws its own: an arrow moved
 * to wherever the act says the hand is, and hidden by every act that does not say. */
#vsrec-cursor {
  position: fixed; left: 0; top: 0; width: 26px; height: 26px; z-index: 100;
  pointer-events: none; opacity: 0;
  filter: drop-shadow(0 1px 2px rgba(0,0,0,0.6));
}
#vsrec-cursor.press { transform: scale(0.85); transform-origin: 4px 3px; }
/* github#21 -- the book in the hand: Chrome draws no drag image. */
#vsrec-ghost {
  position: fixed !important; z-index: 98; pointer-events: none; opacity: 0.9;
  margin: 0 !important; transform: rotate(-3deg); transition: none !important;
  filter: drop-shadow(0 16px 22px rgba(0,0,0,0.55));
}
`;

const CURSOR_SVG = '<svg viewBox="0 0 24 24" width="26" height="26" xmlns="http://www.w3.org/2000/svg">' +
  '<path d="M4 3 L4 19 L8.6 15.2 L11.4 21.4 L14.2 20.2 L11.4 14.2 L17.6 14.2 Z" ' +
  'fill="#ffffff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>';

/* ---------------------------------------------------------- the storyboard --
 * design/0007 -- every act declares how many SECONDS it lasts and is handed a normalised
 * 0..1 through that time, so the video's length is a property of this table and nothing
 * else needs to know the frame rate.
 */
function storyboard(P) {
  const { go, j, caption, scrollTo, settleOn, click, shelfTop, once, pointer, rightClick,
          pressAt, centreOf, lift, carry, drop } = P;

  /* design/0020 -- the dailies folder if there is one, else the biggest. */
  const dailiesFolder = () => j(`(function(){
    var byFolder = {};
    __vs.data().notes.forEach(function (n) { byFolder[n.folder] = (byFolder[n.folder] || 0) + 1; });
    var names = Object.keys(byFolder).sort(function (a, b) { return byFolder[b] - byFolder[a]; });
    return names.filter(function (f) { return /daily|dailies|journal/i.test(f); })[0] || names[0] || "";
  })()`);
  const favId = () => j(`(__vs.settings().shelves.filter(function (s) { return s.classifier === "pick"; })[0] || {}).id || ""`);
  /* design/0007 -- typed a letter at a time. */
  const typeInto = (id, word, t, from, to) => {
    const n = Math.max(0, Math.min(word.length, Math.floor(((t - from) / (to - from)) * word.length) + 1));
    return go(`(function(){
      var f = document.getElementById(${JSON.stringify(id)});
      if (!f) return;
      var want = ${JSON.stringify(word)}.slice(0, ${n});
      if (f.value === want) return;
      f.value = want;
      f.dispatchEvent(new Event("input", { bubbles: true }));
    })(); void 0`);
  };

  /* github#21 -- the thickest book in shot, so only the book moves. */
  const thickest = (shelfId) => j(`(function(){
    var v = __vs.views().filter(function (v) { return v.shelf.id === ${JSON.stringify(shelfId)}; })[0];
    if (!v) return null;
    var books = v.books.filter(function (b) { return b.key.charAt(0) !== "-"; });
    books.sort(function (a, b) { return b.notes.length - a.notes.length; });
    return books[0] ? books[0].id : null;
  })()`);
  /* github#21 -- a spine on its own shelf; Reading holds it too. */
  const spineOf = (bookId, shelfId) =>
    (shelfId ? `[data-shelf="${shelfId}"] ` : "#vs-shelves ") +
    `.vs-spine[data-book="${bookId.replace(/"/g, '\\"')}"]`;
  /* github#21 -- a hand's curve, not a ruler's. */
  const arc = (a, b, bow, k) => ({
    x: Math.round((1 - k) * (1 - k) * a.x + 2 * (1 - k) * k * bow.x + k * k * b.x),
    y: Math.round((1 - k) * (1 - k) * a.y + 2 * (1 - k) * k * bow.y + k * k * b.y),
  });
  const glide = async (from, to, k) => {
    if (from && to) await pointer({ x: Math.round(lerp(from.x, to.x, k)), y: Math.round(lerp(from.y, to.y, k)) });
  };

  /* design/0007 -- each feature has independent setup and timed, visible hand movements. */
  const prove = async (expression, message) => { if (!await j(expression)) throw new Error(message); };
  const change = (id, value) => go(`var f=document.getElementById(${JSON.stringify(id)}); f.value=${JSON.stringify(value)}; f.dispatchEvent(new Event('change',{bubbles:true})); void 0`);
  const point = async (target, state) => {
    const value = typeof target === 'function' ? await target(state) : target;
    return typeof value === 'string' ? centreOf(value) : value;
  };
  const neutral = { x: W - 80, y: 22 };
  const scene = (spec) => {
    const state = {}, done = new Set(), starts = new Map();
    return { name: spec.name, seconds: spec.seconds, async at(t, first) {
      const sec = t * spec.seconds;
      if (first) {
        await pointer(neutral);
        if (spec.setup) await spec.setup(state);
      }
      await caption(0.5, 0, 1, typeof spec.title === 'function' ? spec.title(sec,state) : spec.title, spec.sub || '');
      if (spec.frame) await spec.frame(sec, state);
      for (let index=0; index<(spec.steps || []).length; index++) {
        const step=spec.steps[index], start=step.start ?? Math.max(0,step.at-1.2);
        if (done.has(index) || sec < start) continue;
        const to=step.target ? await point(step.target,state) : null;
        if (step.target && !to) throw new Error(spec.name+': missing target for step '+index);
        if (to) {
          if (!starts.has(index)) starts.set(index,P.pointerPosition());
          const end=Math.max(start+0.05,step.at-0.15);
          await glide(starts.get(index),to,easeInOut(Math.min(1,(sec-start)/(end-start))));
        }
        if (sec < step.at) continue;
        if (step.action === 'right') {
          if (!await rightClick(to)) throw new Error(spec.name+': context menu did not open');
        } else if (step.action !== 'hover' && to) await pressAt(to);
        if (step.run) await step.run(state,to);
        done.add(index);
      }
      if (!P.pointerVisible()) throw new Error(spec.name+': pointer hidden');
    } };
  };
  const onShelf = (shelf='years') => async (state) => {
    state.book=await thickest(shelf); state.shelf=shelf;
    await settleOn(shelf); await pointer(neutral);
  };
  const inBook = (shelf='years') => async (state) => {
    await onShelf(shelf)(state);
    await go(`__vs.openBook(${JSON.stringify(state.book)},null); void 0`);
    state.index=await j(`__vs.reader().index`);
  };
  /* github#70, design/0035 */
  const inDigits = async (state) => {
    state.shelf='encyclopedia';
    state.book=await j(`(function(){
      var v=__vs.views().filter(function(v){return v.shelf.id==='encyclopedia';})[0];
      var b=v&&v.books.filter(function(b){return b.key==='0-9';})[0];
      return b?b.id:null;
    })()`);
    if (!state.book) throw new Error('contentsorder: this vault has no 0-9 volume');
    await settleOn('encyclopedia'); await pointer(neutral);
    await go(`__vs.openBook(${JSON.stringify(state.book)},null); void 0`);
    state.index=await j(`__vs.reader().index`);
  };
  /* github#19, design/0037 -- the one book whose note says its own tag out loud */
  const inGarden = async (state) => {
    state.shelf='tags';
    state.book=await j(`(function(){
      var v=__vs.views().filter(function(v){return v.shelf.id==='tags';})[0];
      var b=v&&v.books.filter(function(b){return b.key==='garden';})[0];
      return b?b.id:null;
    })()`);
    state.note=await j(`(function(){
      var n=__vs.data().notes.filter(function(n){
        return n.title==='A season in the same bed, start to finish';})[0];
      return n?n.id:null;
    })()`);
    if (!state.book||!state.note) throw new Error('sticky: this vault has no garden book whose note writes its own tag');
    await settleOn('tags'); await pointer(neutral);
    await go(`__vs.openBook(${JSON.stringify(state.book)},${JSON.stringify(state.note)}); void 0`);
    await prove(`__vs.stickies().flags.length===4 && !__vs.stickies().hidden`,'sticky: the fore-edge did not draw four flags');
  };
  const bookTarget = (state) => spineOf(state.book,state.shelf);
  const madeTarget = (state) => `[data-shelf="${state.fav}"] .vs-spine[data-book$="-made-my-journal"]`;
  const madeSetup = async (state) => {
    state.fav=await favId();
    const folder=await dailiesFolder();
    await go(`__vs.makeBook(${JSON.stringify(state.fav)},{name:'My Journal',source:{kind:'folder',value:${JSON.stringify(folder)}}},null); void 0`);
    await scrollTo(0);
  };
  const favouriteSetup = async (state) => {
    state.fav=await favId();
    /* github#34, github#42 -- hero may favourite "S" first; fall back a letter. */
    state.book=await j(`(function(){
      var fav=__vs.picks()[0];
      var view=__vs.views().find(function(v){return v.shelf.id==='encyclopedia';});
      var preferred=view.books.find(function(b){return b.key==='S' && fav.picks.indexOf(b.id)<0;});
      if (preferred) return preferred.id;
      var books=view.books.filter(function(b){return /^[A-Z]$/.test(b.key) && fav.picks.indexOf(b.id)<0;});
      books.sort(function(a,b){return b.notes.length-a.notes.length;});
      return books.length ? books[0].id : null;
    })()`);
    if (!state.book) throw new Error('favourite: no Encyclopedia book left to favourite');
    state.shelf='encyclopedia'; state.before=await j(`__vs.picks()[0].picks.length`);
    await scrollTo(0);
  };
  const dragFrame = (from,to) => async (sec,state) => {
    if(sec>=from && sec<to && state.dragFrom) {
      const k=easeInOut(Math.min(1,(sec-from)/(to-from-0.5)));
      await carry(arc(state.dragFrom,state.dragTo,{x:state.dragFrom.x+90,y:state.dragTo.y-45},k));
    }
  };
  const searchSetup = async (state) => {
    state.fav=await favId();
    const book=await j(`(function(){var id=__vs.picks()[0].picks.find(function(id){return id.indexOf('months/')===0;});var view=__vs.views().find(function(v){return v.shelf.id==='months';});var b=view.books.find(function(b){return b.id===id;});return {id:b.id,cover:b.cover,notes:b.notes.length};})()`);
    state.book=state.fav+'/'+book.id;state.shelf=state.fav;state.word=book.cover;state.expected=book.notes;
    await scrollTo(0);
  };
  const visibleNote = () => j(`(function(){var box=document.querySelector('#vs-reader .vs-left').getBoundingClientRect();return Array.from(document.querySelectorAll('#vs-contents button[data-note]')).find(function(e){var b=e.getBoundingClientRect();return b.top>box.top+80 && b.bottom<box.bottom;}).getAttribute('data-note');})()`);

  /* github#42, design/0008 -- their own name grades widest, at rung 4. */
  const matchweightSetup = async (state) => {
    state.shelf='people';
    state.word=await j(`(function(){
      var who={};
      __vs.data().notes.forEach(function(n){(n.people||[]).forEach(function(p){who[p]=(who[p]||0)+1;});});
      var top=Object.keys(who).sort(function(a,b){return who[b]-who[a];})[0];
      return (top||__vs.data().notes[0].title.slice(0,4)).toLowerCase();
    })()`);
    await settleOn('people'); await pointer(neutral);
  };
  /* github#42, design/0008 -- wait for the transition, like restedRungs() in smoke.mjs. */
  const matchweightRested = async () => {
    for (let wait=0; wait<20; wait++) {
      const r=await j(`(function(){
        var spines=document.querySelectorAll('[data-shelf="people"] .vs-spine[data-strength]');
        var lift={}, rested=true;
        for (var i=0;i<spines.length;i++){
          var k=spines[i].getAttribute('data-strength');
          var cs=getComputedStyle(spines[i]);
          var air=parseFloat(cs.marginLeft)||0, want=parseFloat(cs.getPropertyValue('--spine-air-match'))||0;
          if (Math.abs(air-want)>0.5) rested=false;
          lift[k]=parseFloat(cs.getPropertyValue('--spine-lift-match'))||0;
        }
        return { live:Object.keys(lift), lift:lift, rested:rested };
      })()`);
      if (r.rested && r.live.length) return r;
      await sleep(50);
    }
    throw new Error('matchweight: the ladder never settled');
  };

  return [
    {
      /* design/0007 -- the release hero follows the user's complete product gesture. */
      name: "hero",
      seconds: 76,
      async at(t, first) {
        const sec = t * 76;
        const fav = await favId();
        const made = `[data-shelf="${fav}"] .vs-spine[data-book$="-made-my-journal"]`;
        const plate = '[data-shelf="months"] .vs-plaque';
        const menu = '#vs-dye';
        const openMenu = async (selector) => {
          const p = await centreOf(selector);
          if (!p || !await rightClick(p)) throw new Error("hero: no context menu for " + selector);
          if (!await j(`document.querySelectorAll('#vs-dye .vs-bindingchoice').length === 6`)) throw new Error("hero: six binding choices were not offered");
        };
        const binding = async (nth) => {
          await pressAt(await centreOf(menu + ' .vs-bindingchoice', 0, 0, nth));
          if (!await j(`document.getElementById('vs-dye').hidden`)) throw new Error("hero: binding choice did not close menu");
          await pointer(P.pointerPosition());
        };
        const colour = async (nth) => {
          await pressAt(await centreOf(menu + ' .vs-swatch', 0, 0, nth));
          if (!await j(`document.getElementById('vs-dye').hidden`)) throw new Error("hero: colour choice did not close menu");
          await pointer(P.pointerPosition());
        };
        if (first) {
          await go(`__vs.setQuery(""); __vs.setFilters({ folders: [] }); void 0`);
          await scrollTo(0);
          await pointer({ x: W + 32, y: 82 });
          P.state.heroStart = await j(`document.getElementById('vs-library').scrollTop`);
          P.state.heroEnd = await shelfTop("years", -70);
          P.state.heroBook = await thickest("years");
          if (!P.state.heroBook) throw new Error("hero: no populated book");
          /* github#41, github#42 -- matchweight's own needle; the ladder shows too. */
          P.state.heroSearchWord = await j(`(function(){
            var who={};
            __vs.data().notes.forEach(function(n){(n.people||[]).forEach(function(p){who[p]=(who[p]||0)+1;});});
            var top=Object.keys(who).sort(function(a,b){return who[b]-who[a];})[0];
            return (top||__vs.data().notes[0].title.slice(0,4)).toLowerCase();
          })()`);
        }
        const title = sec < 6 ? "<b>Vault Shelf</b>" :
          sec < 15 ? "Search, and <b>the right book stands tallest</b>." :
          sec < 20 ? "Open a book. <b>Follow your curiosity.</b>" :
          sec < 27 ? "Find your page. <b>Leave a ribbon.</b>" : sec < 32.5 ? "A library that feels <b>yours</b>." :
          sec < 41 ? "Drag a book onto <b>Favourites</b>." :
          sec < 52 ? "Make a book for <b>what matters.</b>" : sec < 62 ? "Choose its <b>binding and colour</b>." :
          sec < 73 ? "Give a whole collection <b>its own character</b>." : "<b>Vault Shelf</b>";
        await caption(0.5, 0, 1, title, sec < 6 || sec >= 73 ? "Your notes. A library worth coming back to." : "");
        if (sec < 6.15) await prove(`document.getElementById('vs-peek').hidden`,'hero: a peek appeared during the offscreen-pointer introduction');
        /* design/0007 -- movement is sampled in every captured frame, never awaited off camera. */
        const move = async (key, start, end, until, target) => {
          if (sec < start || sec >= until) return;
          const field = 'heroMove-' + key;
          if (!P.state[field]) P.state[field] = P.pointerPosition();
          const to = await target();
          if (!to) throw new Error('hero: no pointer target for ' + key);
          await glide(P.state[field], to, easeInOut(Math.min(1, (sec - start) / (end - start))));
        };
        const noteTarget = async () => {
          if (!P.state.heroNoteSelector) {
            P.state.heroNoteSelector = await j(`(function(){var rows = Array.from(document.querySelectorAll('#vs-contents button[data-note]')); var box=document.getElementById('vs-contents').closest('.vs-page').getBoundingClientRect(); var visible=rows.filter(function(e){var r=e.getBoundingClientRect();return r.top>=box.top && r.bottom<=box.bottom;}); var row=visible[Math.min(1,visible.length-1)]; return row ? '#vs-contents button[data-note="'+row.getAttribute('data-note')+'"]' : '';})()`);
          }
          return P.state.heroNoteSelector ? centreOf(P.state.heroNoteSelector) : null;
        };
        await move('search', 6.15, 6.8, 7.02, () => centreOf('#vs-q'));
        await move('search-clear', 11, 11.8, 12.1, () => centreOf('#vs-clearquery'));
        await move('open', 14.15, 14.8, 15.02, () => centreOf(spineOf(P.state.heroBook, 'years')));
        await move('index', 17.5, 18.7, 19.02, () => centreOf('#vs-tabs button', 0, 0, 4));
        await move('note', 20.2, 21.7, 22.02, noteTarget);
        await move('ribbon', 23.4, 24.7, 25.02, () => centreOf('#vs-marks .vs-markstub'));
        await move('back', 26.5, 27.7, 28.02, () => centreOf('#vs-back'));
        await move('after-drop', 38.1, 38.9, 39.3, async () => ({ x: 600, y: P.state.heroDragTo.y }));
        await move('create', 39.5, 40.7, 41.02, () => centreOf(`[data-shelf="${fav}"] .vs-plusbook`));
        await move('name', 42, 42.8, 43.02, () => centreOf('#vs-mbname'));
        await move('source', 45.1, 45.8, 46.02, () => centreOf('#vs-mbsource'));
        await move('folder', 46.4, 47.2, 47.52, () => centreOf('#vs-mbsourceval'));
        await move('save', 48.5, 49.7, 50.02, () => centreOf('#vs-mbsave'));
        await move('book-menu', 50.4, 51.7, 52.02, () => centreOf(made));
        await move('book-binding', 52.5, 53.7, 54.02, () => centreOf(menu + ' .vs-bindingchoice', 0, 0, 4));
        await move('book-colour-menu', 56.15, 56.85, 57.02, () => centreOf(made));
        await move('book-colour', 57.15, 57.8, 58.02, () => centreOf(menu + ' .vs-swatch', 0, 0, 8));
        await move('plate', 63.3, 63.85, 64.02, () => centreOf(plate));
        await move('plate-binding', 64.25, 65.25, 65.52, () => centreOf(menu + ' .vs-bindingchoice', 0, 0, 2));
        await move('plate-colour-menu', 67.65, 68.3, 68.52, () => centreOf(plate));
        await move('plate-colour', 68.7, 69.75, 70.02, () => centreOf(menu + ' .vs-swatch', 0, 0, 3));
        if (sec >= 2 && sec < 6) await scrollTo(lerp(P.state.heroStart, P.state.heroEnd, easeInOut((sec - 2) / 4)));
        await once("hero-settle", 6 / 76, t, async () => { await settleOn("years"); });
        if (sec >= 7 && sec < 9.5) await typeInto('vs-q', P.state.heroSearchWord, sec, 7, 9.5);
        await once("hero-search-check", 10 / 76, t, async () => {
          await prove(`document.querySelectorAll('.vs-spine[data-match="1"]').length>0 && document.querySelectorAll('.vs-spine[data-match="0"]').length>0`,'hero: the search did not distinguish books');
        });
        await once("hero-search-clear", 12 / 76, t, async () => {
          await pressAt(await centreOf('#vs-clearquery'));
          if (!await j(`document.getElementById('vs-clearquery').hidden && document.querySelectorAll('.vs-spine[data-match="1"]').length===0`)) throw new Error('hero: clearing the search did not reset the shelf');
          await pointer(P.pointerPosition());
        });
        await once("hero-open", 15 / 76, t, async () => {
          const p = await centreOf(spineOf(P.state.heroBook, "years"));
          await pointer(p, true);
          if (!await click(p) || !await j(`!document.getElementById('vs-reader').hidden`)) throw new Error("hero: book did not open");
          await pointer(P.pointerPosition());
        });
        await once("hero-index", 19 / 76, t, async () => {
          const count = await j(`document.querySelectorAll('#vs-tabs button').length`);
          if (count < 2) throw new Error("hero: book has no useful index");
          await pressAt(await centreOf('#vs-tabs button', 0, 0, Math.min(4, count - 1)));
        });
        await once("hero-note", 22 / 76, t, async () => {
          const p = await noteTarget();
          if (!p) throw new Error("hero: no note visible in contents");
          await pressAt(p);
          await pointer(P.pointerPosition());
        });
        await once("hero-mark", 25 / 76, t, async () => {
          await pressAt(await centreOf('#vs-marks .vs-markstub'));
          if (!await j(`!!document.querySelector('#vs-marks .vs-mark[aria-current="true"]')`)) throw new Error("hero: ribbon was not saved");
          await pointer(P.pointerPosition());
        });
        await once("hero-back", 28 / 76, t, async () => {
          await pressAt(await centreOf('#vs-back'));
          P.state.heroBack = await j(`document.getElementById('vs-library').scrollTop`);
          await pointer(P.pointerPosition());
        });
        if (sec >= 29 && sec < 32) await scrollTo(lerp(P.state.heroBack, 0, easeInOut((sec - 29) / 3)));
        await once("hero-top", 32 / 76, t, async () => { await scrollTo(0); });
        await once("hero-drag-setup", 32.5 / 76, t, async () => {
          P.state.heroDrag = await j(`(function(){
            var fav = __vs.picks()[0];
            var view = __vs.views().filter(function(v){return v.shelf.id === 'encyclopedia';})[0];
            var book = view.books.filter(function(b){return /^[A-Z]$/.test(b.key) && fav.picks.indexOf(b.id) < 0;})
              .sort(function(a,b){return b.notes.length-a.notes.length;})[0];
            if (!book) return null;
            return { id:book.id, title:book.title, sourceBooks:view.books.length, sourceNotes:book.notes.length, picks:fav.picks.slice() };
          })()`);
          if (!P.state.heroDrag) throw new Error("hero: no new Encyclopedia book to drag");
          P.state.heroDragApproach = P.pointerPosition();
          P.state.heroDragFrom = await centreOf(spineOf(P.state.heroDrag.id, 'encyclopedia'));
          P.state.heroDragTo = await centreOf(`[data-shelf="${fav}"] .vs-plusbook`, 90, 0);
          if (!P.state.heroDragFrom || !P.state.heroDragTo) throw new Error("hero: source or Favourites landing is missing");
        });
        if (sec >= 32.5 && sec < 33.5) {
          const p = P.state.heroDragFrom;
          await glide(P.state.heroDragApproach, p, easeInOut((sec - 32.5)));
        }
        await once("hero-drag-lift", 33.5 / 76, t, async () => {
          if (!await lift(spineOf(P.state.heroDrag.id, 'encyclopedia'))) throw new Error("hero: dragstart lifted no book");
        });
        if (sec >= 33.5 && sec < 37) {
          const from = P.state.heroDragFrom, to = P.state.heroDragTo;
          await carry(arc(from, to, { x:from.x + 120, y:to.y - 55 }, easeInOut((sec - 33.5) / 3.5)));
        }
        if (sec >= 37 && sec < 38) await carry(P.state.heroDragTo);
        await once("hero-drag-drop", 38 / 76, t, async () => {
          /* github#34 -- edge-scroll can move the rail mid-carry; re-settle first. */
          const fresh = await centreOf(`[data-shelf="${fav}"] .vs-plusbook`, 90, 0);
          if (fresh && (fresh.x !== P.state.heroDragTo.x || fresh.y !== P.state.heroDragTo.y)) {
            P.state.heroDragTo = fresh;
            await carry(fresh);
          }
          const lit = await j(`document.querySelector('[data-shelf="${fav}"] .vs-shelfrail').getAttribute('data-drop')`);
          if (lit !== '1' && !await j(`!!document.querySelector('[data-shelf="${fav}"] .vs-drop')`)) throw new Error("hero: Favourites did not accept the dragged book");
          await drop(P.state.heroDragTo);
          await pointer(P.pointerPosition());
          const result = await j(`(function(){
            var view = __vs.views().filter(function(v){return v.shelf.id === 'encyclopedia';})[0];
            var book = view.books.filter(function(b){return b.id === ${JSON.stringify(P.state.heroDrag.id)};})[0];
            return { sourceBooks:view.books.length, sourceNotes:book && book.notes.length, picks:__vs.picks()[0].picks };
          })()`);
          const before = P.state.heroDrag;
          if (result.picks.length !== before.picks.length + 1 || result.picks.indexOf(before.id) < 0 ||
              before.picks.some((id) => result.picks.indexOf(id) < 0) || result.sourceBooks !== before.sourceBooks || result.sourceNotes !== before.sourceNotes) {
            throw new Error("hero: drag changed the wrong books: " + JSON.stringify({ before, result }));
          }
          say(`hero drag verified: ${before.id}; Favourites ${before.picks.length} -> ${result.picks.length}; source ${result.sourceBooks} books, ${result.sourceNotes} notes unchanged`);
        });
        await once("hero-drag-rest", 39.1 / 76, t, async () => {
          await pressAt(P.pointerPosition());
          if (!await j(`document.getElementById('vs-peek').hidden`)) throw new Error("hero: the post-drop peek did not close after clicking empty rail");
        });
        await once("hero-create", 41 / 76, t, async () => {
          await pressAt(await centreOf(`[data-shelf="${fav}"] .vs-plusbook`));
          if (!await j(`!document.getElementById('vs-madebook').hidden`)) throw new Error("hero: book builder did not open");
        });
        if (sec >= 43 && sec < 45) await typeInto('vs-mbname', 'My Journal', t, 43 / 76, 45 / 76);
        await once("hero-source", 46 / 76, t, async () => {
          await go(`var kind = document.getElementById('vs-mbsource'); kind.value='folder'; kind.dispatchEvent(new Event('change',{bubbles:true})); void 0`);
        });
        await once("hero-folder", 47.5 / 76, t, async () => {
          const folder = await dailiesFolder();
          await go(`var val=document.getElementById('vs-mbsourceval'); val.value=${JSON.stringify(folder)}; val.dispatchEvent(new Event('change',{bubbles:true})); void 0`);
        });
        await once("hero-save", 50 / 76, t, async () => {
          /* design/0029 -- the sheet can grow past the view; scroll Save into view. */
          await go(`(function(){var sheet=document.getElementById('vs-madebook');if(sheet)sheet.scrollTop=sheet.scrollHeight;})(); void 0`);
          await pressAt(await centreOf('#vs-mbsave'));
          if (!await centreOf(made)) throw new Error("hero: new favourites book was not created");
          await pointer(P.pointerPosition());
        });
        await once("hero-book-menu", 52 / 76, t, () => openMenu(made));
        await once("hero-book-preview", 54 / 76, t, async () => { await pointer(await centreOf(menu + ' .vs-bindingchoice', 0, 0, 4)); });
        await once("hero-book-binding", 56 / 76, t, () => binding(4));
        await once("hero-book-colour-menu", 57 / 76, t, () => openMenu(made));
        await once("hero-book-colour-preview", 58 / 76, t, async () => { await pointer(await centreOf(menu + ' .vs-swatch', 0, 0, 8)); });
        await once("hero-book-colour", 60 / 76, t, () => colour(8));
        await once("hero-plate-scroll", 62 / 76, t, async () => { P.state.heroPlateEnd = await shelfTop('months', -70); });
        if (sec >= 62 && sec < 63.2) await scrollTo(lerp(0, P.state.heroPlateEnd, easeInOut((sec - 62) / 1.2)));
        await once('hero-plate-settle', 63.2 / 76, t, async () => { await settleOn('months'); });
        await once("hero-plate-menu", 64 / 76, t, async () => { await settleOn('months'); await openMenu(plate); });
        await once("hero-plate-preview", 65.5 / 76, t, async () => { await pointer(await centreOf(menu + ' .vs-bindingchoice', 0, 0, 2)); });
        await once("hero-plate-binding", 67.5 / 76, t, () => binding(2));
        await once("hero-plate-colour-menu", 68.5 / 76, t, () => openMenu(plate));
        await once("hero-plate-colour-preview", 70 / 76, t, async () => { await pointer(await centreOf(menu + ' .vs-swatch', 0, 0, 3)); });
        await once("hero-plate-colour", 72 / 76, t, () => colour(3));
      },
    },
    scene({ name: "open", seconds: 5, title: '<b>Vault Shelf</b>', sub: 'Your notes. A library worth coming back to.',
      setup: async()=>{await scrollTo(0);}, steps:[] }),
    scene({ name: "favourite", seconds: 11, title: 'Keep your favourite books <b>close</b>.', sub: 'Drag a reference onto Favourites. The original stays on its shelf.',
      setup:favouriteSetup, frame:dragFrame(3,7), steps:[
        /* github#23 -- an empty rail has a landing to aim at, not a plus. */
        {at:3,target:bookTarget,action:'hover',run:async s=>{s.dragFrom=await lift(bookTarget(s));s.dragTo=await centreOf(`[data-shelf="${s.fav}"] .vs-dropzone`)||await centreOf(`[data-shelf="${s.fav}"] .vs-plusbook`,90,0);if(!s.dragFrom)throw new Error('favourite: lift failed');if(!s.dragTo)throw new Error('favourite: no landing to drop on');}},
        {at:7,action:'hover',run:async s=>{
          /* github#34 -- edge-scroll can move the rail mid-carry; re-settle first. */
          const fresh=await centreOf(`[data-shelf="${s.fav}"] .vs-dropzone`)||await centreOf(`[data-shelf="${s.fav}"] .vs-plusbook`,90,0);
          if (fresh && (fresh.x!==s.dragTo.x || fresh.y!==s.dragTo.y)) { s.dragTo=fresh; await carry(fresh); }
          await drop(s.dragTo);await prove(`__vs.picks()[0].picks.length===${s.before+1} && __vs.picks()[0].picks.includes(${JSON.stringify(s.book)})`,'favourite: drop failed');}},
        {at:9,target:{x:650,y:235},run:async()=>{await prove(`document.getElementById('vs-peek').hidden`,'favourite: peek remained');}}
      ] }),
    scene({ name: "ribbon", seconds: 18, title: 'Leave a <b>ribbon</b>. Pick up where you stopped.', sub: 'Reading gathers the books holding your marked notes.',
      setup:inBook(), steps:[
        {at:2.5,target:'#vs-marks .vs-markstub',run:async()=>{await prove(`document.querySelectorAll('#vs-marks .vs-mark').length>0`,'ribbon: first mark missing');}},
        {at:5,target:'#vs-back'},
        {at:7,target:neutral,action:'hover',run:async s=>{const b=await thickest('people');await go(`__vs.openBook(${JSON.stringify(b)},null); void 0`);s.second=b;}},
        {at:10,target:'#vs-marks .vs-markstub'},
        {at:13,target:'#vs-back',run:async()=>{await scrollTo(0);await prove(`document.querySelectorAll('[data-shelf="-reading"] .vs-spine').length>=2`,'ribbon: Reading has fewer than two books');}},
        {at:15,target:neutral}
      ] }),
    scene({ name: "parting", seconds: 25, title: sec=>sec<8?'Search, and matching books <b>stand out</b>.':sec<15?'See <b>why each note belongs</b>.':'The same search works <b>inside the book</b>.',
      sub: 'Titles, book covers, tags, people and folders share one search rule.', setup:async state=>{await searchSetup(state);const year=await j(`__vs.picks()[0].picks.find(function(id){return id.indexOf('years/')===0;})`);state.book=state.fav+'/'+year;},
      frame:async(sec,state)=>{
        if(sec>=3 && sec<5.5)await typeInto('vs-q',state.word,sec,3,5.3);
        if(sec>=16.2 && sec<18.8)await typeInto('vs-within',state.word,sec,16.2,18.6);
      },steps:[
        {at:2,target:'#vs-q'},
        {at:6.5,target:{x:800,y:180},run:async()=>{await prove(`document.querySelectorAll('.vs-spine[data-match="1"]').length>0 && document.querySelectorAll('.vs-spine[data-match="0"]').length>0`,'parting: library query did not distinguish books');}},
        {at:9,target:bookTarget,run:async state=>{await prove(`__vs.readerMatches().marked===${state.expected}`,'parting: month cover matches missing in the year book');await prove(`(function(){var left=document.querySelector('#vs-reader .vs-left'), first=document.querySelector('#vs-contents button[data-match="1"]');var a=left.getBoundingClientRect(),b=first.getBoundingClientRect();return left.scrollTop>100 && b.top>=a.top && b.bottom<=a.bottom;})()`,'parting: contents did not open at the first matching note');}},
        {at:12,target:'#vs-contents button[data-match="1"]',run:async state=>{await prove(`document.querySelector('#vs-notemeta .vs-why').textContent.includes(${JSON.stringify(state.word)})`,'parting: cover-only reason missing');}},
        {at:14.5,target:'#vs-tabs .vs-findtab'},
        {at:16,target:'#vs-within'},
        {at:20,target:neutral,action:'hover',run:async state=>{await prove(`__vs.readerMatches().rows===${state.expected} && __vs.readerMatches().marked===${state.expected} && !__vs.readerMatches().empty`,'parting: within-book search disagreed with the library');say('search agreement: '+state.word+'; '+state.expected+' library matches, marked contents and within-book rows');}},
        {at:23,target:'#vs-back'}
      ] }),
    scene({ name: "room", seconds: 5, title: 'Your notes never moved.', sub: 'Shelves are views of the same vault.', setup:async()=>{await scrollTo(0);},steps:[] }),
    scene({ name: "shelves", seconds: 14, title: 'Browse your notes <b>every way you think</b>.', sub: 'Titles, dates, people and tags share one library.',
      setup:async s=>{await scrollTo(0);s.end=await shelfTop('tags');},frame:async(sec,s)=>{if(sec>=2 && sec<12)await scrollTo(lerp(0,s.end,easeInOut((sec-2)/10)));},steps:[] }),
    scene({ name: "plaques", seconds: 10, title: 'A plaque opens <b>the whole collection</b>.', sub: 'One year, across every book under its name.', setup:async()=>{await settleOn('months');},steps:[
        {at:3,target:'[data-shelf="months"] .vs-plaque',run:async()=>{await prove(`!document.getElementById('vs-reader').hidden`,'plaques: book did not open');}},
        {at:7.5,target:'#vs-back'},{at:9,target:neutral}
      ] }),
    scene({ name: "peek", seconds: 7, title: 'A closer look, <b>before you open</b>.', sub: 'Hover to see the title, notes and source folders.', setup:onShelf(),steps:[
        {at:2.5,target:bookTarget,action:'hover',run:async()=>{await prove(`!document.getElementById('vs-peek').hidden`,'peek: hover card missing');}},
        {at:6,target:neutral,action:'hover'}
      ] }),
    scene({ name: "read", seconds: 10, title: 'Open a book. <b>Follow your curiosity.</b>', sub: 'Contents on the left. Your note on the right.', setup:onShelf(),steps:[
        {at:3,target:bookTarget,run:async()=>{await prove(`!document.getElementById('vs-reader').hidden`,'read: did not open');}},
        {at:6,target:async s=>{s.note=await visibleNote();return '#vs-contents button[data-note="'+s.note+'"]';},run:async s=>{await prove(`__vs.reader().note===${JSON.stringify(s.note)}`,'read: note did not change');}}
      ] }),
    scene({ name: "turn", seconds: 14, title: 'Turn with a click. <b>Keep scrolling to turn again.</b>', sub: 'Previous and Next sit under the book; the wheel carries you onward.', setup:inBook(),steps:[
        {at:2.5,target:'#vs-nextnote',run:async()=>{await prove(`__vs.reader().index===1`,'turn: Next did not advance');}},
        {at:5,target:'#vs-prevnote',run:async()=>{await prove(`__vs.reader().index===0`,'turn: Previous did not return');}},
        {at:7,target:'.vs-page.vs-right',action:'hover',run:async()=>{await go(`var p=document.querySelector('.vs-page.vs-right');p.scrollTop=p.scrollHeight;void 0`);}},
        {at:8.5,action:'hover',run:async()=>{await P.wheel(100);}},
        {at:8.6,action:'hover',run:async()=>{await P.wheel(100);}},
        {at:8.7,action:'hover',run:async()=>{await P.wheel(100);}},
        {at:10,action:'hover',run:async()=>{await prove(`__vs.reader().index===1`,'turn: wheel did not turn exactly once');}}
      ] }),
    scene({ name: "index", seconds: 12, title: 'Jump straight to <b>the right section</b>.', sub: 'The tabs follow the shape of the book.', setup:inBook(),steps:[
        {at:3,target:'#vs-tabs .vs-indextab:nth-of-type(5)',run:async()=>{await prove(`__vs.reader().index>0`,'index: section did not move');}},
        {at:6,target:'#vs-tabs .vs-indextab:nth-of-type(8)'},
        {at:9,target:'#vs-tabs .vs-findtab',run:async()=>{await prove(`document.activeElement.id==='vs-within'`,'index: find tab did not focus search');}}
      ] }),
    /* github#19, design/0037 */
    scene({ name: "sticky", seconds: 13, title: 'Find the tag <b>where it actually is</b>.', sub: 'Flags on the fore-edge; press one and the note comes to it.', setup:inGarden,steps:[
        {at:3.5,target:'#vs-stickies .vs-sticky[data-at="1"]',run:async s=>{s.first=await j(`__vs.stickies().scrollTop`);await prove(`__vs.stickies().here===1 && __vs.stickies().scrollTop>0`,'sticky: the first flag did not move the page');}},
        {at:7,target:'#vs-stickies .vs-sticky[data-at="2"]',run:async s=>{await prove(`__vs.stickies().here===1 && __vs.stickies().scrollTop>${s.first}`,'sticky: the second flag did not go further down the note');}},
        {at:10.5,target:'#vs-stickies .vs-sticky[data-at="0"]',run:async()=>{await prove(`__vs.stickies().here===1 && __vs.stickies().inMeta===1 && __vs.stickies().scrollTop===0`,'sticky: the declared flag did not return to the details line');}}
      ] }),
    scene({ name: "alsoin", seconds: 10, title: 'One note. <b>Every place it belongs.</b>', sub: 'Step into another book without losing the note.', setup:async s=>{await inBook()(s);await go(`document.querySelector('.vs-page.vs-right').scrollTop=99999;void 0`);s.note=await j(`__vs.reader().note`);},steps:[
        {at:3,target:'#vs-alsoin button',run:async s=>{await prove(`__vs.reader().note===${JSON.stringify(s.note)}`,'alsoin: note was lost');}},
        {at:7,target:'#vs-prevcollection',run:async s=>{await prove(`__vs.reader().book===${JSON.stringify(s.book)}`,'alsoin: previous collection did not return');}}
      ] }),
    scene({ name: "wear", seconds: 19, title: sec=>sec<6?'Books carry <b>the notes they have gathered</b>.':'Every visit <b>adds to their story</b>.', sub: 'Existing notes, new notes and real visits leave their mark.', setup:async s=>{
        await onShelf()(s);
        // github#85 -- the window slides, so ask the book its own count
        await prove(`(function(){var b=__vs.views().find(function(v){return v.shelf.id==='years';}).books.find(function(b){return b.id==='years/2015';});return document.querySelector('[data-shelf="years"] .vs-spine[data-book="years/2015"]').getAttribute('data-wear')==='3' && b.notes.length>0 && __vs.settings().wear['years/2015']===b.notes.length;})()`,'wear: the old book did not keep its note entries');
        s.book='tags/acoustics';s.shelf='tags';
        s.notes=await j(`__vs.settings().bookNotes[${JSON.stringify(s.book)}].slice()`);
        await prove(`__vs.settings().wear[${JSON.stringify(s.book)}]===1 && __vs.settings().lastOpened[${JSON.stringify(s.book)}]==='never' && __vs.views().find(function(v){return v.shelf.id==='tags';}).books.find(function(b){return b.id===${JSON.stringify(s.book)};}).notes.length===1 && !document.querySelector(${JSON.stringify(bookTarget(s))}).hasAttribute('data-wear')`,'wear: one-note book must begin with one entry and no visits');
        if(s.notes.length!==1)throw new Error('wear: one-note book has unexpected entry history');
        s.from=await j(`document.getElementById('vs-library').scrollTop`);s.to=await shelfTop('tags');
        /* github#92 -- poll for the wear write, not right after the press. */
        s.assertCount=async count=>{
          const expr=`__vs.settings().wear[${JSON.stringify(s.book)}]===${count} && JSON.stringify(__vs.settings().bookNotes[${JSON.stringify(s.book)}])===${JSON.stringify(JSON.stringify(s.notes))} && __vs.settings().lastOpened[${JSON.stringify(s.book)}]!=='never'`;
          for (let wait=0; wait<20; wait++) { if (await j(expr)) return; await sleep(50); }
          await prove(expr,'wear: visits must increment the real counter without inventing notes');
        };
      },frame:async(sec,s)=>{if(sec>=3.6 && sec<5.4)await scrollTo(lerp(s.from,s.to,easeInOut((sec-3.6)/1.8)));},steps:[
        {at:2,target:'[data-shelf="years"] .vs-spine[data-book="years/2015"]',action:'hover'},
        {at:3.5,start:2.6,target:neutral,action:'hover'},
        {at:6.6,start:5.4,target:bookTarget,action:'hover'},
        {at:7.5,start:7.35,target:bookTarget,run:async s=>{await s.assertCount(2);}},
        {at:10.5,target:'#vs-back',run:async s=>{await prove(`document.querySelector(${JSON.stringify(bookTarget(s))}).getAttribute('data-wear')==='1'`,'wear: the first real visit did not add visible wear');}},
        {at:12.5,target:bookTarget,run:async s=>{await s.assertCount(3);}},
        {at:15.5,target:'#vs-back'},
        {at:17,target:bookTarget,action:'hover',run:async s=>{await prove(`document.getElementById('vs-peek').textContent.includes('3 entries and visits')`,'wear: the peek did not show the real entry and visit total');say('wear counter verified: '+s.book+'; 1 entry -> 2 -> 3 through two real opens; note IDs unchanged');}}
      ] }),
    scene({ name: "build", seconds: 17, title: 'Make a shelf <b>around your own ideas</b>.', sub: 'Choose what belongs, then how the books are made.', setup:async()=>{await scrollTo(0);},
      frame:async(sec)=>{if(sec>=4 && sec<6)await typeInto('vs-bname','Garden notes',sec,4,5.8);if(sec>=8 && sec<10)await go(`var sheet=document.getElementById('vs-builder');sheet.scrollTop=(sheet.scrollHeight-sheet.clientHeight)*${easeInOut((sec-8)/2)};void 0`);},steps:[
        {at:2,target:'#vs-newshelf'},
        {at:3.5,target:'#vs-bname'},
        {at:7,target:'#vs-bclassifier',action:'hover',run:async()=>{await change('vs-bclassifier','tag');}},
        {at:12,target:'#vs-bsave',run:async()=>{await prove(`__vs.settings().shelves.some(function(s){return s.name==='Garden notes';})`,'build: shelf was not saved');}},
        {at:15,target:neutral}
      ] }),
    scene({ name: "makebook", seconds: 16, title: 'Make a book for <b>what matters</b>.', sub: 'A name and a source, right on Favourites.', setup:async s=>{s.fav=await favId();await scrollTo(0);},
      frame:async(sec)=>{if(sec>=6 && sec<8)await typeInto('vs-mbname','My Journal',sec,6,7.8);},steps:[
        {at:2,target:s=>centreOf(`[data-shelf="${s.fav}"] .vs-plusbook`,90,0),action:'right'},
        {at:4,target:'#vs-railmenu button'},
        {at:5.5,target:'#vs-mbname'},
        {at:9,target:'#vs-mbsource',action:'hover',run:async()=>{await change('vs-mbsource','folder');}},
        {at:11,target:'#vs-mbsourceval',action:'hover',run:async()=>{await change('vs-mbsourceval',await dailiesFolder());}},
        {at:13,target:'#vs-mbsave',run:async s=>{await prove(`!!document.querySelector(${JSON.stringify(madeTarget(s))})`,'makebook: saved book missing');}},
        {at:15,target:neutral}
      ] }),
    scene({ name: "editbook", seconds: 16, title: 'Change a book. <b>Keep its place.</b>', sub: 'Rename it or remove the view; the notes stay in the vault.', setup:madeSetup,
      frame:async(sec)=>{if(sec>=6 && sec<8)await typeInto('vs-mbname','Daily Journal',sec,6,7.8);},steps:[
        {at:2,target:madeTarget,action:'right'},{at:4,target:'#vs-dye .vs-dyepick'},
        {at:5.5,target:'#vs-mbname'},{at:9,target:'#vs-mbsave'},
        {at:11,target:madeTarget,action:'right'},
        {at:13,target:'#vs-dye .vs-dyepick:nth-last-child(1)',run:async s=>{await prove(`!document.querySelector(${JSON.stringify(madeTarget(s))})`,'editbook: delete did not remove made book');}},
        {at:15,target:neutral}
      ] }),
    scene({ name: "plusbook", seconds: 13, title: 'A quiet <b>plus</b>, wherever you arrange by hand.', sub: 'Create a book at the end of a manual shelf.', setup:async s=>{await go(`var y=__vs.settings().shelves.find(function(s){return s.id==='years';});y.direction='manual';y.order=__vs.sequence('years');__vs.setFilters({folders:[]});void 0`);await settleOn('years');s.fav='years';},
      frame:async(sec)=>{if(sec>=4 && sec<6)await typeInto('vs-mbname','My Journal',sec,4,5.8);},steps:[
        {at:2,target:'[data-shelf="years"] .vs-plusbook'}, {at:3.5,target:'#vs-mbname'},
        {at:7,target:'#vs-mbsource',action:'hover',run:async()=>{await change('vs-mbsource','folder');}},
        {at:9,target:'#vs-mbsourceval',action:'hover',run:async()=>{await change('vs-mbsourceval',await dailiesFolder());}},
        {at:11,target:'#vs-mbsave',run:async s=>{await prove(`!!document.querySelector(${JSON.stringify(madeTarget(s))})`,'plusbook: made book missing');}}
      ] }),
    scene({ name: "looks", seconds: 26, title: 'Choose a <b>binding and colour</b>.', sub: 'Preview one book, or give a whole plaque-run its own character.', setup:onShelf(),steps:[
        {at:2,target:bookTarget,action:'right'},
        {at:4,target:'#vs-dye .vs-bindingchoice[data-style="vellum"]',action:'hover'},
        {at:6,target:'#vs-dye .vs-bindingchoice[data-style="vellum"]'},
        {at:8,target:bookTarget,action:'right'},
        {at:10,target:'#vs-dye .vs-swatch:nth-child(9)',action:'hover'},
        {at:12,target:'#vs-dye .vs-swatch:nth-child(9)'},
        {at:14,target:neutral,run:async()=>{await settleOn('months');}},
        {at:16,target:'[data-shelf="months"] .vs-plaque',action:'right'},
        {at:18,target:'#vs-dye .vs-bindingchoice[data-style="gilt"]',action:'hover'},
        {at:20,target:'#vs-dye .vs-bindingchoice[data-style="gilt"]'},
        {at:21.5,start:20.3,target:'[data-shelf="months"] .vs-plaque',action:'right'},
        {at:23,target:'#vs-dye .vs-swatch:nth-child(4)'},
        {at:25,target:neutral}
      ] }),
    /* github#70, design/0035 */
    scene({ name: "contentsorder", seconds: 13, title: 'Read by <b>title, date or number</b>.', sub: 'A volume of numbers opens in Number. Contents and index change together.', setup:inDigits,steps:[
        {at:1.5,target:'#vs-tabs .vs-indextoggle',action:'hover',run:async()=>{await prove(`document.querySelector('#vs-tabs .vs-indextoggle').getAttribute('data-index-mode')==='number'`,'contentsorder: a volume of numbers did not open in Number');}},
        {at:4,target:'#vs-tabs .vs-indextoggle',run:async()=>{await prove(`document.querySelector('#vs-tabs .vs-indextoggle').getAttribute('data-index-mode')==='date'`,'contentsorder: Date not applied');}},
        {at:7,target:'#vs-tabs .vs-indextab:nth-of-type(5)'},
        {at:10,target:'#vs-tabs .vs-indextoggle',run:async()=>{await prove(`document.querySelector('#vs-tabs .vs-indextoggle').getAttribute('data-index-mode')==='number'`,'contentsorder: Number not restored');}}
      ] }),
    scene({ name: "autocomplete", seconds: 12, title: 'Find a book by <b>the name on its cover</b>.', sub: 'Suggestions use the real words already on your shelves.', setup:searchSetup,
      frame:async(sec,state)=>{if(sec>=3 && sec<5.5)await typeInto('vs-q',state.word,sec,3,5.3);},steps:[
        {at:2,target:'#vs-q'},
        {at:7,target:async state=>{const row=await j(`__vs.suggest().rows.findIndex(function(row){return row.text===${JSON.stringify(state.word)} && row.kinds.includes('book');})`);if(row<0)throw new Error('autocomplete: real cover was not suggested');return '#vs-suggest .vs-sugrow[data-row="'+row+'"]';},action:'hover'},
        {at:9,target:async state=>{const row=await j(`__vs.suggest().rows.findIndex(function(row){return row.text===${JSON.stringify(state.word)};})`);return '#vs-suggest .vs-sugrow[data-row="'+row+'"]';},run:async()=>{await prove(`document.querySelectorAll('.vs-spine[data-match="1"]').length>0 && !__vs.suggest().open`,'autocomplete: cover suggestion was not accepted');}}
      ] }),
    /* github#42, design/0008 -- how much of it answers, not merely whether */
    scene({ name: "matchweight", seconds: 14, title: sec=>sec<7?'A book draws forward by <b>how much of it answers</b>.':'Not everything that matches <b>shouts the same</b>.', sub: 'The stronger the match, the higher it lifts and the more room it takes.', setup:matchweightSetup,
      frame:async(sec,state)=>{if(sec>=2 && sec<4.5)await typeInto('vs-q',state.word,sec,2,4.5);},steps:[
        {at:1.5,target:'#vs-q'},
        {at:7,target:{x:700,y:220},run:async()=>{
          const r=await matchweightRested();
          if (r.live.length<2) throw new Error('matchweight: the People shelf did not draw a spread of rungs');
          say('match-weight ladder: rungs '+r.live.join(',')+' at lift '+r.live.map(k=>r.lift[k]).join('/')+'px');
        }},
        {at:10,target:'[data-shelf="people"] .vs-spine[data-strength="4"]',action:'hover',run:async()=>{await prove(`document.querySelector('[data-shelf="people"] .vs-spine[data-strength="4"]')!==null`,'matchweight: no rung-4 book on the People shelf for the top person');}},
        {at:12.5,target:'#vs-clearquery',run:async()=>{await prove(`document.getElementById('vs-clearquery').hidden && document.querySelectorAll('#vs-shelves .vs-spine[data-strength]').length===0`,'matchweight: clearing the query did not reset the ladder');}}
      ] }),
    scene({ name: "rearrange", seconds: 11, title: 'Put books <b>in your own order</b>.', sub: 'Drag into the gap. The book keeps its notes.', setup:async s=>{s.fav=await favId();s.before=await j(`__vs.picks()[0].picks.slice()`);s.book=s.fav+'/'+s.before[s.before.length-1];s.shelf=s.fav;await scrollTo(0);},frame:dragFrame(3,7),steps:[
        {at:3,target:bookTarget,action:'hover',run:async s=>{s.dragFrom=await lift(bookTarget(s));s.dragTo=await centreOf(`[data-shelf="${s.fav}"] .vs-spine`, -18,0);}},
        {at:7,action:'hover',run:async s=>{await drop(s.dragTo);await prove(`__vs.picks()[0].picks[0]===${JSON.stringify(s.before[s.before.length-1])}`,'rearrange: sequence did not change');}},
        {at:9,target:neutral}
      ] }),
    scene({ name: "edge", seconds: 13, title: 'Carry a book <b>beyond the visible shelf</b>.', sub: 'Hold near the edge and the library scrolls with your hand.', setup:async s=>{await onShelf('months')(s);s.book=await j(`__vs.views().find(function(v){return v.shelf.id==='months';}).books[0].id`);s.start=await j(`document.getElementById('vs-library').scrollTop`);},
      frame:async(sec,s)=>{if(sec>=3 && sec<8 && s.dragFrom){const to={x:500,y:H-BAR-5};await carry(arc(s.dragFrom,to,{x:750,y:600},easeInOut(Math.min(1,(sec-3)/2))));}},steps:[
        {at:3,target:bookTarget,action:'hover',run:async s=>{s.dragFrom=await lift(bookTarget(s));}},
        {at:8,action:'hover',run:async s=>{await prove(`document.getElementById('vs-library').scrollTop>${s.start+40}`,'edge: library did not scroll');await go(`var d=window.__vsrecDrag;if(d)d.from.dispatchEvent(new DragEvent('dragend',{bubbles:true,dataTransfer:d.dt}));var g=document.getElementById('vsrec-ghost');if(g)g.remove();window.__vsrecDrag=null;void 0`);}},
        {at:10,target:neutral}
      ] }),
    scene({ name: "manage", seconds: 19, title: 'Make room for <b>the shelves you need</b>.', sub: 'Hide a shelf, change the order, bring it back.', setup:async s=>{s.start=await j(`__vs.settings().shelves.find(function(s){return s.id==='years';}).position`);},frame:async sec=>{if(sec>=12.5 && sec<14.5)await go(`var sheet=document.getElementById('vs-manage');sheet.scrollTop=(sheet.scrollHeight-sheet.clientHeight)*${easeInOut((sec-12.5)/2)};void 0`);},steps:[
        {at:2,target:'#vs-manageopen'},
        {at:5,target:'#vs-managelist .vs-managerow:has([data-go="years"]) [data-fact="shown"]',run:async()=>{await prove(`__vs.settings().shelves.find(function(s){return s.id==='years';}).hidden`,'manage: shelf did not hide');}},
        {at:8,target:'button[aria-label="Move Years up"]',run:async s=>{await prove(`__vs.settings().shelves.find(function(s){return s.id==='years';}).position<${s.start}`,'manage: shelf order did not change');}},
        {at:11,target:'#vs-managelist .vs-managerow:has([data-go="years"]) [data-fact="shown"]'},
        {at:16,target:'#vs-mclose',run:async()=>{await prove(`!__vs.settings().shelves.find(function(s){return s.id==='years';}).hidden`,'manage: shelf was not restored');}},
        {at:18,target:neutral}
      ] }),
    scene({ name: "close", seconds: 5, title: '<b>Vault Shelf</b>', sub: 'An Obsidian library for the notes you already have.', setup:async()=>{await scrollTo(0);},steps:[] }),
  ];
}

/* ------------------------------------------------------------------- run -- */

const vault = sourceVault();
const scratch = mkdtempSync(join(tmpdir(), "vs-record-"));
const page = join(scratch, "vault-shelf.html");
const frames = join(scratch, "frames");
mkdirSync(frames, { recursive: true });

/* design/0007 -- the exporter takes the vault's NAME from its directory, and a fixture
 * directory is named by its generator digest. "demo-vault-b2957892" in the corner of a demo
 * says nothing to anybody, so the fixture is copied under a name worth showing. */
const named = join(scratch, arg("vault-name", "Everything"));
cpSync(vault, named, { recursive: true });

say("fixture: " + vault);
const build = spawnSync(process.execPath,
                        [join(ROOT, "src", "build-shelf.mjs"), "--vault", named, "--out", page],
                        { encoding: "utf8" });
if (build.status !== 0) throw new Error("build-shelf failed:\n" + (build.stderr || build.stdout));
say((build.stdout || "").trim().split("\n").pop());

const PORT = await freePort();
const profile = mkdtempSync(join(tmpdir(), "vs-record-chrome-"));
const chrome = spawn(findChrome(), [
  "--remote-debugging-port=" + PORT, "--user-data-dir=" + profile,
  "--no-first-run", "--no-default-browser-check", "--disable-extensions", "--disable-sync",
  "--disable-component-update", "--no-service-autorun", "--metrics-recording-only",
  "--no-pings", "--mute-audio", "--hide-scrollbars",
  "--disable-features=Translate,TranslateUI,CalculateNativeWinOcclusion",
  "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding",
  "--disable-background-timer-throttling", "--force-device-scale-factor=1",
  /* design/0007 -- a long capture run is not a browsing session. The first full pass died at
   * frame 948 of 1,992 with nothing but "socket closed"; these are the flags that stop a
   * headless renderer accumulating its way into that on a two-thousand-frame run. */
  "--disable-gpu", "--disable-dev-shm-usage", "--disable-software-rasterizer",
  "--js-flags=--max-old-space-size=2048",
  "--headless=new", "--window-size=" + W + "," + H,
  pathToFileURL(page).href,
], { stdio: ["ignore", "ignore", "pipe"] });

/* design/0007 -- a headless browser that dies mid-capture reports "socket closed" and nothing
 * else, which is a symptom and never a cause. Its stderr is the cause, and it is worth the
 * ring buffer to have it when the run is 2,000 frames long. */
const chromeSaid = [];
let chromeGone = null;
if (chrome.stderr) {
  chrome.stderr.setEncoding("utf8");
  chrome.stderr.on("data", (d) => {
    for (const line of String(d).split("\n")) {
      const t = line.trim();
      if (t) chromeSaid.push(t);
    }
    while (chromeSaid.length > 60) chromeSaid.shift();
  });
}
chrome.on("exit", (code, sig) => { chromeGone = "exit " + code + (sig ? " " + sig : ""); });

let cdp = null;
let shot = 0;
let heroWindow = HERO_CLIP;

try {
  for (let i = 0; i < 60 && !cdp; i++) {
    try { cdp = await attach(PORT, "vault-shelf"); } catch { await sleep(300); }
  }
  if (!cdp) throw new Error("could not attach to Chrome");

  const go = (expr) => cdp.eval(expr);
  const j = async (expr) => JSON.parse(await cdp.eval("JSON.stringify(" + expr + ")"));

  for (let i = 0; i < 100; i++) {
    if (await go("!!(window.__vs && __vs.counts().spines > 0)").catch(() => false)) break;
    await sleep(200);
  }
  await cdp.send("Emulation.setDeviceMetricsOverride",
                 { width: W, height: H, deviceScaleFactor: 1, mobile: false });

  /* design/0007 -- leather is the sole offered look. Legacy looks remain an explicit
   * diagnostic through the same hook used by the suite; there is no selector to demonstrate. */
  /* `--look modern` names the look whose selector value is the empty string, since an empty
   * flag is no flag; the page opens in leather now, so modern has to be askable for. */
  const look = LOOK === "modern" ? "" : LOOK;
  {
    const applied = await j(`(function(){
      __vs.setLook(${JSON.stringify(look)});
      return document.getElementById("vs-app").getAttribute("data-look") || "";
    })()`);
    if (applied !== look) throw new Error(`--look ${LOOK}: the page came up as "${applied}"`);
    say("look: " + LOOK);
  }

  /* github#23, design/0007 -- the demo build seeds picks; this takes them off.
   * github#71, design/0020 -- off is delete for a made book; skip it, not unpick it.
   * github#72, design/0019 -- clears every shelf __vs.picks() returns, not just the first. */
  if (EMPTY_PICKS) {
    const left = await j(`(function(){
      var shelves = __vs.picks();
      if (!shelves.length) return null;
      shelves.forEach(function (shelf) {
        var made = __vs.made(shelf.id);
        shelf.picks.forEach(function (id) {
          if (made[id]) return;
          __vs.unpick(id, shelf.id);
        });
      });
      return __vs.picks().map(function (s) { return { name: s.name, left: s.picks.length }; });
    })()`);
    if (left === null) throw new Error("--empty-picks: this library has no pick shelf");
    const stuck = left.filter((s) => s.left !== 0);
    if (stuck.length) {
      throw new Error("--empty-picks: " + stuck.map((s) => `"${s.name}" still holds ${s.left}`).join(", "));
    }
    say(`picks: cleared (${left.length} shelf${left.length === 1 ? "" : "s"})`);
  }

  await go(`(function(){
    var s = document.createElement("style");
    s.textContent = ${JSON.stringify(CAPTION_CSS)};
    document.head.appendChild(s);
    var c = document.createElement("div");
    c.id = "vsrec";
    document.body.appendChild(c);
    var k = document.createElement("div");
    k.id = "vsrec-cursor";
    k.innerHTML = ${JSON.stringify(CURSOR_SVG)};
    document.body.appendChild(k);
  })(); void 0`);

  await sleep(160);

  /* ---- the primitives the storyboard is written in ---- */

  const shelfTop = async (id, pad = -24) => j(`(function(){
    var lib = document.getElementById("vs-library");
    var el = document.querySelector('[data-shelf="${id}"]');
    if (!el) return 0;
    return Math.max(0, el.offsetTop + ${pad});
  })()`);

  const railOf = async (id) => `document.querySelector('[data-shelf="${id}"] .vs-shelfrail')`;

  const scrollTo = (px) => go(`document.getElementById("vs-library").scrollTop = ${Math.round(px)}; void 0`);
  /* github#21 -- scroll, re-measure, scroll: a shelf's height is a guess. */
  const settleOn = async (id, pad = -70) => {
    let at = 0;
    for (let i = 0; i < 4; i++) {
      const want = await shelfTop(id, pad);
      if (Math.abs(want - at) < 2) break;
      at = want;
      await scrollTo(at);
    }
    return at;
  };
  const railTo = (rail, px) => go(`(function(){ var r = ${rail}; if (r) r.scrollLeft = ${Math.round(px)}; })(); void 0`);

  const spineIn = async (id, n) => j(`(function(){
    var s = document.querySelectorAll('[data-shelf="${id}"] .vs-spine')[${n}];
    if (!s) return null;
    var b = s.getBoundingClientRect();
    return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2),
             sel: '[data-shelf="${id}"] .vs-spine:nth-of-type(${n + 1})' };
  })()`);

  const hover = async (p) => {
    if (!p) return;
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: p.x, y: p.y, buttons: 0 });
  };

  /* RETURNS WHETHER IT HIT A SPINE. `elementFromPoint` on a spine that has scrolled out of its
   * rail finds the page, or nothing, and clicks neither -- so the act films a shelf while its
   * caption talks about a reader, and the take looks fine until somebody watches it. Four acts
   * of one film went out that way. Callers assert on the answer. */
  const click = async (p) => {
    if (!p) return false;
    await hover(p);
    return j(`(function(){
      var el = document.elementFromPoint(${p.x}, ${p.y});
      while (el && !el.classList.contains("vs-spine")) el = el.parentElement;
      if (!el) return false;
      el.click();
      return true;
    })()`);
  };

  /* THE CAPTION FADES ON A CURVE OF ITS OWN, so a caption is never mid-fade while the thing
   * it describes is mid-move: it is fully up for the middle of every act. */
  const caption = async (t, inAt, outAt, text, sub) => {
    const fade = 0.09;
    let o = 1;
    if (t < inAt) o = 0;
    else if (t < inAt + fade) o = (t - inAt) / fade;
    else if (t > outAt) o = 0;
    else if (t > outAt - fade) o = (outAt - t) / fade;
    const html = '<span class="t">' + text + "</span>" +
                 (sub ? '<span class="sub">' + sub + "</span>" : "");
    await go(`(function(){
      var c = document.getElementById("vsrec");
      if (!c) return;
      if (c.dataset.html !== ${JSON.stringify(html)}) {
        c.innerHTML = ${JSON.stringify(html)};
        c.dataset.html = ${JSON.stringify(html)};
      }
      c.style.opacity = ${o.toFixed(3)};
      var app = document.getElementById("vs-app");
      c.classList.toggle("paper",
        app.getAttribute("data-theme") === "light" && (app.getAttribute("data-look") || "") === "");
    })(); void 0`);
  };

  /* design/0007 -- ONE STEP, ONCE, WHATEVER THE FRAME RATE.
   *
   * An act is handed t on every frame, so `if (t > 0.16 && t < 0.22) click()` fires on every
   * frame inside that window -- three times at 6fps, thirteen at 24. For an idempotent step
   * (set a theme, set a query) that is merely wasteful. For a TOGGLE it is a coin flip decided
   * by the frame rate: the ribbon act left the note bookmarked at one fps and un-bookmarked at
   * another, and the shelf in the film had no ribbon on it. */
  const fired = new Set();
  const once = async (key, at, t, fn) => {
    if (t < at || fired.has(key)) return;
    fired.add(key);
    await fn();
  };

  /* design/0020 -- the hand in shot: an arrow the recorder draws and moves. */
  /* github#21 -- quiet: the arrow moves, the real mouse does not. */
  let pointerPosition = { x: W - 80, y: 82 };
  let pointerVisible = false;
  const pointer = async (p, pressed, quiet) => {
    if (!p) {
      pointerVisible = false;
      /* github#21 -- hidden means gone: the mouse parks in the caption bar. */
      await hover({ x: Math.round(W / 2), y: H - 12 });
      await go(`(function(){ var k = document.getElementById("vsrec-cursor"); if (k) k.style.opacity = 0; })(); void 0`);
      return;
    }
    pointerVisible = p.x >= 0 && p.x < W && p.y >= 0 && p.y < H;
    pointerPosition = { x: p.x, y: p.y };
    if (!quiet) await hover(p);
    await go(`(function(){
      var k = document.getElementById("vsrec-cursor");
      if (!k) return;
      k.style.left = "${Math.round(p.x)}px";
      k.style.top = "${Math.round(p.y)}px";
      k.style.opacity = 1;
      k.classList.toggle("press", ${pressed ? "true" : "false"});
    })(); void 0`);
  };
  /* github#54 -- a real press, because el.click() arms no mousedown */
  const pressAt = async (p) => {
    if (!p) return;
    await pointer(p, true);
    await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: p.x, y: p.y, button: "left", clickCount: 1 });
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: p.x, y: p.y, button: "left", clickCount: 1 });
    await pointer(p, false);
  };
  const rightClick = async (p) => {
    await pointer(p, true);
    await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: p.x, y: p.y, button: "right", clickCount: 1 });
    await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: p.x, y: p.y, button: "right", clickCount: 1 });
    const up = await j(`!document.getElementById("vs-railmenu").hidden || !document.getElementById("vs-dye").hidden`);
    if (!up) {
      /* design/0007 -- a fallback when CDP raised no contextmenu. */
      await go(`(function(){
        var el = document.elementFromPoint(${p.x}, ${p.y});
        if (el) el.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: ${p.x}, clientY: ${p.y} }));
      })(); void 0`);
    }
    await pointer(p, false);
    return j(`!document.getElementById("vs-railmenu").hidden || !document.getElementById("vs-dye").hidden`);
  };
  const centreOf = async (sel, dx = 0, dy = 0, nth = 0) => j(`(function(){
    var el = document.querySelectorAll(${JSON.stringify(sel)})[${nth}];
    if (!el) return null;
    var b = el.getBoundingClientRect();
    return { x: Math.round(b.left + b.width / 2 + ${dx}), y: Math.round(b.top + b.height / 2 + ${dy}) };
  })()`);

  /* github#21 -- a drag the camera can see; the events are the page's own. */
  const lift = async (sel) => {
    const up = await liftIn(sel);
    /* github#21 -- the real mouse parks, or a scroll slides a spine under it. */
    if (up) await hover({ x: Math.round(W / 2), y: H - 12 });
    return up;
  };
  const liftIn = async (sel) => j(`(function(){
    var s = document.querySelector(${JSON.stringify(sel)});
    if (!s) return null;
    var b = s.getBoundingClientRect();
    var dt = new DataTransfer();
    s.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: dt }));
    if (s.getAttribute("data-dragging") !== "1") return null;
    s.dispatchEvent(new MouseEvent("mouseleave"));
    window.__vsrecDrag = { dt: dt, from: s };
    var g = s.cloneNode(true);
    g.id = "vsrec-ghost";
    g.removeAttribute("data-dragging"); g.removeAttribute("data-book"); g.removeAttribute("data-hand");
    g.style.width = b.width + "px"; g.style.height = b.height + "px";
    g.style.left = b.left + "px"; g.style.top = b.top + "px";
    document.getElementById("vs-app").appendChild(g);
    return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) };
  })()`);
  const carry = async (p) => {
    if (!p) return;
    await pointer(p, true, true);
    await go(`(function(){
      var g = document.getElementById("vsrec-ghost");
      if (g) { g.style.left = (${p.x} - g.offsetWidth / 2) + "px"; g.style.top = (${p.y} - g.offsetHeight / 2) + "px"; }
      var d = window.__vsrecDrag;
      var el = document.elementFromPoint(${p.x}, ${p.y});
      if (d && el) el.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true,
        dataTransfer: d.dt, clientX: ${p.x}, clientY: ${p.y} }));
    })(); void 0`);
  };
  const drop = async (p) => {
    if (!p) return;
    await go(`(function(){
      var d = window.__vsrecDrag;
      var el = document.elementFromPoint(${p.x}, ${p.y});
      if (d && el) el.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true,
        dataTransfer: d.dt, clientX: ${p.x}, clientY: ${p.y} }));
      if (d) d.from.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: d.dt }));
      var g = document.getElementById("vsrec-ghost");
      if (g) g.parentNode.removeChild(g);
      window.__vsrecDrag = null;
    })(); void 0`);
    await pointer(p, false, true);
  };

  const P = { go, j, caption, scrollTo, settleOn, railTo, hover, click, shelfTop, railOf, spineIn, once,
              pointer, pointerPosition: () => ({ ...pointerPosition }), pointerVisible: () => pointerVisible, wheel: async (dy) => { const p = pointerPosition; await cdp.send("Input.dispatchMouseEvent", { type:"mouseWheel", x:p.x, y:p.y, deltaY:dy, deltaX:0 }); }, rightClick, pressAt, centreOf, lift, carry, drop, state: {} };
  const acts = storyboard(P).filter((a) => !ONLY.length || ONLY.some((q) => argv.includes("--exact-act") ? a.name.toLowerCase() === q : a.name.toLowerCase().includes(q)));
  if (!acts.length) throw new Error("--act " + ONLY.join(",") + " matched no act");

  const total = acts.reduce((n, a) => n + Math.round(a.seconds * FPS), 0);
  say(`${acts.length} act(s), ${total} frames at ${FPS}fps = ${(total / FPS).toFixed(1)}s, ${W}x${H}`);
  if (HERO && !HERO_CLIP) {
    /* github#21 -- the window follows the acts as they fall in this take. */
    let at = 0, from = -1, to = -1;
    for (const a of acts) {
      const n = Math.round(a.seconds * FPS) / FPS;
      if (HERO_ACTS.includes(a.name.toLowerCase())) { if (from < 0) from = at; to = at + n; }
      at += n;
    }
    if (from < 0) throw new Error("--hero: none of " + HERO_ACTS.join(",") + " is in this take");
    heroWindow = [from, to - from];
    say(`hero: ${HERO_ACTS.filter((h) => acts.some((a) => a.name === h)).join(", ")} = ` +
        `${from.toFixed(1)}s to ${to.toFixed(1)}s (${(to - from).toFixed(1)}s)`);
  }

  const diagnose = (e, where) => {
    const lines = [
      `the recorder lost the browser during "${where}", after ${shot} frame(s).`,
      "  " + e.message,
    ];
    if (chromeGone) lines.push("  chrome process: " + chromeGone);
    if (chromeSaid.length) {
      lines.push("  chrome said:");
      for (const l of chromeSaid.slice(-14)) lines.push("    " + l);
    }
    return new Error(lines.join("\n"));
  };

  const t0 = Date.now();
  capture: for (const act of acts) {
    let previousPointer = null, largestPointerStep = 0, visiblePointerFrames = 0;
    const n = Math.round(act.seconds * FPS);
    for (let f = 0; f < n; f++) {
      const t = n === 1 ? 1 : f / (n - 1);
      /* github#21 -- an act's own error stops the take; design/0007. */
      try {
        await act.at(t, f === 0);
      } catch (e) {
        if (chromeGone || /socket|closed|target/i.test(e.message)) throw diagnose(e, act.name);
        throw new Error(`${act.name}: frame ${f} of ${n} (t=${t.toFixed(2)}): ${e.message}`);
      }
      {
        const introEntry = act.name === 'hero' && t * act.seconds < 6.8;
        if (!P.pointerVisible() && !introEntry) throw new Error(act.name + ": pointer hidden at frame " + f);
        if (P.pointerVisible()) visiblePointerFrames++;
        const point = P.pointerPosition();
        if (previousPointer) largestPointerStep = Math.max(largestPointerStep, Math.hypot(point.x - previousPointer.x, point.y - previousPointer.y));
        previousPointer = point;
      }
      try {
        const res = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 90 });
        writeFileSync(join(frames, "f-" + String(shot).padStart(5, "0") + ".jpg"),
                      Buffer.from(res.data, "base64"));
      } catch {
        /* ONE RETRY, and only for a frame. A capture that fails twice is a browser that is
         * gone, and continuing would silently drop frames out of the middle of the video. */
        await sleep(250);
        try {
          const res = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 90 });
          writeFileSync(join(frames, "f-" + String(shot).padStart(5, "0") + ".jpg"),
                        Buffer.from(res.data, "base64"));
        } catch (again) {
          throw diagnose(again, act.name);
        }
      }
      shot++;
      if (arg("first-frame", "")) {
        cpSync(join(frames, "f-00000.jpg"), resolve(arg("first-frame", "")));
        break capture;
      }
    }
    say(`  ${act.name.padEnd(10)} ${n} frames  (${shot} total)`);
    say(`${act.name} pointer: visible ${visiblePointerFrames}/${n} frames; largest frame step ${largestPointerStep.toFixed(1)}px at ${FPS}fps`);
    if (act.name === 'hero') say(`hero pointer: ${n-visiblePointerFrames} intentional offscreen intro/entry frames; approach begins at 6.15s, first click at 7s`);
  }
  say(`captured ${shot} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
} finally {
  try { if (cdp) cdp.close(); } catch { }
  try { chrome.kill(); } catch { }
  if (process.platform === "win32" && chrome.pid) {
    spawnSync("taskkill", ["/F", "/T", "/PID", String(chrome.pid)], { stdio: "ignore" });
  }
  await sleep(400);
  try { rmSync(profile, { recursive: true, force: true }); } catch { }
}

if (!shot) throw new Error("no frames captured");

/* ---------------------------------------------------------------- encode -- */

const ffmpeg = findFfmpeg();
const run = (args) => {
  const r = spawnSync(ffmpeg, args, { encoding: "utf8" });
  if (r.status !== 0) throw new Error("ffmpeg failed:\n" + (r.stderr || "").split("\n").slice(-12).join("\n"));
};

run(["-y", "-loglevel", "error", "-framerate", String(FPS),
     "-i", join(frames, "f-%05d.jpg"),
     "-c:v", "libx264", "-preset", "slow", "-crf", "20",
     "-pix_fmt", "yuv420p", "-movflags", "+faststart",
     "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", OUT]);
say("wrote " + OUT + " (" + (statSync(OUT).size / 1024 / 1024).toFixed(1) + " MB)");

if (HERO) {
  const hero = resolve(HERO);
  mkdirSync(dirname(hero), { recursive: true });
  run(["-y", "-loglevel", "error",
       "-ss", String(heroWindow[0]), "-t", String(heroWindow[1]), "-i", OUT,
       "-vf", `fps=${HERO_FPS},scale=${HERO_W}:-2:flags=lanczos`,
       "-c:v", "libwebp_anim", "-lossless", "0", "-q:v", String(HERO_Q), "-compression_level", "6",
       "-loop", "0", "-an", hero]);
  say("wrote " + hero + " (" + (statSync(hero).size / 1024).toFixed(0) + " KB)");
}

if (KEEP) say("--keep-frames: " + frames);
else rmSync(scratch, { recursive: true, force: true });
