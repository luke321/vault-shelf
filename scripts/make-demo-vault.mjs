#!/usr/bin/env node

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/* decisions/0004 -- a DECLARED vault, not a mirror of anyone's.
 *
 * Every shape this repo is checked against is generated from a seeded PRNG and a fixed
 * declaration, so no fixture needs a vault of yours and the same seed always writes the same
 * bytes. It is also the only way the people, tags and property coverage this plugin sorts on
 * can be guaranteed at all: a real vault has whatever it has, and a shelf classifier with no
 * data behind it is a check that silently passes.
 *
 * IT ALSO HAS TO READ LIKE SOMEBODY'S. design/0013 makes the case that a fixture is even
 * where a real vault is lopsided, and that is why the films are shot in a mirror -- but the
 * fixture is what the docs site's live demo is exported from and what every screenshot in
 * this repo is taken of, and a vault of "Greenhouse Rebuild -- log" twenty-five times over
 * demonstrates the classifier and communicates nothing. So: whole sentences from a deck,
 * titles with real first-word variety, a long-tailed people and tag distribution, and every
 * markdown construct the reader can be asked to render, somewhere in here.
 *
 * THE DATES AGE ON PURPOSE. --end defaults to today so the activity calendar's live year
 * stays exercised, which means the newest note recedes from the real clock from the moment it
 * is written. scripts/smoke.mjs regenerates a fixture older than a week. Pass --end to pin
 * one, which is what the shelf-snapshot fixture does.
 *
 * NOTHING HERE MAY CONSULT THE CALENDAR EXCEPT --end, and nothing may make a note's FOLDER
 * depend on it: scripts/check-generator-determinism.mjs generates the same seed at two end
 * dates three years apart and compares the per-folder counts.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf("--" + name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

const OUT = resolve(arg("out", join(ROOT, "demo-vault")));
const SEED = Number(arg("seed", "20260909"));
const END = arg("end", new Date().toISOString().slice(0, 10));
/* FIFTEEN YEARS, NOT TWO. Two years of notes is a Years shelf with three books on it, which
 * demonstrates nothing about the shelf that exists to make a long span readable -- and no
 * decade plaque has anything to span. A real vault that has been going a while is what the
 * product is for, so the fixture is one. */
const DAYS = Number(arg("days", "5480"));

/* ---- the PRNG ------------------------------------------------------------
 * mulberry32: one 32-bit state, no dependencies, and identical across Node versions. The
 * whole determinism story rests on nothing here consulting the clock except --end.
 */
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = rng(SEED);
const pick = (list) => list[Math.floor(rand() * list.length)];
const pickN = (list, n) => {
  const out = [];
  const pool = list.slice();
  for (let i = 0; i < n && pool.length; i++) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  return out;
};
const between = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
const shuffled = (list) => {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = out[i]; out[i] = out[j]; out[j] = t;
  }
  return out;
};

/* ---- the declaration -----------------------------------------------------
 * Invented names throughout, and deliberately not the folder scheme of any one vault: the
 * point of a fixture is that every classifier has something to sort.
 */

/* A PARA-ish tree with real nesting in it, because a vault that is ten flat folders is a
 * vault nobody has -- and the folder classifier reads the top segment, so a nested folder is
 * also the case where the tree on disk and the shelf disagree on purpose. */
const FOLDERS = [
  { path: "00 - Inbox", kind: "note", notes: 14 },
  { path: "01 - Projects", kind: "project", notes: 34 },
  { path: "01 - Projects/Website Migration", kind: "project", notes: 16, deck: "migration" },
  { path: "01 - Projects/Greenhouse Rebuild", kind: "project", notes: 12, deck: "greenhouse" },
  { path: "02 - Areas", kind: "area", notes: 26 },
  { path: "02 - Areas/Health", kind: "area", notes: 12 },
  { path: "03 - Resources", kind: "reference", notes: 28 },
  { path: "03 - Resources/Field Notes", kind: "reference", notes: 10 },
  { path: "04 - Daily Notes", kind: "daily", notes: 100 },
  { path: "05 - Meeting Notes", kind: "meeting", notes: 46 },
  { path: "05 - Meeting Notes/1-1s", kind: "oneonone", notes: 18 },
  { path: "06 - Zettelkasten", kind: "zettel", notes: 38, deck: "claims" },
  { path: "08 - Archive", kind: "note", notes: 20 },
  { path: "09 - Literature Notes", kind: "literature", notes: 24, deck: "books" },
];

/* A LONG TAIL, NOT A FLAT LINE. One person is in forty-odd notes, five are in three notes or
 * fewer, and the People shelf is the lopsided thing a real one is (design/0011). These are
 * SHARES, not counts: the notes that want a person are counted first and the shares are then
 * dealt out to exactly that many slots (largest remainder), so the tail survives whatever the
 * rates above happen to ask for instead of being whatever the PRNG left in the bag. */
const PEOPLE = [
  ["Mira Vance", 46], ["Otto Brandt", 36], ["Priya Raman", 30], ["Sanne de Vries", 24],
  ["Tomas Ek", 20], ["Ines Calder", 16], ["Yuki Harada", 13], ["Ruben Ortiz", 10],
  ["Nadia Bloom", 8], ["Kofi Mensah", 3], ["Bo Lindqvist", 3], ["Elin Sorby", 3],
  ["Celestine Marchand", 2], ["Tarek Nassar", 2], ["Wren Aldous", 2], ["Hugo Steinmann", 1],
];
const NAMES = PEOPLE.map(([who]) => who);
const firstNameOf = (who) => who.split(" ")[0];

