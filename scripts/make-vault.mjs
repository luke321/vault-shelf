#!/usr/bin/env node

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/* decisions/0004, decisions/0014 -- THE vault: declared, generated, and the only one. It is
 * what the checks run on, what the docs site is exported from and what the film is shot in,
 * and it carries what the sparse and 10k fixtures carried (design/0013, github#17).
 *
 * THE DATES AGE ON PURPOSE: --end defaults to today, and smoke.mjs regenerates a fixture
 * older than a week.
 *
 * NOTHING HERE MAY CONSULT THE CALENDAR EXCEPT --end, and nothing may make a note's FOLDER
 * depend on it -- scripts/check-generator-determinism.mjs measures both. */

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf("--" + name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

const OUT = resolve(arg("out", join(ROOT, "vault")));
const SEED = Number(arg("seed", "20260909"));
const END = arg("end", new Date().toISOString().slice(0, 10));
/* ELEVEN YEARS, NOT TWO. Two years of notes is a Years shelf with three books on it, which
 * demonstrates nothing about the shelf that exists to make a long span readable -- and no
 * decade plaque has anything to span. A real vault that has been going a while is what the
 * product is for, so the fixture is one. */
const DAYS = Number(arg("days", "4018"));
/* decisions/0009 -- docs/demo is a smaller cut of the same declaration, scaled by a factor
 * so it is the same vault with fewer notes rather than another shape. */
const NOTES = Number(arg("notes", "5000"));
/* What the table below adds up to; the guard holds the real total near it. */
const DECLARED = 5000;
const SCALE = NOTES / DECLARED;

/* github#17 -- the year every date shelf opens on, declared rather than left to the tail of
 * the aged curve, which gave it three to six notes a month. */
const RECENT = 365;

/* decisions/0014 -- THE YEAR NOBODY WROTE, in OFFSET space rather than as a calendar year: a
 * banned year would have to be computed from --end. 760 days swallows a whole calendar year
 * wherever --end lands, and the guard proves it rather than trusting the arithmetic. */
const HOLE = { from: 2200, to: 2960 };
const inHole = (offset) => offset >= HOLE.from && offset < HOLE.to;

/* Two rest days a week, in OFFSETS -- offset and offset+7 share a weekday. */
const WEEKEND = [5, 6];
const restDay = (offset) => WEEKEND.indexOf(offset % 7) >= 0;

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
/* github#17 -- `aged` off the curve below, `recent` into the last RECENT days on top of it.
 * Daily notes are in neither column: they are a rhythm, drawn day by day. */
const FOLDERS = [
  { path: "00 - Inbox", kind: "note", aged: 130, recent: 60 },
  { path: "01 - Projects", kind: "project", aged: 300, recent: 130 },
  { path: "01 - Projects/Website Migration", kind: "project", aged: 80, recent: 55, deck: "migration" },
  { path: "01 - Projects/Greenhouse Rebuild", kind: "project", aged: 55, recent: 40, deck: "greenhouse" },
  { path: "02 - Areas", kind: "area", aged: 220, recent: 100 },
  { path: "02 - Areas/Health", kind: "area", aged: 110, recent: 65 },
  { path: "03 - Resources", kind: "reference", aged: 260, recent: 100 },
  { path: "03 - Resources/Field Notes", kind: "reference", aged: 85, recent: 45 },
  { path: "04 - Daily Notes", kind: "daily", aged: 0, recent: 0 },
  { path: "05 - Meeting Notes", kind: "meeting", aged: 380, recent: 260 },
  { path: "05 - Meeting Notes/1-1s", kind: "oneonone", aged: 130, recent: 80 },
  { path: "06 - Zettelkasten", kind: "zettel", aged: 360, recent: 160, deck: "claims" },
  { path: "08 - Archive", kind: "note", aged: 190, recent: 40 },
  { path: "09 - Literature Notes", kind: "literature", aged: 180, recent: 85, deck: "books" },
];

/* A LONG TAIL, NOT A FLAT LINE. One person is in forty-odd notes, five are in three notes or
 * fewer, and the People shelf is the lopsided thing a real one is (design/0011). These are
 * SHARES, not counts: the notes that want a person are counted first and the shares are then
 * dealt out to exactly that many slots (largest remainder), so the tail survives whatever the
 * rates above happen to ask for instead of being whatever the PRNG left in the bag. */
const PEOPLE = [
  ["Mira Vance", 46], ["Otto Brandt", 36], ["Priya Raman", 30], ["Sanne de Vries", 24],
  ["Tomas Ek", 20], ["Ines Calder", 16], ["Yuki Harada", 13], ["Ruben Ortiz", 10],
  ["Nadia Bloom", 8], ["Rafael Duarte", 7], ["Agnes Holt", 6], ["Dmitri Sokol", 5],
  ["Lucia Ferrante", 4],
];

/* github#17 -- A TAIL IS A COUNT, NOT A SHARE. Shares scaled with the vault and the person in
 * one note ended up in thirteen; these are absolute, dealt before the shares are cut. */
const TAIL_PEOPLE = [
  ["Kofi Mensah", 3], ["Bo Lindqvist", 3], ["Elin Sorby", 3], ["Marta Kubik", 3],
  ["Owen Traill", 2], ["Celestine Marchand", 2], ["Tarek Nassar", 2], ["Wren Aldous", 2],
  ["Hugo Steinmann", 1], ["Sylvie Bonnet", 1], ["Nils Aarnio", 1],
];
const TAIL_SLOTS = TAIL_PEOPLE.reduce((sum, [, n]) => sum + n, 0);
const NAMES = PEOPLE.concat(TAIL_PEOPLE).map(([who]) => who);
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
 * nothing. Forty of these begin with M on purpose: Mac, Mai, Man, Map, Mar, Mas, Mat, Mea,
 * Mee, Mem, Men, Mes, Met, Mic, Mid, Mig, Mil, Min, Mir, Mit, Mix, Moi, Mol, Mor, Mos, Mow,
 * Mul, Mun is a volume whose index has somewhere to go.
 *
 * THREE HUNDRED OF THEM, NOT A HUNDRED AND THIRTY (github#17). At 5,000 notes a deck of a
 * hundred phrases is every title six times over with "(6)" after it, which reads as a
 * generator rather than as somebody's notes -- the exact failure the deck was introduced to
 * fix, arriving again at a bigger size. A title that is still taken picks up a suffix before
 * it picks up a number; `titleFor` below does that.
 *
 * THE OPENINGS THE SPARSE FIXTURE WAS FOR ARE IN HERE TOO (decisions/0014): digits,
 * punctuation, accents and four scripts, so the Encyclopedia's 0-9 volume and its non-Latin
 * books are populated rather than hypothetical. */
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

  /* github#17 -- the rest of the deck. Same register as the block above: dull, concrete, and
   * about a house, a plot and a workshop, so nothing on screen is more interesting than the
   * shelf behind it. */
  "Aerial for the radio", "Annual seed order", "Ash tree survey", "Attic hatch insulation",
  "Back gate hinges", "Barrow repairs", "Bird box placement", "Bottling the cider",
  "Bread starter notes", "Brush cutter service",
  "Cable run to the shed", "Cellar damp readings", "Chimney sweep booking", "Cloche frames",
  "Coppice rotation", "Cover crop trial", "Culvert clearing",
  "Dahlia tubers", "Decking oil trials", "Door furniture", "Downpipe survey",
  "Dry stone repairs", "Dust extraction",
  "Earth rod test", "Eaves ventilation", "Edging the beds", "Espalier training",
  "Estate map corrections",
  "Fan heater in the greenhouse", "Feeding the beds", "Felt for the roof", "Fence post rot",
  "Filing the deeds", "Firewood stacking", "Floor levels", "Flue liner quote",
  "Footpath diversion",
  "Gable end pointing", "Gate post concrete", "Gauge calibration", "Gravel for the drive",
  "Green manure", "Grub screws", "Gutter brackets",
  "Hand tools inventory", "Hard landscaping quotes", "Header tank", "Heat loss survey",
  "Hedgehog gaps", "Hinge mortices", "Hose reel repair", "Humidity in the store",
  "Ice on the path", "Immersion timer", "Incoming main stopcock", "Index cards for the shelf",
  "Ironmongery order", "Irrigation timer",
  "Jack plane restoration", "Jigsaw blades", "Job list for the weekend", "Joist spacing",
  "Junction of the two roofs",
  "Keeping the log dry", "Kerb crossing", "Key cutting", "Kiln dried stock",
  "Knife sharpening angles",
  "Lagging the loft pipes", "Land drain survey", "Lathe belt", "Lawn scarifying",
  "Leadwork repairs", "Ledger board fixings", "Level datum", "Lime mortar mix", "Loft ladder",
  "Log store roof",
  "Machine screws", "Mains pressure test", "Manifold layout", "Mantel repairs",
  "Mapping the beds", "Mask and filters", "Mattock handle", "Meadow cutting dates",
  "Membrane under the slab", "Mesh for the fruit cage", "Meter cupboard", "Mice in the store",
  "Mild steel offcuts", "Mirror for the hall", "Mitre saw fence", "Mole drains",
  "Mortise gauge", "Mowing rota", "Mulch depths", "Muntins and glazing bars",
  "Nail gun service", "Native hedging order", "Newel post", "Noggins in the stud wall",
  "Notes from the survey", "Nozzle sizes",
  "Oak sill replacement", "Offcut rack", "Oil tank bund", "Opening lights",
  "Orchard pruning order", "Outfall inspection", "Oven thermostat",
  "Pallet racking", "Pea sticks", "Pergola posts", "Pipe lagging sizes",
  "Planning the rotation", "Plaster mix", "Pond liner", "Porch light", "Post hole digger",
  "Pressure washer service", "Propagator settings", "Pruning saw",
  "Quadrant beading", "Quarry tiles", "Quenching trials", "Quick release fittings",
  "Quoin repairs",
  "Rafter tails", "Rainwater harvesting", "Raised bed timber", "Rake handles",
  "Ratchet straps", "Reed bed", "Render patch", "Ridge tiles", "Rising damp readings",
  "Roller blinds", "Roof light flashing", "Rotavator hire", "Router table fence",
  "Runner bean frame",
  "Sash cord replacement", "Scaffold hire", "Screed depth", "Seed potato order",
  "Septic tank service", "Setting out the plot", "Shed felt", "Sink waste trap",
  "Skirting profile", "Slab levels", "Sliding door track", "Soakaway design",
  "Soffit repairs", "Soil pH map", "Spirit level check", "Stair nosing", "Stock fencing",
  "Storm damage list", "Strimmer line", "Stud detector", "Sump pump",
  "Tank lagging", "Tap washers", "Tarpaulin sizes", "Tenon saw restoration",
  "Thermostat schedule", "Threshold detail", "Tile battens", "Timber treatment",
  "Toolbox reorganisation", "Trap door to the loft", "Tree survey", "Trench depths",
  "Trickle vents", "Trolley wheels", "Tumble dryer vent",
  "Undercoat trials", "Underfloor void", "Uplighters in the porch", "Utility room layout",
  "UV in the polytunnel",
  "Valley gutter", "Vapour barrier", "Vent covers", "Verge trimming", "Vice jaws",
  "Vine eyes",
  "Wall plate fixings", "Washer sizes", "Waste pipe falls", "Water table readings",
  "Weatherboard repairs", "Weed membrane", "Wheel bearings", "Window catch",
  "Wire brush wheels", "Wood store sizing", "Workbench vice",
  "Yard drainage", "Yew hedge cutting", "Yoke for the buckets",
  "Zinc flashing", "Zip ties and clips",

  /* decisions/0014 -- THE OPENINGS THE SPARSE FIXTURE WAS FOR. A title that starts with a
   * digit, a dash, a bracket, a quote or a script the Encyclopedia has no volume for is what
   * a real vault contains and what the 0-9 and non-Latin books are made of. */
  "0 to 1", "7 day sourdough", "12 weeks of running", "42 and after",
  "99 problems with the drains",
  "\u2014 a dash to open with", "(parenthetical)", "\u201cquoted opening\u201d",
  "\u00c5ngstr\u00f6m and the small",
  "\u0440\u0430\u0431\u043e\u0442\u0430 \u043d\u0430\u0434 \u043e\u0448\u0438\u0431\u043a\u0430\u043c\u0438",
  "\u0443\u0447\u0451\u0442 \u0438 \u043a\u043e\u043d\u0442\u0440\u043e\u043b\u044c",
  "\u5b66\u3073\u306e\u30ce\u30fc\u30c8", "\u8aad\u66f8\u30e1\u30e2",
  "\u05de\u05e1\u05de\u05da \u05d0\u05d7\u05d3",
];

/* github#17 -- A PHRASE THAT IS ALREADY TAKEN PICKS UP ONE OF THESE BEFORE IT PICKS UP A
 * NUMBER. Twenty-six of them against three hundred phrases is enough distinct titles for
 * 5,000 notes, and "Gutter brackets — second pass" is a note somebody would write where
 * "Gutter brackets (4)" is a generator admitting it ran out. */
const SUFFIXES = ["— log", "— scope", "— budget", "— retro",
                  "— open questions", "— next steps", "— first pass",
                  "— second pass", "— what actually happened", "— week one",
                  "— week two", "— revisited", "— costs", "— measurements",
                  "— quotes", "— snags", "— before", "— after", "— winter",
                  "— summer", "— the short version", "— round two",
                  "— what to do differently", "— parts list", "— sign-off",
                  "(draft)"];

// github#36
// github#36
const DOING = [
  "Replacing", "Sanding", "Lagging", "Repointing", "Bleeding", "Priming", "Levelling",
  "Clearing", "Sealing", "Fitting", "Rehanging", "Regrouting", "Draining", "Insulating",
  "Mounting", "Rewiring", "Painting", "Patching", "Trimming", "Staking", "Mulching",
  "Pruning", "Splicing", "Sharpening", "Oiling", "Greasing", "Testing", "Measuring",
  "Marking out", "Boxing in", "Making good", "Stripping", "Varnishing", "Waxing",
  "Planting", "Dividing", "Potting on", "Hardening off", "Netting", "Shimming",
  "Torquing", "Bedding in",
  "Ordering", "Pricing", "Costing", "Sourcing", "Collecting", "Returning", "Swapping",
  "Borrowing", "Hiring", "Retrieving", "Sorting", "Labelling", "Stowing", "Storing",
  "Counting", "Checking", "Adjusting", "Aligning", "Balancing", "Calibrating", "Bundling",
  "Cleaning", "Degreasing", "Descaling", "Dismantling", "Reassembling", "Refitting",
  "Rehousing", "Relocating", "Securing", "Supporting", "Bracing", "Packing", "Wrapping",
  "Taping", "Gluing", "Screwing", "Bolting", "Riveting", "Welding", "Soldering",
  "Drilling", "Reaming", "Tapping", "Filing", "Grinding", "Polishing", "Buffing",
  "Scrubbing", "Rinsing", "Drying", "Airing", "Venting", "Weatherproofing", "Winterising",
];

const THINGS = [
  "gutter brackets", "sash cords", "seed potatoes", "pond liner", "stair nosing",
  "skirting boards", "door furniture", "window catches", "hinge pins", "tap washers",
  "waste traps", "floor joists", "roof battens", "ridge tiles", "lead flashing",
  "downpipes", "soakaway pipe", "land drains", "fence posts", "gate latches",
  "trellis panels", "raised beds", "cold frames", "cloches", "propagator trays",
  "grow bags", "leaf mould", "compost bins", "water butts", "hose fittings",
  "irrigation line", "bird netting", "fruit cages", "espalier wires", "vine eyes",
  "tree ties", "stakes and guards", "mulch mats", "path edging", "gravel boards",
  "decking screws", "coach bolts", "wall plugs", "masonry nails", "panel pins",
  "wood glue", "filler and caulk", "sandpaper grades", "wire wool", "paint brushes",
  "roller sleeves", "dust sheets", "masking tape", "white spirit", "linseed oil",
  "beeswax polish", "danish oil", "shellac flakes", "chisel handles", "plane irons",
  "saw teeth", "drill bits", "hole saws", "router cutters", "sanding discs",
  "clamp heads", "vice jaws", "bench dogs", "marking gauges", "try squares",
  "spirit levels", "chalk lines", "plumb bobs", "tape measures", "folding rules",
  "work gloves", "ear defenders", "dust masks", "safety glasses", "knee pads",
  "extension leads", "junction boxes", "cable clips", "consumer unit", "earth bonding",
  "immersion timer", "thermostat wiring", "radiator valves", "pipe insulation",
  "stopcock and gate", "header tank", "expansion vessel", "pump bearings",
  "flue liner", "chimney cowl", "air bricks", "trickle vents", "loft hatch",
  "insulation rolls", "vapour barrier", "membrane laps", "screed depth", "damp course",
  "lime mortar", "pointing mix", "render coats", "quarry tiles", "grout lines",
  "silicone beads", "threshold strips", "draught seals", "letterbox brushes",
  "apple cages", "asparagus crowns", "awning ropes", "barrow tyres", "bean poles",
  "bee smoker", "bird feeders", "blanket boxes", "bolt croppers", "boot scrapers",
  "bramble hooks", "brick ties", "broom heads", "bulb planters", "cable ties",
  "cane toppers", "cellar steps", "chain links", "chicken wire", "chimney pots",
  "coir matting", "cold chisels", "comfrey tea", "copper pipe", "cordless batteries",
  "corner beads", "cotton cord", "curtain poles", "cutting boards", "dibber set",
  "door sweeps", "drain rods", "dust extraction", "earth spikes", "edging irons",
  "fan belts", "feather boards", "felt nails", "fence spurs", "filter cartridges",
  "fire bricks", "flashing tape", "flower pots", "fork handles", "frost cloth",
  "gate springs", "glazing sprigs", "gravel trays", "grease nipples", "guttering clips",
  "hand forks", "hasp and staple", "hay rakes", "hedge shears", "hook and eye",
  "hose reels", "hurdle panels", "jubilee clips", "kettle elements", "key blanks",
  "kneeling pads", "ladder feet", "lawn seed", "leaf grabbers", "lifting straps",
  "lime wash", "line pins", "locking nuts", "loft boards", "log rings",
  "measuring jugs", "mesh screens", "mortar boards", "moss killer", "nail punches",
  "netting pegs", "nozzle sets", "oil filters", "onion nets", "outdoor sockets",
  "packing crates", "paint kettles", "pea netting", "peat-free compost", "pegboard hooks",
  "pipe clips", "planting trays", "plaster beads", "plumb lines", "post caps",
  "potting grit", "pressure gauges", "pruning shears", "putty knives", "rain covers",
  "rasp files", "razor scrapers", "reel mowers", "resin anchors", "ridge vents",
  "rocker switches", "roofing felt", "rope cleats", "rubber mallets", "sack trucks",
  "scaffold boards", "screw eyes", "seed trays", "shear pins", "sheep hurdles",
  "shelf pins", "shovel handles", "sieve mesh", "slate hooks", "sledge heads",
  "sluice gates", "soil sieves", "spade grips", "spirit burners", "spray nozzles",
  "staple guns", "step treads", "stone chips", "storm straps", "strimmer heads",
  "sump covers", "swing hooks", "tank floats", "tarpaulin eyelets", "thatch pegs",
  "thread files", "tile nibblers", "timber wedges", "tool rolls", "torch batteries",
  "trowel blades", "tube cutters", "tyre levers", "valve keys", "vent covers",
  "wall anchors", "washing lines", "watering roses", "wheel braces", "window films",
  "wire cutters", "wood chips", "worm casts", "yard brooms", "zinc trays",
];

// github#36 -- a tail that reads after any subject
const FACETS = [
  "— what it cost", "— sizes", "— where it went", "— second attempt", "— what worked",
  "— snags", "— the quote", "— measurements", "— what is left", "— worth repeating",
  "— not worth it", "— the short version", "— before and after", "— what to order",
  "— who to ask", "— where it came from",
];

// github#36 -- no two openers off one root
const QUALITY = [
  "Cracked", "Loose", "Warped", "Seized", "Perished", "Split", "Rusted", "Chipped",
  "Sagging", "Missing", "Spare", "Surplus", "Mismatched", "Oversized", "Undersized",
  "Second-hand", "Galvanised", "Stainless", "Brass", "Reclaimed", "Bent", "Worn",
  "Leftover", "Odd", "Matched", "Numbered", "Awkward", "Heavy", "Narrow", "Wide",
  "Short", "Coarse", "Rough", "Smooth", "Threaded", "Countersunk", "Recessed", "Exposed",
  "Buried", "Hollow", "Solid", "Rigid", "Flexible", "Woven", "Knotted", "Frayed",
  "Blunt", "Sharpish", "Sticky", "Brittle", "Crooked", "Level", "Square", "Round",
  "Tapered", "Slotted", "Hooked", "Ribbed", "Toothed", "Spoked", "Hinged", "Latched",
  "Weathered", "Faded", "Mottled", "Streaked", "Pitted", "Scored", "Notched", "Scuffed",
];

const DECKS = {
  migration: ["Content inventory", "Redirect map for the old blog", "Cutover plan",
              "DNS and certificates", "Analytics parity", "Image pipeline",
              "Search indexing", "Legacy URLs worth keeping", "Rollback plan",
              "Editor training notes", "Accessibility pass", "Performance budget",
              "Launch checklist", "Post-launch snags", "Vendor questions",
              "Sitemap differences", "Comment migration", "Author bylines",
              "Tag taxonomy", "Feed URLs", "Embedded video", "Forms and spam",
              "Staging environment", "Font licensing", "Cookie banner",
              "Newsletter archive", "Broken anchors", "Table of contents",
              "Print stylesheet", "Search synonyms", "Robots and sitemaps",
              "Content freeze", "Author training", "Asset naming",
              "Old comment threads", "Canonical tags", "Image alt text",
              "Third-party embeds", "Uptime monitoring", "Error pages",
              "Backup before cutover", "Domain transfer", "Certificate renewal",
              "Redirect testing", "Load testing", "Contributor accounts",
              "Archive of the old theme", "Attachment sizes", "Draft states"],
  greenhouse: ["Base and footings", "Frame timber order", "Glazing quotes compared",
               "Guttering and downpipe", "Bench layout inside", "Ventilation openers",
               "Shading for July", "Water supply to the plot", "Old greenhouse dismantling",
               "Foundation levels", "Door and threshold", "Snag list after the build",
               "Staging for the glass", "Concrete mix for the base", "Path to the door",
               "Electrics to the bench", "Rainwater off the roof", "Bracing the frame",
               "Ridge and eaves detail", "Blinds for the south side", "Heater for February",
               "Thermometer placement", "Staging timber sizes", "Gravel under the benches",
               "Autovents compared", "Glass thickness", "Capping strips",
               "Louvre placement", "Hose to the plot", "Slab levels for the base",
               "Frost pocket readings", "Insulating the north wall",
               "Propagation bench heat", "Winter cover trials", "Drainage around the base",
               "Door closer", "Shelf brackets inside", "Second year snags"],
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
           "Writing is thinking, slowly", "You cannot schedule insight",
           "A file is a decision you have not made yet", "Accuracy is not the same as truth",
           "All measurement is a kind of editing", "An interruption costs twice",
           "Attention is the scarce input", "Balance is a verb",
           "Being wrong early is cheap", "Categories leak at the edges",
           "Certainty arrives last", "Choosing is most of doing",
           "Clarity is a courtesy", "Complexity is a debt with no schedule",
           "Consistency beats intensity", "Context is what a note usually loses",
           "Craft is noticing sooner", "Curiosity needs somewhere to put things",
           "Defaults are decisions nobody made", "Depth is a kind of patience",
           "Detail is where agreement goes to die", "Doing it twice teaches the shape",
           "Elegance is what is left over", "Estimates are opinions with numbers on",
           "Everything obvious was once argued about", "Explaining is a test of understanding",
           "Failure is information with a bad reputation", "Feedback ages badly",
           "Forgetting is a feature until it isn't", "Friction is a design choice",
           "Generality costs more than it looks", "Habits are cheaper than willpower",
           "Half-finished is a state worth naming", "Hurry is a way of paying later",
           "Improvisation rests on preparation", "Indexing is the work",
           "Inheritance is a promise about the future", "Intuition is compiled practice",
           "Knowing where it is beats knowing what it says",
           "Learning is mostly unlearning", "Lists outlive intentions",
           "Meaning is what survives summary", "Memory is a poor archivist",
           "Mistakes are cheaper on paper", "Nothing scales without a rule",
           "Noticing is a trainable skill", "Old notes are letters from a stranger",
           "Ordering is a claim about importance", "Patience is a technique",
           "Perfect is a way of not shipping", "Precision is not accuracy",
           "Preparation is invisible work", "Rereading is rewriting",
           "Revision is where the thinking happens", "Rules are compressed judgement",
           "Searching is a confession about filing", "Simple is expensive",
           "Standards are agreements about the boring parts",
           "Structure is what you notice when it is missing",
           "Summaries are arguments in disguise", "Taste is edited preference",
           "The first draft is for you", "The map earns its keep at the edges",
           "The second tool is usually the right one", "Time is the only honest unit",
           "Tools shape the questions", "Trust is a cache",
           "Understanding is knowing what to ignore", "Unread is not the same as unuseful",
           "Versions are a way of being kind to yourself",
           "What is measured is what is argued about", "Words are slower than thought",
           "Working memory is smaller than it feels"],
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
          "Weather for Gardeners — Duthie", "Yards, Feet and Thumbs — Tarrant",
          "A Field Guide to Hedges — Orde", "Bench and Vice — Ostler",
          "Casting Small Parts — Halloran", "Cellars and Cellaring — Kilbride",
          "Chalk, Lime and Sand — Renwick", "Cold Rooms — Sabo",
          "Drawing for Makers — Tarrant", "Dry Stone — Ashby",
          "Every Roof Eventually — Brannon", "Fences and What They Mean — Voss",
          "Grafting and Budding — Duthie", "Hand Planes — Ostler",
          "Heat, Damp and Timber — Kilbride", "Ink Trials — Vestergaard",
          "Iron and Rust — Halloran", "Knives and Their Edges — Mellis",
          "Lettering by Hand — Tarrant", "Levelling — Renwick",
          "Making Do — Brannon", "Mortar, Old and New — Ashby",
          "Notes on Bees — Aleman", "On Waiting — Gadby",
          "Orchards in Small Places — Orde", "Paper by Hand — Vestergaard",
          "Pigments and Patience — Ridout", "Rain, Measured — Aleman",
          "Repairing Windows — Ostler", "Roads and Verges — Voss",
          "Sharpening — Mellis", "Shelters and Sheds — Sabo",
          "Slow Water — Kilbride", "Small Engines — Brannon",
          "Soil, Read Closely — Duthie", "Stone Walls of the North — Ashby",
          "The Long Repair — Gadby", "The Quiet Workshop — Gadby",
          "Thread and Signature — Ferrier", "Tides Again — Voss",
          "Timber, Green and Dry — Renwick", "Tools Left Outside — Brannon",
          "Two Weeks of Weather — Aleman", "Walls That Breathe — Ashby",
          "Waxes and Finishes — Vestergaard", "Wells and Springs — Kilbride",
          "Wind and Shelter — Sabo", "Winter Work — Ridout"],
};

const MEETINGS = ["Migration sync", "Standup", "Budget review", "Planning", "Retro",
                  "Handover", "Supplier call", "Village hall committee",
                  "Allotment committee", "Greenhouse quotes", "Content review",
                  "Launch readiness", "Quarterly catch-up", "Kickoff",
                  "Site visit", "Snagging walk", "Roof quotes", "Drainage survey",
                  "Neighbours about the hedge", "Insurance renewal", "Bank appointment",
                  "Timber merchant", "Building control", "Tree officer",
                  "Bookbinding group", "Reading group", "Running club committee",
                  "Seed swap planning", "Open gardens meeting", "Show preparation"];

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

/* github#32, design/0034 -- A TITLE THAT STARTS LIKE A YEAR AND IS NOT ONE. Twelve digits, the
 * first four of them a plausible year; the 0-9 volume's index must leave it in the numeric
 * bucket rather than filing it under 2022 and looking for months that are not there. */
const DIGIT_RUN = "202212331243";

let linkedMentions = 0;
let proseMentions = 0;

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
  /* github#17 -- sixty more, because 5,000 notes draw this deck fifteen thousand times and a
   * reader who opens two notes in a row should not meet the same line twice. */
  "The quote came back higher than last year and lower than expected.",
  "Nobody could find the receipt, so the guarantee is academic.",
  "Measured from the wrong end the first time, which explains the offcut.",
  "The forecast was wrong in the useful direction.",
  "Half an hour of tidying made the rest of it possible.",
  "The second supplier answered within the day.",
  "It was already there, behind the other one.",
  "Started late and finished early, which is the good kind of surprise.",
  "The gap closed on its own once the timber dried.",
  "Written down here because the last time it took an afternoon to work out.",
  "Three trips to the yard when one would have done with a list.",
  "The dimensions on the drawing and the dimensions on the wall disagree.",
  "Left a note on the box so the next person does not open it.",
  "Warmer than it has any right to be for the time of year.",
  "The tool was fine; the technique was not.",
  "Two of them arrived and only one was needed.",
  "Cheaper to buy the set than the two pieces separately.",
  "The old one is still in the shed if it is ever wanted.",
  "The hole was in the right place and the wrong wall.",
  "Everything went to plan, which is worth recording for its rarity.",
  "The delivery driver could not find the lane again.",
  "It dried faster in the shade, which was not expected.",
  "The fitting is metric and everything around it is not.",
  "Took a photograph before it was covered up.",
  "The invoice arrived before the goods did.",
  "A second opinion agreed, and for a different reason.",
  "Ran out of daylight rather than patience.",
  "The manual is wrong about the order of the last two steps.",
  "It has not moved in six months, so it can be called settled.",
  "Borrowed the right tool and bought one the same week.",
  "The noise stopped on its own, which is not reassuring.",
  "Marked both ends so it goes back the same way round.",
  "The price has not changed since the last time, which is a first.",
  "Two coats were enough; three would have been better.",
  "The measurement was right and the assumption behind it was not.",
  "It is a job for two people and it was done by one.",
  "The replacement part is a different shape and fits anyway.",
  "Waited a week for the weather and did it in an afternoon.",
  "There is a simpler way and it was found afterwards.",
  "The order was short by one and nobody noticed until the end.",
  "It works better since it was taken apart and put back.",
  "The instructions and the photographs show different models.",
  "Kept the packaging, which turned out to matter.",
  "Cold enough overnight to matter, and it did.",
  "The joint is stronger than the wood around it now.",
  "Asked three people and got three answers, all of them reasonable.",
  "The estimate was in hours and the job was in days.",
  "Nothing here is urgent, which is why none of it is done.",
  "A list written in the evening reads differently in the morning.",
  "The same problem came back in a different corner.",
  "It is quieter now, and nobody can say exactly why.",
  "The spare was where it was supposed to be.",
  "Half the cost was delivery, which changes the decision.",
  "Worth doing properly once rather than twice at speed.",
  "The mark on the floor is from before and can be ignored.",
  "Better in daylight, and better still with the door open.",
  "The threads were fine and the seal was not.",
  "It came apart more easily than it went together.",
  "Rang to confirm and the appointment was not in the book.",
  "The reading settled after twenty minutes and stayed there.",
];