/* THE TAG VOCABULARY, WITH ITS OWN LONG TAIL. Three levels deep, two non-Latin, three long
 * enough that a hover peek has to cope with the label, and eighteen that are on exactly one
 * note each -- which is what a Tags shelf actually looks like and what its alphabet plaques
 * are for. */
const TAGS = [
  ["project/website-migration", 78], ["garden", 72], ["area/health/sleep", 54],
  ["reading", 51], ["idea", 48], ["area/home", 42], ["garden/seeds", 36],
  ["project/greenhouse-rebuild", 34], ["area/health/running", 32], ["garden/soil", 30],
  ["reference", 28], ["attention", 27], ["method", 24], ["systems", 21], ["tooling", 18],
  ["attention/focus", 18], ["idea/half-baked", 16],
  ["project/kitchen-renovation-phase-two", 14],
  ["reference/long-form-writing-technique", 10],
  ["area/personal-knowledge-management", 9],
  ["работа", 14], ["学び", 12],
];
const RARE_TAGS = ["bindery", "letterpress", "ferries", "tides", "masonry", "joinery",
                   "foundry", "beekeeping", "cartography", "hydrology", "acoustics",
                   "glassware", "rope", "surveying", "milling", "typography", "drainage",
                   "signals"];

/* Four properties worth a shelf, so the builder's property picker has something to offer
 * beyond the one it shipped with: a lifecycle, a kind, a rank and a domain. */
const STATUS = ["Seedling", "Growing", "Evergreen", "Dormant", "Archived"];
const PRIORITY = ["high", "normal", "low"];
const AREA = ["Home", "Garden", "Work", "Health", "Making", "Reading"];
const TYPE_OF = { note: "note", project: "project", area: "area", reference: "reference",
                  daily: "daily", meeting: "meeting", oneonone: "meeting", zettel: "note",
                  literature: "literature" };
/* A note ABOUT a day always has one; everything else may not, and about a fifteenth of them
 * does not -- which is what puts something in the Undated book (decisions/0003). */
const DATED_KINDS = ["daily", "meeting", "oneonone", "person", "literature"];

/* TITLES WITH REAL FIRST-WORD VARIETY. The Encyclopedia's tabs are cut from the first WORD
 * of a title and go two and three letters deep only when the titles admit it (design/0015),
 * so a deck of "<Subject> -- <facet>" permutations gives one tab per volume and proves
 * nothing. Eighteen of these begin with M on purpose: Mar, Mea, Mee, Mem, Men, Met, Mid,
 * Mig, Mil, Min, Mix, Moi, Mor, Mos, Mov is a volume whose index has somewhere to go. */
const PHRASES = [
  "Allotment plan", "Apple tree pruning", "Archive boxes in the loft", "Autumn sowing list",
  "Awning repair",
  "Bee hive setup", "Bike maintenance schedule", "Bindery order", "Boiler service",
  "Book requests", "Boundary hedge",
  "Camper van conversion", "Cold frame repairs", "Compost turning", "Contact sheets",
  "Cutover checklist", "Cycling to the coast",
  "Daily rhythm", "Damp in the north wall", "Deep work hours", "Drainage in the lower bed",
  "Drying rack for the workshop",
  "Early starts", "Electric meter readings", "Email triage rules", "Evening walk route",
  "Extension leads",
  "Ferry timetables", "Fixing the gate latch", "Flat roof inspection", "Folding and gathering",
  "Fruit cage netting",
  "Garden shed rewire", "Gathering the quires", "Glazing quotes", "Greenhouse rebuild",
  "Groundwater readings",
  "Half-height shelving", "Hedge cutting dates", "Home server rebuild", "Hosting bill",
  "Hydrangea cuttings",
  "Ink and paper stock", "Insulation options", "Interval sessions", "Inventory of seeds",
  "Invoice folder",
  "Jam labels", "Joinery for the porch", "Journal prompts", "Junction box in the hall",
  "Keeping a commonplace book", "Kettle descaling", "Kitchen renovation", "Knot practice",
  "Ladder safety", "Language exchange", "Leaf mould", "Letterpress evening",
  "Library card renewal", "Lighting the workshop",
  "Marathon training block", "Marbled endpapers", "Margins and gutters", "Measurement notes",
  "Meeting cadence", "Memory and marginalia", "Mending the fence", "Metric for a good week",
  "Midweek reset", "Migration cutover", "Milling the offcuts", "Minutes nobody wrote",
  "Mixed borders", "Moisture meter readings", "Morning pages", "Mortgage renewal",
  "Moss on the path", "Moving the water butt",
  "Nettle feed", "New tyres", "Night shift handover", "Notes on ferries",
  "Numbering the plates",
  "Oil for the hinges", "Onion sets", "Open questions for Friday", "Orchard walk",
  "Ordering the offcuts",
  "Paint for the boards", "Paper stock", "Photo archive cleanup", "Planting plan",
  "Plumbing quote", "Potting shed shelves", "Printing the endpapers",
  "Quarterly review", "Quiet hours", "Quire and signature", "Quotes for the roof",
  "Rain gauge readings", "Reading list", "Recto and verso", "Redirect map",
  "Repointing the wall", "Rope splicing",
  "Sanding the boards", "Seed swap", "Shelf wear", "Signature folding", "Slow week",
  "Soil test results", "Spring clean", "Storage boxes",
  "Tender for the roof", "Thesis chapter three", "Tide tables", "Tool sharpening",
  "Trellis for the peas", "Turning the compost",
  "Under the stairs", "Upgrading the router", "Useful measurements",
  "Varnish trials", "Vegetable rotation", "Village hall booking", "Voltage at the shed",
  "Water butt overflow", "Weekly reset", "Wheelbarrow repair", "Winter reading",
  "Workshop lighting", "Wrapping the pipes",
  "Yarrow and comfrey", "Yield from the plot", "Zinc plates",
  "Étude in repetition", "Übung macht den Meister", "Œuvre and offcuts",
  "1000 small decisions", "3 notes on attention", "24 hours without the phone",
];