const HEADINGS = ["What happened", "What is left", "Open questions", "Next steps", "Costs",
                  "Measurements", "What was agreed", "Materials", "Background", "Problems",
                  "Decisions", "Timings", "Suppliers", "What to try next", "Afterwards",
                  "Method", "Results", "Kit", "Route", "Sources", "Follow-up", "Notes",
                  "Conditions", "Tools used", "What went wrong", "Quantities", "Sequence",
                  "Access", "Safety", "Waste", "Weather", "Who was there", "Quotes compared",
                  "Before", "After", "Still to check", "Worth repeating", "Not worth it",
                  "Dimensions", "Settings", "Where it is stored"];

const ITEMS = ["order the fittings", "measure the gap again", "book the collection slot",
               "email the supplier", "sharpen the chisels", "check the gauge",
               "photograph the joint before it closes", "return the wrong bracket",
               "top up the water butt", "label the boxes", "cut the second batch",
               "read the appendix", "chase the invoice", "reset the timer",
               "move the frame back a foot", "clean the filters",
               "write it down before Friday", "pick up the timber",
               "re-glue the loose leg", "compare last year's readings",
               "empty the dehumidifier", "oil the hinges", "find the second key",
               "book the skip", "check the loft for damp", "replace the washer",
               "tighten the bracket", "sweep the workshop", "sort the offcuts",
               "return the borrowed level", "ring about the delivery",
               "put the ladder away", "test the alarm", "drain the hose",
               "count what is left", "mark the cut line", "cover the stack",
               "charge the batteries", "clear the gully", "check the fuse",
               "take the old one to the tip", "measure the opening",
               "order more screws", "wipe down the bench", "put it on the list"];

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

/* AGED, NOT SPREAD -- the exponent is what makes the Years shelf uneven (design/0011). A draw
 * inside the hole is REDRAWN rather than moved: rejection is a pure function of the offset, so
 * the stream is the same at every --end. */
const agedOffset = () => {
  for (let guard = 0; guard < 64; guard++) {
    const offset = Math.floor(Math.pow(rand(), 2.6) * DAYS);
    if (!inHole(offset)) return offset;
  }
  return HOLE.from - 1;
};

/* github#17 -- the recent year dealt day by day, because the curve's tail was clumpy. `nth`
 * walks the folder's run across the year, jittered so it is not a cron job. */
const WORKDAYS = Math.floor(RECENT * 5 / 7);
const recentOffset = (nth, of) => {
  /* github#17 -- a FRACTION of a working day: floored, a folder of 160 notes strode 1 and
   * finished seven months in. */
  const spread = WORKDAYS / Math.max(1, of);
  const at = Math.min(WORKDAYS - 1, Math.floor(nth * spread + rand() * spread));
  let left = at;
  for (let offset = 0; offset < RECENT; offset++) {
    if (restDay(offset)) continue;
    if (left-- <= 0) return offset;
  }
  return Math.floor(rand() * RECENT);
};

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

// github#36
const PER_OPENER = 13;
const PER_SUBJECT = 3;
/** @type {string[]|null} */
let combined = null;
const invented = () => {
  if (!combined) {
    /** @type {string[][]} */
    const groups = [];
    for (const doing of DOING) groups.push(THINGS.map((t) => doing + " " + t));
    for (const quality of QUALITY) groups.push(THINGS.map((t) => quality + " " + t));
    /** @type {string[][]} */
    const subjects = THINGS.map((thing) => {
      const head = thing.charAt(0).toUpperCase() + thing.slice(1);
      return FACETS.map((f) => head + " " + f);
    });
    /** @type {string[]} */
    const all = [];
    const deal = (from, many) => from.forEach((group) => {
      const bag = shuffled(group);
      for (let i = 0; i < many && bag.length; i++) all.push(bag.pop());
    });
    deal(groups, PER_OPENER);
    deal(subjects, PER_SUBJECT);
    combined = shuffled(all);
  }
  return combined.pop() || null;
};