const SUFFIXES = ["— log", "— scope", "— budget", "— retro",
                  "— open questions", "— next steps", "— first pass",
                  "— second pass", "— what actually happened", "— week one",
                  "(draft)"];

const DECKS = {
  migration: ["Content inventory", "Redirect map for the old blog", "Cutover plan",
              "DNS and certificates", "Analytics parity", "Image pipeline",
              "Search indexing", "Legacy URLs worth keeping", "Rollback plan",
              "Editor training notes", "Accessibility pass", "Performance budget",
              "Launch checklist", "Post-launch snags", "Vendor questions",
              "Sitemap differences"],
  greenhouse: ["Base and footings", "Frame timber order", "Glazing quotes compared",
               "Guttering and downpipe", "Bench layout inside", "Ventilation openers",
               "Shading for July", "Water supply to the plot", "Old greenhouse dismantling",
               "Foundation levels", "Door and threshold", "Snag list after the build"],
  claims: ["A list is a promise", "Attention is a budget",
           "Backups are a habit, not a product", "Boredom is information",
           "Constraints are a kind of tool", "Copying is how a craft is learned",
           "Deadlines are a form of editing", "A draft is a question",
           "Edges are where the work is", "Every measurement changes what it measures",
           "Filing is a bet about the future", "Finishing is a separate skill",
           "Good tools are quiet", "Habits outlast intentions",
           "Ideas arrive in the wrong order", "Inventory hides problems",
           "Judgement is compressed experience", "Keeping is not the same as reading",
           "Legibility has a cost", "Maintenance is invisible until it stops",
           "Measurement beats argument", "Naming is most of designing",
           "Notes are for the person you will be", "Order is cheaper than search",
           "Practice is repetition with attention", "Questions age better than answers",
           "Repair is a form of reading", "Routine is a way of buying attention",
           "Slack is not waste", "Small tools, used often", "Starting is a skill",
           "The second attempt is shorter", "Throwing away is a skill",
           "Tidiness is a lagging indicator", "Understanding is compression",
           "Useful is not the same as interesting", "Waiting is part of the work",
           "Writing is thinking, slowly", "You cannot schedule insight"],
  books: ["A Short History of Rope — Mellis", "Bindings and Boards — Ferrier",
          "Cold Frames and Cloches — Orde", "Drainage, Explained — Kilbride",
          "Edges and Margins — Tarrant",
          "Fixing Things That Are Not Broken — Brannon",
          "Glasshouses — Sabo", "Harbour Lights — Ridout",
          "Ink, Paper, Pressure — Vestergaard",
          "Joinery Without Machines — Ostler",
          "Keeping a Weather Diary — Aleman",
          "Letters from the Foundry — Halloran", "Measuring Twice — Renwick",
          "Notes on Running Slowly — Duthie", "On Repair — Ashby",
          "Paper, and How It Fails — Tunnicliffe", "Quiet Machines — Gadby",
          "Rope, Knots and Splices — Mellis",
          "Shelves, Cases and Presses — Ferrier",
          "Tide Tables and Other Fictions — Voss",
          "Under the Floorboards — Kilbride", "Verges and Hedgerows — Orde",
          "Weather for Gardeners — Duthie", "Yards, Feet and Thumbs — Tarrant"],
};

const MEETINGS = ["Migration sync", "Standup", "Budget review", "Planning", "Retro",
                  "Handover", "Supplier call", "Village hall committee",
                  "Allotment committee", "Greenhouse quotes", "Content review",
                  "Launch readiness", "Quarterly catch-up", "Kickoff"];

/* decisions/0003 -- A NAME THAT ONLY EVER APPEARS IN PROSE.
 * Nothing in this vault ever puts it in a people property, so a People shelf that grows a book
 * for it is a People shelf that started reading prose. scripts/smoke.mjs asserts both halves:
 * that the name IS in some bodies, and that it is in nobody's people list. */
const PROSE_ONLY = "Dagny Halvorsen";

/* decisions/0003 -- A NAME THAT ONLY EVER APPEARS AS A LINK. It has a person's note of its
 * own (`type: people`) and is never in anybody's people property; every mention of it is a
 * `[[wikilink]]` in a body, half of them aliased. A People shelf that gives it a book is a
 * People shelf that reads links to person notes -- and it must be ONE book, under the note's
 * name, not one for the alias and one for the full name. */
const LINKED_ONLY = "Halvor Estrin";
let linkedMentions = 0;

/* ---- the prose -----------------------------------------------------------
 * WHOLE SENTENCES, not a bag of words. A paragraph of shuffled nouns is on screen in the
 * reader for as long as anybody looks at this vault, and it reads as broken software rather
 * than as somebody's notes. These are dull on purpose: nothing here should be more
 * interesting than the shelf behind it. (design/0013 argues the same case for the mirror;
 * this is the same technique with a different deck.)
 */