/* github#17 -- a taken title picks up a SUFFIX before it picks up a number, because "Gutter
 * brackets (4)" reads as a generator that ran out. rand() is consumed unconditionally. */
// github#36 -- the authored phrases once each, then the combined deck
let phrasesLeft = PHRASES.length;
/** @type {Record<string, number>} */
const deckLeft = {};
const titleFor = (folder) => {
  let base;
  // github#36
  if (folder.deck && deckLeft[folder.deck] === undefined) deckLeft[folder.deck] = DECKS[folder.deck].length;
  if (folder.deck && deckLeft[folder.deck]-- > 0) base = fromDeck(folder.deck, DECKS[folder.deck]);
  else if (phrasesLeft-- > 0) base = fromDeck("phrases", PHRASES);
  else base = invented() || fromDeck("phrases", PHRASES);
  if (!claimed.has(base)) return claim(base);
  for (const suffix of shuffled(SUFFIXES)) {
    const tried = base + " " + suffix;
    if (!claimed.has(tried)) return claim(tried);
  }
  return claim(base);
};

/* THE PEOPLE NOTES COME FIRST so everything after them can link to one. `type: people` is
 * the declared rule that makes a link to one of these a person (decisions/0003); the tag is
 * there because a vault usually carries both and the rule has to work either way. */