const SENTENCES = [
  "The measurements were taken twice and agreed the second time.",
  "Nothing was decided, which is itself a decision.",
  "The delivery slot moved again, so the rest of the week moved with it.",
  "It is cheaper to sharpen the tool than to force it.",
  "Half of this was obvious a week later and none of it was obvious at the time.",
  "The estimate held, which is rarer than it sounds.",
  "A short list that is actually written down beats a long one that is not.",
  "Rain all afternoon, so the outside work waited.",
  "The old fitting was the right size and the wrong thread.",
  "Two hours of this would have saved two days of the last one.",
  "The catalogue number is on the back of the invoice and not on the part.",
  "Left it overnight and the answer was the same in the morning.",
  "Everything here fits in a single afternoon if nothing else is booked.",
  "The order arrived complete, which had not happened before.",
  "Worth repeating next spring, with the frame a foot further back.",
  "The instructions assume a second pair of hands.",
  "A quiet week, and the better for it.",
  "The first attempt was square and the second one was plumb.",
  "Booked for the fourteenth; the earlier slot had gone by lunchtime.",
  "It works, and nobody has written down why.",
  "The cost is in the fittings, not in the timber.",
  "Read half of it on the train and the rest never.",
  "The joint held under load and the fixing did not.",
  "Three of these can be done at once and the fourth cannot.",
  "The label had come off, so the box was opened to find out.",
  "It is a twenty-minute job with the right bit and an afternoon without it.",
  "Checked the level again before the glue went off.",
  "The supplier answers email and does not answer the phone.",
  "Same route, ten minutes slower, and no complaints.",
  "The draft was too long, and cutting it took longer than writing it.",
  "Nothing on this list needs deciding today.",
  "The second coat is what makes it look deliberate.",
  "A note here so the same question is not asked again in March.",
  "The old one lasted eleven years, which sets the bar.",
  "Two people remember the meeting differently and neither wrote it down.",
  "Frost overnight, so the trays came in.",
  "The gauge reads high by about a tenth and always has.",
  "Better to leave the gap and fill it later than to close it wrong.",
  "The photographs are more useful than the notes were.",
  "It is finished enough to stop working on it.",
];

const HEADINGS = ["What happened", "What is left", "Open questions", "Next steps", "Costs",
                  "Measurements", "What was agreed", "Materials", "Background", "Problems",
                  "Decisions", "Timings", "Suppliers", "What to try next", "Afterwards",
                  "Method", "Results", "Kit", "Route", "Sources", "Follow-up", "Notes"];

const ITEMS = ["order the fittings", "measure the gap again", "book the collection slot",
               "email the supplier", "sharpen the chisels", "check the gauge",
               "photograph the joint before it closes", "return the wrong bracket",
               "top up the water butt", "label the boxes", "cut the second batch",
               "read the appendix", "chase the invoice", "reset the timer",
               "move the frame back a foot", "clean the filters",
               "write it down before Friday", "pick up the timber",
               "re-glue the loose leg", "compare last year's readings"];

const CODE = [
  ["sh", ["rsync -a --delete ./notes/ backup:/vault/",
          "tar -czf archive.tgz ./boxes"]],
  ["yaml", ["schedule:", "  weekly: sunday", "  keep: 8"]],
  ["text", ["frame     1840 x 2450", "glazing   4mm toughened", "fall      1 in 60"]],
];

const CALLOUTS = ["note", "tip", "warning", "info"];

/* A DECK, not a die. Drawing each sentence independently put the same one twice in a
 * paragraph often enough to see it on screen, and a page that repeats itself reads as broken
 * generation rather than as somebody's notes. */
let deck = [];
const sentence = () => {
  if (!deck.length) deck = shuffled(SENTENCES);
  return deck.pop();
};

/* Bold, italics and inline code, sparingly. Obsidian's own renderer draws them; the
 * standalone's fallback prints the markers, so a vault that emphasised every other word
 * would read as punctuation soup in the export the docs site ships (design/0010). */
const emphasise = (line) => {
  const words = line.split(" ");
  /* A WORD WORTH MARKING. Drawing the position at random put the emphasis on "and" and "the"
   * as often as on anything else, and a paragraph with `and` in inline code reads as a
   * generator rather than as a person -- the more so in the standalone export, where the
   * fallback renderer prints the markers instead of drawing them (design/0010). */
  const worth = words.map((w, i) => [w, i])
                     .filter(([w, i]) => i > 0 && i < words.length - 1 && /^[a-z]{5,}[.,;]?$/.test(w));
  if (!worth.length) return line;
  const at = worth[Math.floor(rand() * worth.length)][1];
  const word = words[at].replace(/[.,;]+$/, "");
  const tail = words[at].slice(word.length);
  const style = rand();
  words[at] = (style < 0.45 ? "**" + word + "**" : style < 0.8 ? "*" + word + "*"
                                                               : "`" + word + "`") + tail;
  return words.join(" ");
};

const para = (n) => {
  const out = [];
  /* ONE SENTENCE IN FIFTY, NOT ONE IN TEN. At a tenth, 114 of 424 notes carried bold and 62
   * carried inline code -- better than a generator that emphasised nothing, and still not
   * what a vault looks like: most notes a person writes carry no emphasis at all. A picture
   * of the shipped export settled it. The docs demo opens on the first note of the 0-9 volume
   * and that note read "the **right** bit ... the cost is in the `fittings`", because the
   * standalone's fallback renderer prints the markers rather than drawing them
   * (design/0010) -- so at a tenth the odds were good that whatever page a visitor landed on
   * showed one. The construct stays, in a dozen-odd notes rather than two hundred. */
  for (let i = 0; i < n; i++) out.push(rand() < 0.02 ? emphasise(sentence()) : sentence());
  return out.join(" ");
};

/* DISTINCT WITHIN ONE LIST. Drawing each item independently put the same one twice in a
 * three-line agenda often enough to see it in the reader -- "2. book the collection slot /
 * 3. book the collection slot" -- and nobody writes their own list that way. So: n distinct
 * items off a shuffle. The deck is per-list rather than per-vault, so the same chore turns up
 * again in the next note, which is what a recurring one does. */
const items = (n) => shuffled(ITEMS).slice(0, n);

const bullets = (n, tasks) => items(n)
  .map((one) => (tasks ? (rand() < 0.4 ? "- [x] " : "- [ ] ") : "- ") + one)
  .join("\n");

const numbered = (n) => items(n).map((one, i) => (i + 1) + ". " + one).join("\n");

const quote = () => "> " + sentence();

const callout = () => "> [!" + pick(CALLOUTS) + "]\n> " + sentence();

const fence = () => {
  const [lang, lines] = pick(CODE);
  return "```" + lang + "\n" + lines.join("\n") + "\n```";
};

const table = () => ["| what | value |", "|---|---|",
                     "| " + pick(ITEMS) + " | " + between(2, 40) + " |",
                     "| " + pick(ITEMS) + " | " + between(2, 40) + " |"].join("\n");

function dayAt(offset) {
  return new Date(Date.parse(END + "T00:00:00Z") - offset * 86400000).toISOString().slice(0, 10);
}

/* ---- the plan ------------------------------------------------------------
 * Every note's folder, title, date and frontmatter are settled BEFORE any body is written,
 * because a body links to other notes by title and a link to a title that turned out
 * different is a dead link -- which is a real thing a vault has and exactly the wrong thing
 * for a fixture whose job is to give link-following somewhere to go.
 */

/** @type {{folder:string,title:string,kind:string,day:string|null,fm:object,links:string[],halvor:boolean}[]} */
const plan = [];
const claimed = new Set();
const claim = (title) => {
  let out = title;
  let n = 2;
  while (claimed.has(out)) { out = title + " (" + n + ")"; n++; }
  claimed.add(out);
  return out;
};

/* AGED, NOT SPREAD. A uniform draw over fifteen years gives every year the same twenty-six
 * notes, which is a vault nobody has: the recent years are thick and the old ones are a
 * handful of things worth keeping. The exponent is what makes the Years shelf uneven, and
 * uneven is the thing a spine's thickness is there to show (design/0011). */
const agedOffset = () => Math.floor(Math.pow(rand(), 2.6) * DAYS);

/* SHARES DEALT TO THE SLOTS THAT ACTUALLY EXIST. The first attempt filled people and tags
 * straight out of a fixed bag as each note was planned, and it starved: the bag ran dry
 * somewhere in the daily notes and every folder after it came out with no tags and no
 * attendees at all -- a fixture whose last four folders were empty of the two things the
 * shelves are for. So the notes are planned first, their appetite is counted, and the shares
 * are cut to exactly that many slots by largest remainder. Nothing runs out, and the tail is
 * a declared shape rather than a leftover. */
function bagFor(shares, slots) {
  const total = shares.reduce((sum, [, w]) => sum + w, 0);
  const parts = shares.map(([key, w]) => {
    const exact = (w / total) * slots;
    return { key, n: Math.floor(exact), rest: exact - Math.floor(exact) };
  });
  let left = slots - parts.reduce((sum, p) => sum + p.n, 0);
  for (const p of parts.map((p, i) => ({ p, i }))
                       .sort((a, b) => b.p.rest - a.p.rest || a.i - b.i)) {
    if (left <= 0) break;
    p.p.n++; left--;
  }
  return shuffled(parts.flatMap((p) => Array.from({ length: p.n }, () => p.key)));
}

/** Up to `k` distinct entries off a shuffled bag, putting duplicates back for the next note. */
function take(bag, k, tally) {
  const out = [];
  const held = [];
  while (out.length < k && bag.length) {
    const one = bag.pop();
    if (out.indexOf(one) >= 0) held.push(one); else out.push(one);
  }
  while (held.length) bag.push(held.pop());
  if (tally) for (const one of out) tally.set(one, (tally.get(one) || 0) + 1);
  return out;
}

const decks = {};
const fromDeck = (name, pool) => {
  if (!decks[name] || !decks[name].length) decks[name] = shuffled(pool);
  return decks[name].pop();
};

const titleFor = (folder) => {
  if (folder.deck) return claim(fromDeck(folder.deck, DECKS[folder.deck]));
  const phrase = fromDeck("phrases", PHRASES);
  return claim(rand() < 0.45 ? phrase + " " + pick(SUFFIXES) : phrase);
};

/* THE PEOPLE NOTES COME FIRST so everything after them can link to one. `type: people` is
 * the declared rule that makes a link to one of these a person (decisions/0003); the tag is
 * there because a vault usually carries both and the rule has to work either way. */
for (const who of NAMES.concat([LINKED_ONLY])) {
  const day = dayAt(between(400, DAYS - 200));
  plan.push({ folder: "07 - People", title: claim(who), kind: "person", day,
              fm: { type: "people", date: day, tags: ["person"] },
              tagSlots: 0, field: null, slots: 0, links: [], halvor: false });
}