for (const who of NAMES.concat([LINKED_ONLY])) {
  const day = dayAt(agedOffset() + 30);
  plan.push({ folder: "07 - People", title: claim(who), kind: "person", day,
              fm: { type: "people", date: day, tags: ["person"] },
              tagSlots: 0, field: null, slots: 0, links: [], halvor: false });
}

/* github#17, decisions/0014 -- A RHYTHM, NOT A COUNT: every working day gets one with a
 * probability that decays with age, which is what fills ~459 ISO weeks and gives the layered
 * index the runs of consecutive days it needs (design/0015). */
const dailyChance = (offset) => 0.3 + 0.62 * Math.pow(1 - offset / DAYS, 2.4);
const dailyOffsets = [];
for (let offset = 0; offset < DAYS; offset++) {
  if (restDay(offset) || inHole(offset)) continue;
  if (rand() < dailyChance(offset) * SCALE) dailyOffsets.push(offset);
}
dailyOffsets.sort((a, b) => b - a);

for (const folder of FOLDERS) {
  const aged = Math.round(folder.aged * SCALE);
  const recent = Math.round(folder.recent * SCALE);
  const offsets = folder.kind === "daily"
    ? dailyOffsets
    : Array.from({ length: aged }, () => agedOffset())
        .concat(Array.from({ length: recent }, (_, i) => recentOffset(i, recent)));
  const count = offsets.length;

  for (let i = 0; i < count; i++) {
    const day = dayAt(offsets[i]);
    const kind = folder.kind;
    /* A MISSING VALUE GETS ITS OWN BOOK, so a fifth of the notes that are not about a day
     * have no date at all -- and the Undated book is a book, not an exclusion
     * (decisions/0003). A fifth rather than a twentieth since decisions/0014: it is what the
     * sparse fixture carried, and the Undated book being large rather than a curiosity is
     * what made it worth checking. */
    const undated = DATED_KINDS.indexOf(kind) < 0 && rand() < 0.2;
    /* ELEVEN BOOKS FOR ONE NOTE (decisions/0014). A handful of notes name five people and
     * six tags at once, which is the case the unique-membership law has something to be
     * wrong about -- the sparse fixture's reason for existing, declared here. */
    const busy = rand() < 0.009;
    const tagSlots = busy ? 6
      : rand() < 0.08 ? 0 : rand() < 0.13 ? 3 : rand() < 0.45 ? 2 : 1;
    /** @type {Record<string, unknown>} */
    const fm = { type: TYPE_OF[kind] };
    let title = null;
    let field = null;
    let slots = 0;

    if (kind === "daily") {
      title = claim(day);
      fm.date = day;
      field = "people";
      slots = busy ? 5 : rand() < 0.35 ? 1 : 0;
    } else if (kind === "meeting") {
      title = claim(day + " " + pick(MEETINGS));
      fm.date = day;
      /* THE SECOND OF THE THREE WAYS A PERSON IS NAMED: `attendees` on a meeting note. The
       * setting is a list of properties precisely because one vault writes this and another
       * writes `person` -- naming only one leaves half the shelf empty. */
      field = "attendees";
      slots = busy ? 5 : between(1, 3);
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
      slots = busy ? 5 : rand() < 0.32 ? 1 : 0;
    }

    plan.push({ folder: folder.path, title, kind, day: undated ? null : day, fm,
                tagSlots, field, slots, links: [], halvor: false });
  }
}

/* ---- dealing the people and the tags ------------------------------------- */

const dealt = new Map();
const peopleSlots = plan.reduce((sum, n) => sum + n.slots, 0);
/* The tail takes its own slots off the top; the shares are cut to whatever is left, and the
 * two are shuffled together so a tail person is not all at one end of the bag. */
const peopleBag = shuffled(
  bagFor(PEOPLE, Math.max(0, peopleSlots - TAIL_SLOTS))
    .concat(TAIL_PEOPLE.flatMap(([who, n]) => Array.from({ length: n }, () => who))));
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
  if (!note.halvor && rand() < 0.1) {
    proseMentions++;
    out.push(PROSE_ONLY + " mentioned the same thing in passing.");
  }
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

/* github#32, design/0034 -- A DIGIT RUN THAT IS NOT A DATE. `202212331243` opens with the same
 * four characters as a 2022 daily note, and the 0-9 volume's index must not file it under 2022:
 * there is no month behind it to cut by. Without one in the vault, the `(?!\d)` that stops it
 * is unreachable from any check. */
write("00 - Inbox", DIGIT_RUN, { type: "note", tags: ["reference"], date: dayAt(11) },
      "# " + DIGIT_RUN + "\n\n" +
      "The reference as it came off the label, typed in whole so it can be found again. It " +
      "is not a date and nothing here should read it as one.\n");

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

/* github#19, design/0037 -- the one note that writes its own tag in its prose */
const STICKY_NOTE = "A season in the same bed, start to finish";
const stickyBody = ["# " + STICKY_NOTE, "",
                    "Everything one bed did in a year, written down once, and filed where " +
                    "the rest of the bed notes are.", ""];
for (let s = 0; s < 9; s++) {
  stickyBody.push("## " + (s + 1) + ". " + pick(HEADINGS), "");
  stickyBody.push(para(between(3, 5)), "");
  if (s === 1) stickyBody.push("Everything from here on is #garden work and nothing else.", "");
  if (s === 4) stickyBody.push("Cross-referenced with the rest of #garden at this point.", "");
  if (s === 6) stickyBody.push("The sowing half of it is under #garden/seeds instead.", "");
  if (s % 3 === 1) stickyBody.push(bullets(4, false), "");
  if (s % 4 === 2) stickyBody.push(quote(), "");
  stickyBody.push(para(between(2, 4)), "");
}
stickyBody.push("## Next year", "", para(3), "",
                "Same bed, same notebook, and the tag stays #garden.", "");
write("03 - Resources", STICKY_NOTE,
      { type: "reference", date: dayAt(between(30, 900)), tags: ["garden"],
        status: "Evergreen", area: "Growing" },
      stickyBody.join("\n"));

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