/* DAILY NOTES ARRIVE IN RUNS, not as a uniform sprinkle: three days in a row, then nothing
 * until March. That is the shape the layered index needs to have anything to say -- a month
 * book whose notes are all on separate days gets one tab per note, and a book of a run of
 * consecutive days is the case where day tabs are the only cut that separates anything
 * (design/0015). The offsets never consult --end, so the per-folder counts do not either. */
const dailyFolder = FOLDERS.filter((f) => f.kind === "daily")[0];
const dailyOffsets = new Set();
while (dailyOffsets.size < dailyFolder.notes) {
  const start = agedOffset();
  const run = between(1, 7);
  for (let k = 0; k < run && dailyOffsets.size < dailyFolder.notes; k++) {
    if (start - k < 0) break;
    dailyOffsets.add(start - k);
  }
}

for (const folder of FOLDERS) {
  const offsets = folder.kind === "daily"
    ? [...dailyOffsets].sort((a, b) => b - a)
    : Array.from({ length: folder.notes }, () => agedOffset());

  for (let i = 0; i < folder.notes; i++) {
    const day = dayAt(offsets[i]);
    const kind = folder.kind;
    /* A MISSING VALUE GETS ITS OWN BOOK, so about a twentieth of the notes that are not
     * about a day have no date at all -- and the Undated book is a book, not an exclusion
     * (decisions/0003). */
    const undated = DATED_KINDS.indexOf(kind) < 0 && rand() < 0.09;
    const tagSlots = rand() < 0.08 ? 0 : rand() < 0.13 ? 3 : rand() < 0.45 ? 2 : 1;
    /** @type {Record<string, unknown>} */
    const fm = { type: TYPE_OF[kind] };
    let title = null;
    let field = null;
    let slots = 0;

    if (kind === "daily") {
      title = claim(day);
      fm.date = day;
      field = "people";
      slots = rand() < 0.35 ? 1 : 0;
    } else if (kind === "meeting") {
      title = claim(day + " " + pick(MEETINGS));
      fm.date = day;
      /* THE SECOND OF THE THREE WAYS A PERSON IS NAMED: `attendees` on a meeting note. The
       * setting is a list of properties precisely because one vault writes this and another
       * writes `person` -- naming only one leaves half the shelf empty. */
      field = "attendees";
      slots = between(1, 3);
    } else if (kind === "oneonone") {
      /* Its TITLE names the person, so this one is claimed after the deal rather than
       * before it -- the only note whose name is not settled in this pass. */
      fm.date = day;
      /* ...AND THE THIRD: `person`, a scalar, on a one-to-one. */
      field = "person";
      slots = 1;
    } else {
      title = titleFor(folder);
      if (!undated) fm.date = day;
      if (kind !== "literature") fm.status = pick(STATUS);
      if (rand() < 0.55) fm.priority = pick(PRIORITY);
      if (rand() < 0.7) fm.area = pick(AREA);
      field = "people";
      slots = rand() < 0.32 ? 1 : 0;
    }

    plan.push({ folder: folder.path, title, kind, day: undated ? null : day, fm,
                tagSlots, field, slots, links: [], halvor: false });
  }
}

/* ---- dealing the people and the tags ------------------------------------- */

const dealt = new Map();
const peopleBag = bagFor(PEOPLE, plan.reduce((sum, n) => sum + n.slots, 0));
const tagBag = bagFor(TAGS, plan.reduce((sum, n) => sum + n.tagSlots, 0));

for (const note of plan) {
  if (note.kind === "person") continue;
  const tags = take(tagBag, note.tagSlots, null);
  if (tags.length) note.fm.tags = tags;
  const who = take(peopleBag, note.slots, dealt);
  if (!who.length) continue;
  if (note.field === "person") {
    note.fm.person = who[0];
    note.title = claim(note.day + " 1-1 with " + firstNameOf(who[0]));
  } else {
    note.fm[note.field] = who;
  }
}
/* A one-to-one the bag could not reach still needs a name. */
for (const note of plan) {
  if (note.title === null) note.title = claim(note.day + " 1-1 with " + firstNameOf(pick(NAMES)));
}

/* THE LONG TAIL OF TAGS: eighteen tags on exactly one note each. A Tags shelf whose books
 * are all the same size is a shelf whose alphabet plaques and thickness scale have nothing
 * to do -- and a vault where every tag is used ten times is a vault nobody has. */
const rareHosts = shuffled(plan.filter((n) => n.kind !== "person")).slice(0, RARE_TAGS.length);
RARE_TAGS.forEach((tag, i) => {
  const host = rareHosts[i];
  host.fm.tags = (host.fm.tags || []).concat([tag]);
});

/* ---- the links -----------------------------------------------------------
 * A note that mentions LINKED_ONLY carries NO other wikilink, because the check that follows
 * one asks for the FIRST link in the rendered note and would otherwise follow whichever
 * link the generator happened to put first.
 */
const linkable = plan.filter((n) => n.kind !== "person").map((n) => n.title);
for (const note of plan) {
  if (note.kind === "person") continue;
  if (rand() < 0.09) {
    note.halvor = true;
    linkedMentions++;
    /* HALF OF THEM ALIASED, and the flag is set HERE rather than read off the running count
     * when the body is written: the bodies are all written after this loop, so `% 2` of the
     * final total is the same answer for every note, and the first attempt put the full name
     * in all thirty-six of them. */
    note.halvorAlias = linkedMentions % 2 === 0;
    continue;
  }
  if (rand() < 0.2) {
    const targets = pickN(linkable.filter((t) => t !== note.title), between(1, 2));
    note.links = targets;
  }
}