/* ---- the guard -----------------------------------------------------------
 * design/0013, github#17 -- the generator proves its own declaration, the way the mirror
 * proves no real string reached it. Each case below was a real failure first. */
const problems = [];
const dated = plan.filter((n) => n.day).map((n) => n.day);
const endMs = Date.parse(END + "T00:00:00Z");

/* github#17 -- no empty month in the last three years. */
const months = new Set(dated.map((d) => d.slice(0, 7)));
const endDate = new Date(endMs);
const emptyMonths = [];
for (let back = 0; back < 36; back++) {
  const d = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth() - back, 1));
  const key = d.toISOString().slice(0, 7);
  if (!months.has(key)) emptyMonths.push(key);
}
if (emptyMonths.length) {
  problems.push(`${emptyMonths.length} of the last 36 months hold no note: ` +
                emptyMonths.slice(0, 6).join(", "));
}

/* github#17 -- no empty week in the last year: the Weeks shelf is worth un-hiding. */
const isoWeekOf = (day) => {
  const d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3);
  const first = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d - first) / 86400000 - 3 + ((first.getUTCDay() + 6) % 7)) / 7);
  return d.getUTCFullYear() + "-W" + String(week).padStart(2, "0");
};
const weeks = new Set(dated.map(isoWeekOf));
const emptyWeeks = [];
for (let back = 0; back < 52; back++) {
  const key = isoWeekOf(dayAt(back * 7));
  if (!weeks.has(key) && emptyWeeks.indexOf(key) < 0) emptyWeeks.push(key);
}
if (emptyWeeks.length) {
  problems.push(`${emptyWeeks.length} of the last 52 weeks hold no note: ` +
                emptyWeeks.slice(0, 6).join(", "));
}

/* decisions/0014 -- the hole is in offsets, so the only honest way to know a calendar year
 * came out empty is to look. */
const years = new Set(dated.map((d) => d.slice(0, 4)));
const span = [...years].map(Number).sort((a, b) => a - b);
const hollow = [];
for (let y = span[0]; y <= span[span.length - 1]; y++) if (!years.has(String(y))) hollow.push(y);
if (!hollow.length) {
  problems.push(`no empty year inside ${span[0]}-${span[span.length - 1]}: the hole at ` +
                `offsets ${HOLE.from}-${HOLE.to} is too narrow to swallow a whole one`);
}

/* decisions/0003 -- the sentinels; each would go quiet rather than red if it went missing. */
if (proseMentions < 5) {
  problems.push(`${PROSE_ONLY} is named in ${proseMentions} bodies; the People shelf has ` +
                `nothing to wrongly grow a book from`);
}
if (linkedMentions < 5) {
  problems.push(`${linkedMentions} notes link to ${LINKED_ONLY}; too few to tell a linked ` +
                `person from an absent one`);
}
for (const [who, where] of [[PROSE_ONLY, "prose"], [LINKED_ONLY, "links"]]) {
  const named = plan.some((n) => ["people", "attendees", "person"].some((k) => {
    const v = n.fm[k];
    return Array.isArray(v) ? v.indexOf(who) >= 0 : v === who;
  }));
  if (named) problems.push(`${who} is meant to be reachable only through ${where}, and a ` +
                           `people property names them`);
}
if (!written.has("/Wide table of everything")) {
  problems.push("the wide-table note was not written, and a check opens it by name");
}
if (!written.has("00 - Inbox/" + DIGIT_RUN)) {
  problems.push(`${DIGIT_RUN} was not written; nothing in the vault then starts like a year ` +
                `without being one, and the 0-9 index has no digit run to leave alone`);
}
/* github#19, design/0037 -- three in the prose, and one child tag that is not it */
const stickySaid = (stickyBody.join("\n").match(/(^|\s)#garden(?![\w/-])/g) || []).length;
const stickyChild = (stickyBody.join("\n").match(/(^|\s)#garden\/seeds(?![\w/-])/g) || []).length;
if (!written.has("03 - Resources/" + STICKY_NOTE) || stickySaid < 3 || stickyChild !== 1) {
  problems.push(`the fore-edge sentinel says #garden ${stickySaid} times and #garden/seeds ` +
                `${stickyChild}; nothing else in this vault writes a tag in its body, so the ` +
                `sticky-note marks have only the details line to point at`);
}
const tailPeople = [...dealt.entries()].filter(([, n]) => n <= 3).length;
if (tailPeople < TAIL_PEOPLE.length - 1) {
  problems.push(`only ${tailPeople} people are in three notes or fewer; the People shelf's ` +
                `long tail flattened out (a share scales, a count must not)`);
}
const drift = Math.abs(count - NOTES) / NOTES;
if (drift > 0.08) {
  problems.push(`wrote ${count} notes against a declared ${NOTES} (${(drift * 100).toFixed(1)}% ` +
                `out); the folder table and DECLARED have drifted apart`);
}

if (problems.length) {
  console.error(`\nmake-vault: the vault written does not match the vault declared\n`);
  for (const one of problems) console.error("  " + one);
  console.error(`\nFix the declaration rather than the check: every number in ` +
                `.ai-context/invariants.md was measured off this shape.`);
  process.exit(1);
}

const top = [...dealt.entries()].sort((a, b) => b[1] - a[1])[0];
const undatedCount = plan.filter((n) => !n.day).length;
const lastYear = dated.filter((d) => Date.parse(d + "T00:00:00Z") > endMs - RECENT * 86400000);
console.log(`wrote ${count} notes to ${OUT} (seed ${SEED}, end ${END}, ${DAYS} days, ` +
            `${(DAYS / 365.25).toFixed(1)} years); ${top[0]} is in ${top[1]} notes and ` +
            `${tailPeople} people are in three or fewer; ${linkedMentions} notes link to ` +
            `${LINKED_ONLY} and none names them in a property`);
console.log(`  ${dated.length} dated, ${undatedCount} undated; ${weeks.size} ISO weeks hold a ` +
            `note and none of the last 52 is empty; ${hollow.join(", ")} is the year nobody ` +
            `wrote; ${lastYear.length} notes in the rolling twelve months`);