/* ---- the bodies ---------------------------------------------------------- */

function opening(note) {
  const out = [];
  if (note.halvor) {
    /* `[[Halvor Estrin|Halvor]]` is what a vault actually contains, and the alias must not
     * earn a second book on the People shelf. */
    out.push((note.halvorAlias
      ? "Agreed the rest with [[" + LINKED_ONLY + "|Halvor]] afterwards."
      : "Agreed the rest with [[" + LINKED_ONLY + "]] afterwards.") + " " + sentence());
  }
  if (!note.halvor && rand() < 0.1) out.push(PROSE_ONLY + " mentioned the same thing in passing.");
  out.push(para(between(2, 4)));
  if (note.links.length) {
    out.push("See " + note.links.map((t) => "[[" + t + "]]").join(" and ") + ".");
  }
  return out.join(" ");
}

function bodyFor(note) {
  const out = [];
  if (note.kind === "daily") {
    out.push(opening(note));
    out.push("## " + pick(HEADINGS));
    out.push(bullets(between(2, 5), rand() < 0.4));
    if (rand() < 0.3) { out.push("## " + pick(HEADINGS)); out.push(para(between(1, 3))); }
    if (rand() < 0.12) out.push(quote());
    return out.join("\n\n");
  }
  if (note.kind === "meeting" || note.kind === "oneonone") {
    out.push(opening(note));
    out.push("## Agenda");
    out.push(numbered(between(2, 4)));
    out.push("## What was agreed");
    out.push(bullets(between(2, 4), false));
    if (rand() < 0.12) out.push(callout());
    out.push(para(between(1, 3)));
    return out.join("\n\n");
  }
  if (note.kind === "zettel") {
    out.push(opening(note));
    if (rand() < 0.45) out.push(quote());
    out.push(para(between(2, 3)));
    if (rand() < 0.1) out.push(callout());
    return out.join("\n\n");
  }
  if (note.kind === "literature") {
    out.push(opening(note));
    out.push("## Quotes");
    out.push(quote());
    out.push("## " + pick(HEADINGS));
    out.push(bullets(between(2, 4), false));
    out.push(para(between(1, 3)));
    return out.join("\n\n");
  }
  out.push(opening(note));
  const sections = between(1, 3);
  for (let i = 0; i < sections; i++) {
    out.push("## " + pick(HEADINGS));
    out.push(para(between(2, 4)));
    if (rand() < 0.35) out.push(bullets(between(2, 4), false));
    if (rand() < 0.12) out.push(numbered(between(2, 3)));
    if (rand() < 0.07) out.push(callout());
    if (rand() < 0.08) out.push(fence());
    if (rand() < 0.1) out.push(table());
  }
  return out.join("\n\n");
}

/* ---- writing it out ------------------------------------------------------ */

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const written = new Set();
let count = 0;

function write(folder, name, frontmatter, body) {
  let file = name;
  let n = 2;
  while (written.has(folder + "/" + file)) { file = name + " (" + n + ")"; n++; }
  written.add(folder + "/" + file);
  const dir = folder ? join(OUT, folder) : OUT;
  mkdirSync(dir, { recursive: true });
  const head = ["---"];
  for (const [key, value] of Object.entries(frontmatter)) {
    if (Array.isArray(value)) {
      if (!value.length) continue;
      head.push(key + ":");
      for (const v of value) head.push("  - " + v);
    } else if (value !== null && value !== undefined && value !== "") {
      head.push(key + ": " + value);
    }
  }
  head.push("---", "");
  writeFileSync(join(dir, file + ".md"), head.join("\n") + body + "\n", "utf8");
  count++;
}

for (const note of plan) {
  const body = note.kind === "person"
    ? "## " + pick(HEADINGS) + "\n\n" + para(between(2, 3)) + "\n\n" + bullets(2, false)
    : bodyFor(note);
  write(note.folder, note.title, note.fm, body);
}

/* THE TEMPLATE FOLDER, which is a real thing in a real vault and a trap for anything that
 * reads people out of a property: `[[{{VALUE}}]]` is a placeholder, not a person, and a
 * People shelf that grows a book called "{{VALUE}}" has stopped reading declarations and
 * started reading text (decisions/0003). */
write("Templates", "Daily note",
      { type: "template", date: "{{date}}", people: ["[[{{VALUE}}]]"], tags: ["template"] },
      "## " + pick(HEADINGS) + "\n\n- [ ] {{cursor}}\n\n" + para(1));
write("Templates", "Meeting note",
      { type: "template", date: "{{date}}", attendees: ["[[{{VALUE}}]]"], tags: ["template"] },
      "## Agenda\n\n1. {{cursor}}\n\n## What was agreed\n\n- \n\n" + para(1));
write("Templates", "Project note",
      { type: "template", status: "{{VALUE}}", priority: "{{VALUE}}", tags: ["template"] },
      "## Scope\n\n" + para(1) + "\n\n## Next steps\n\n- \n");

/* THE TYPO THAT IS NOT A DATE. `date: 2024-15-01` is what a real vault contains after
 * somebody types a day where a month goes, and it is not a fifteenth month: the note falls
 * through to the filename, which is a date and is right. Declared here rather than left to
 * chance, because it is the case that separates "declared, never inferred" from "parsed
 * loosely" -- and it is the one an exporter with its own regex got wrong (design/0013). */
write("00 - Inbox", "2024-01-15 A day with an impossible header",
      { type: "note", date: "2024-15-01", tags: ["reference"] },
      "The header says a fifteenth month. The filename does not.\n\n" + para(2));

/* ...and one with nothing to fall through TO, which has to be Undated rather than anything
 * clever. */
write("00 - Inbox", "Renewal paperwork with an impossible header",
      { type: "note", date: "2023-02-30", tags: ["reference"] },
      "The thirtieth of February is not a date either.\n\n" + para(2));

/* design/0010 -- A NOTE THAT IS ONE WIDE TABLE, because a real vault had one and it rendered
 * "strangely": 31 rows, a cell of 1,764 characters, 188 spans of inline code. The reader has
 * to hold it without widening the page or crushing the cell, and this is the note the check
 * opens to prove it. */
/* The long cell is a RUN OF INLINE CODE, because that is what the real one was: a part list
 * pasted out of a supplier's page, one code per part, and 188 of them in a single cell. The
 * codes read like codes rather than like shuffled nouns -- a table of `spine-1` `folio-2` is
 * the generator showing through in the one note the check is guaranteed to open. */
const PARTS = ["hinge", "bolt", "washer", "bracket", "gasket", "spacer", "grommet", "shim",
               "clip", "collar", "ferrule", "bush", "stud", "nut", "seal", "cap"];
const WHERE = ["workshop", "loft", "shed", "garage", "cellar", "porch", "plot", "back room"];
const STATE = ["ordered", "arrived", "fitted", "returned", "on back order", "to measure"];
const partCode = (i) => "`" + pick(PARTS) + "-" + String(10 + (i % 90)) + "`";
const wideCell = (n) => Array.from({ length: n }, (_, i) => partCode(i)).join(" ");
const wideRows = ["| when | part | where | who | codes as supplied | state |",
                  "|---|---|---|---|---|---|"];
for (let i = 0; i < 12; i++) {
  wideRows.push("| " + dayAt(i * 9) + " | " + pick(PARTS) + " | " + pick(WHERE) + " | " +
                pick(NAMES) + " | " + wideCell(i === 4 ? 184 : 6) + " | " + pick(STATE) + " |");
}
write("", "Wide table of everything", { type: "reference", tags: ["reference"], date: dayAt(3) },
      "# Wide table of everything\n\n" +
      "Everything that was ordered for the rebuild, in the order it was ordered. The middle " +
      "column is the supplier's own list, pasted in whole.\n\n" +
      wideRows.join("\n") + "\n");

/* A NOTE LONG ENOUGH TO SCROLL. The reading spread is a page with a fixed measure, and the
 * only way to see whether a long note scrolls the right box -- rather than the spread, the
 * room, or nothing -- is to have one. It is also the one note that carries every construct
 * at once, so a rendering regression has somewhere to show up. */
const longNote = ["# Rebinding a quarto, end to end", "",
                  "> A full pass, written down the once so it is not worked out again.", "",
                  "> [!note]", "> This is the working copy. The measurements are in the table.", ""];
for (let s = 0; s < 18; s++) {
  longNote.push("## " + (s + 1) + ". " + pick(HEADINGS), "");
  longNote.push(para(between(3, 5)), "");
  if (s % 4 === 0) { longNote.push(numbered(4), ""); }
  if (s % 3 === 1) { longNote.push(bullets(4, false), ""); }
  if (s % 5 === 2) { longNote.push(quote(), ""); }
  if (s % 7 === 3) { longNote.push(fence(), ""); }
  if (s % 6 === 4) { longNote.push(table(), ""); }
  longNote.push(para(between(2, 4)), "");
}
longNote.push("## Afterwards", "", para(3), "",
              "See [[Wide table of everything]] and [[" + linkable[0] + "]].", "");
write("03 - Resources", "Rebinding a quarto, end to end",
      { type: "reference", date: dayAt(between(30, 900)), tags: ["bindery", "reference"],
        status: "Evergreen", area: "Making" },
      longNote.join("\n"));

/* Two hubs at the root, which is where a vault keeps them -- and the one place in here where
 * a body is mostly links, so following one has somewhere to go from the first note anybody
 * opens. */
const hubLinks = (n) => shuffled(linkable).slice(0, n).map((t) => "- [[" + t + "]]").join("\n");
write("", "Home", { type: "note", tags: ["map"] },
      "# Home\n\n" + para(2) + "\n\n## Where things are\n\n" + hubLinks(8) +
      "\n\n## Reading\n\n" + hubLinks(4) + "\n");
write("", "Dashboard", { type: "note", tags: ["map"] },
      "# Dashboard\n\n" + para(1) + "\n\n## Open\n\n" + hubLinks(6) +
      "\n\n" + callout() + "\n\n## Waiting on\n\n" + hubLinks(4) + "\n");

const tail = [...dealt.entries()].filter(([, n]) => n <= 3).length;
const top = [...dealt.entries()].sort((a, b) => b[1] - a[1])[0];
console.log(`wrote ${count} notes to ${OUT} (seed ${SEED}, end ${END}, ${DAYS} days, ` +
            `${(DAYS / 365.25).toFixed(1)} years); ${top[0]} is in ${top[1]} notes and ` +
            `${tail} people are in three or fewer; ${linkedMentions} notes link to ` +
            `${LINKED_ONLY} and none names them in a property`);
