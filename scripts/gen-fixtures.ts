/**
 * Generates the SYNTHETIC mock fixtures in fixtures/qloo/*.json.
 * Nothing here is captured from Qloo. Shapes follow docs/SPEC.md section 4.
 * Entity names are public cultural entities; businesses are fictional.
 * Run: npx tsx scripts/gen-fixtures.ts
 */
import fs from "node:fs";
import path from "node:path";

// ---- deterministic v4-looking uuids ----
let seed = 20261022;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
const hex = (n: number) => Array.from({ length: n }, () => Math.floor(rnd() * 16).toString(16)).join("");
const uuid = () => `${hex(8)}-${hex(4)}-4${hex(3)}-${"89ab"[Math.floor(rnd() * 4)]}${hex(3)}-${hex(12)}`;
const ids = new Map<string, string>();
const id = (k: string) => { if (!ids.has(k)) ids.set(k, uuid()); return ids.get(k)!; };

// ---- tags ----
type Tag = { id: string; name: string; type: string };
const T: Record<string, Tag> = {};
const tg = (key: string, urn: string, name: string, type = urn.split(":").slice(0, 4).join(":")) => (T[key] = { id: urn, name, type });
tg("country", "urn:tag:genre:media:country", "Country");
tg("outlaw", "urn:tag:genre:media:outlaw_country", "Outlaw country");
tg("classicrock", "urn:tag:genre:media:classic_rock", "Classic rock");
tg("soul", "urn:tag:genre:media:soul", "Soul");
tg("gospel", "urn:tag:genre:media:gospel", "Gospel");
tg("folk", "urn:tag:genre:media:folk", "Folk");
tg("artrock", "urn:tag:genre:media:art_rock", "Art rock");
tg("punk", "urn:tag:genre:media:punk", "Punk");
tg("western", "urn:tag:genre:media:western", "Western");
tg("drama", "urn:tag:genre:media:drama", "Drama");
tg("sitcom", "urn:tag:genre:media:sitcom", "Sitcom");
tg("anime", "urn:tag:genre:media:animation", "Animation");
tg("scifi", "urn:tag:genre:media:science_fiction", "Science fiction");
tg("fantasy", "urn:tag:genre:media:fantasy", "Fantasy");
tg("poetry", "urn:tag:genre:media:poetry", "Poetry");
tg("memoir", "urn:tag:genre:media:memoir", "Memoir");
tg("baseball", "urn:tag:genre:media:baseball", "Baseball");
tg("kwnostalgia", "urn:tag:keyword:media:nostalgia", "Nostalgia");
tg("kwroad", "urn:tag:keyword:media:road_trip", "Road trip");
tg("kwfaith", "urn:tag:keyword:media:faith", "Faith");
tg("kwsmalltown", "urn:tag:keyword:media:small_town", "Small town");
tg("kwoutsider", "urn:tag:keyword:media:outsider", "Outsider");
tg("stylewarm", "urn:tag:style:qloo:warm", "Warm");
tg("styleraw", "urn:tag:style:qloo:raw", "Raw");
tg("styledreamy", "urn:tag:style:qloo:dreamy", "Dreamy");
tg("hobbyfish", "urn:tag:hobby:fishing", "Fishing", "urn:tag:hobby");
tg("hobbygarden", "urn:tag:hobby:gardening", "Gardening", "urn:tag:hobby");
tg("hobbypinball", "urn:tag:hobby:pinball", "Pinball", "urn:tag:hobby");
tg("hobbyrecords", "urn:tag:hobby:record_collecting", "Record collecting", "urn:tag:hobby");
tg("mexican", "urn:tag:cuisine:place:mexican", "Mexican", "urn:tag:cuisine");
tg("thai", "urn:tag:cuisine:place:thai", "Thai", "urn:tag:cuisine");
tg("southern", "urn:tag:cuisine:place:southern", "Southern and soul food", "urn:tag:cuisine");
tg("diner", "urn:tag:cuisine:place:diner", "Diner", "urn:tag:cuisine");
tg("bbq", "urn:tag:cuisine:place:barbecue", "Barbecue", "urn:tag:cuisine");
tg("catering", "urn:tag:category:place:caterer", "Caterer", "urn:tag:category");
tg("venue", "urn:tag:category:place:event_venue", "Event venue", "urn:tag:category");
tg("banquet", "urn:tag:category:place:banquet_hall", "Banquet hall", "urn:tag:category");
tg("community", "urn:tag:category:place:community_center", "Community center", "urn:tag:category");
tg("churchhall", "urn:tag:category:place:church_hall", "Church hall", "urn:tag:category");
tg("park", "urn:tag:category:place:park", "Park", "urn:tag:category");
tg("bar", "urn:tag:category:place:bar", "Bar", "urn:tag:category");
tg("nightclub", "urn:tag:category:place:nightclub", "Nightclub", "urn:tag:category");
tg("brewery", "urn:tag:category:place:brewery", "Brewery", "urn:tag:category");
tg("arcade", "urn:tag:category:place:arcade", "Arcade", "urn:tag:category");
tg("rooftop", "urn:tag:category:place:rooftop", "Rooftop", "urn:tag:category");
tg("trail", "urn:tag:category:place:hiking_trail", "Hiking trail", "urn:tag:category");
tg("restaurant", "urn:tag:category:place:restaurant", "Restaurant", "urn:tag:category");
tg("coffee", "urn:tag:category:place:coffee_shop", "Coffee shop", "urn:tag:category");
tg("recordshop", "urn:tag:category:place:record_store", "Record store", "urn:tag:category");
const tags = (...k: string[]) => k.map((x) => T[x]);

// ---- entities ----
type Ent = {
  key: string; name: string; type: string; pop: number; props?: Record<string, unknown>; tags?: string[];
};
const ENT: Record<string, Ent> = {};
const E = (key: string, name: string, type: string, pop: number, props: Record<string, unknown> = {}, tgs: string[] = []) =>
  (ENT[key] = { key, name, type: `urn:entity:${type}`, pop, props, tags: tgs });
const img = (k: string) => ({ url: `https://images.example.invalid/${k}.jpg` });

// artists. start_year is a synthetic stand-in for career start (verify on probe)
E("haggard", "Merle Haggard", "artist", 0.78, { start_year: 1963 }, ["country", "outlaw"]);
E("cash", "Johnny Cash", "artist", 0.92, { start_year: 1955 }, ["country", "folk"]);
E("owens", "Buck Owens", "artist", 0.55, { start_year: 1957 }, ["country"]);
E("jennings", "Waylon Jennings", "artist", 0.7, { start_year: 1958 }, ["country", "outlaw"]);
E("nelson", "Willie Nelson", "artist", 0.9, { start_year: 1956 }, ["country", "outlaw"]);
E("strait", "George Strait", "artist", 0.78, { start_year: 1975 }, ["country"]);
E("kristofferson", "Kris Kristofferson", "artist", 0.66, { start_year: 1969 }, ["country", "folk"]);
E("parsons", "Gram Parsons", "artist", 0.5, { start_year: 1965 }, ["country"]);
E("tubb", "Ernest Tubb", "artist", 0.45, { start_year: 1936 }, ["country"]);
E("bowie", "David Bowie", "artist", 0.96, { start_year: 1964 }, ["artrock", "classicrock"]);
E("smith", "Patti Smith", "artist", 0.7, { start_year: 1971 }, ["punk", "poetry"]);
E("reed", "Lou Reed", "artist", 0.78, { start_year: 1964 }, ["artrock", "punk"]);
E("eno", "Brian Eno", "artist", 0.72, { start_year: 1971 }, ["artrock"]);
E("talking", "Talking Heads", "artist", 0.82, { start_year: 1975 }, ["artrock", "punk"]);
E("kate", "Kate Bush", "artist", 0.8, { start_year: 1978 }, ["artrock"]);
E("joni", "Joni Mitchell", "artist", 0.84, { start_year: 1964 }, ["folk"]);
E("cure", "The Cure", "artist", 0.86, { start_year: 1978 }, ["artrock", "punk"]);
E("hisaishi", "Joe Hisaishi", "artist", 0.6, { start_year: 1981 }, ["anime"]);
E("mahalia", "Mahalia Jackson", "artist", 0.6, { start_year: 1927 }, ["gospel", "soul"]);
E("aretha", "Aretha Franklin", "artist", 0.93, { start_year: 1956 }, ["soul", "gospel"]);
E("dolly", "Dolly Parton", "artist", 0.94, { start_year: 1959 }, ["country", "folk"]);
E("sam", "Sam Cooke", "artist", 0.75, { start_year: 1951 }, ["soul", "gospel"]);
E("staples", "The Staple Singers", "artist", 0.55, { start_year: 1948 }, ["gospel", "soul"]);
E("rosetta", "Sister Rosetta Tharpe", "artist", 0.55, { start_year: 1938 }, ["gospel"]);
E("clark", "Mavis Staples", "artist", 0.5, { start_year: 1950 }, ["gospel", "soul"]);
E("otis", "Otis Redding", "artist", 0.8, { start_year: 1960 }, ["soul"]);
E("patsy", "Patsy Cline", "artist", 0.78, { start_year: 1955 }, ["country"]);
E("ghostband", "Ghost", "artist", 0.71, { start_year: 2006 }, ["artrock"]);
// books / authors (Qloo has books; authors in properties)
E("b_rascal", "The Outlaw Josey Wales", "book", 0.4, { publication_year: 1972, author: "Forrest Carter" }, ["western"]);
E("b_lonesome", "Lonesome Dove", "book", 0.8, { publication_year: 1985, author: "Larry McMurtry" }, ["western", "drama"]);
E("b_old", "The Old Man and the Sea", "book", 0.85, { publication_year: 1952, author: "Ernest Hemingway" }, ["drama", "kwoutsider"]);
E("b_river", "A River Runs Through It", "book", 0.7, { publication_year: 1976, author: "Norman Maclean" }, ["memoir", "hobbyfish"]);
E("b_ox", "Blood Meridian", "book", 0.6, { publication_year: 1985, author: "Cormac McCarthy" }, ["western"]);
E("b_trueg", "True Grit", "book", 0.65, { publication_year: 1968, author: "Charles Portis" }, ["western"]);
E("b_ofmice", "Of Mice and Men", "book", 0.85, { publication_year: 1937, author: "John Steinbeck" }, ["drama"]);
E("b_dispossessed", "The Dispossessed", "book", 0.7, { publication_year: 1974, author: "Ursula K. Le Guin" }, ["scifi"]);
E("b_lefthand", "The Left Hand of Darkness", "book", 0.75, { publication_year: 1969, author: "Ursula K. Le Guin" }, ["scifi"]);
E("b_justkids", "Just Kids", "book", 0.7, { publication_year: 2010, author: "Patti Smith" }, ["memoir"]);
E("b_dick", "Do Androids Dream of Electric Sheep?", "book", 0.78, { publication_year: 1968, author: "Philip K. Dick" }, ["scifi"]);
E("b_wizard", "A Wizard of Earthsea", "book", 0.72, { publication_year: 1968, author: "Ursula K. Le Guin" }, ["fantasy"]);
E("b_gaiman", "Neverwhere", "book", 0.66, { publication_year: 1996, author: "Neil Gaiman" }, ["fantasy"]);
E("b_cage", "I Know Why the Caged Bird Sings", "book", 0.9, { publication_year: 1969, author: "Maya Angelou" }, ["memoir", "kwfaith"]);
E("b_stillirise", "And Still I Rise", "book", 0.7, { publication_year: 1978, author: "Maya Angelou" }, ["poetry"]);
E("b_color", "The Color Purple", "book", 0.88, { publication_year: 1982, author: "Alice Walker" }, ["drama", "kwfaith"]);
E("b_mocking", "To Kill a Mockingbird", "book", 0.95, { publication_year: 1960, author: "Harper Lee" }, ["drama", "kwsmalltown"]);
E("b_their", "Their Eyes Were Watching God", "book", 0.75, { publication_year: 1937, author: "Zora Neale Hurston" }, ["drama"]);
E("b_rose", "The Rose Garden Companion", "book", 0.3, { publication_year: 1998, author: "Gwen Hale" }, ["hobbygarden"]);
E("b_gilead", "Gilead", "book", 0.55, { publication_year: 2004, author: "Marilynne Robinson" }, ["kwfaith"]);
E("b_gen1", "Where the Crawdads Sing", "book", 0.85, { publication_year: 2018, author: "Delia Owens" }, ["drama"]);
E("b_gen2", "The Alchemist", "book", 0.9, { publication_year: 1988, author: "Paulo Coelho" }, ["fantasy"]);
E("b_gen3", "Mere Christianity", "book", 0.7, { publication_year: 1952, author: "C. S. Lewis" }, ["kwfaith"]);
E("b_gen4", "Wild: From Lost to Found", "book", 0.7, { publication_year: 2012, author: "Cheryl Strayed" }, ["memoir"]);
E("b_gen5", "Poems for Every Season", "book", 0.4, { publication_year: 2005, author: "Various authors" }, ["poetry"]);
E("b_gen6", "When Breath Becomes Air", "book", 0.8, { publication_year: 2016, author: "Paul Kalanithi" }, ["memoir"]);
// movies
E("m_unforgiven", "Unforgiven", "movie", 0.8, { release_year: 1992, image: img("unforgiven") }, ["western", "drama"]);
E("m_josey", "The Outlaw Josey Wales", "movie", 0.66, { release_year: 1976, image: img("josey") }, ["western"]);
E("m_gbu", "The Good, the Bad and the Ugly", "movie", 0.9, { release_year: 1966, image: img("gbu") }, ["western"]);
E("m_gran", "Gran Torino", "movie", 0.82, { release_year: 2008, image: img("gran") }, ["drama"]);
E("m_walk", "Walk the Line", "movie", 0.8, { release_year: 2005, image: img("walk") }, ["drama", "country"]);
E("m_bull", "Bull Durham", "movie", 0.7, { release_year: 1988, image: img("bull") }, ["baseball"]);
E("m_field", "Field of Dreams", "movie", 0.82, { release_year: 1989, image: img("field") }, ["baseball", "kwnostalgia"]);
E("m_river", "A River Runs Through It", "movie", 0.7, { release_year: 1992, image: img("river") }, ["hobbyfish"]);
E("m_spirited", "Spirited Away", "movie", 0.92, { release_year: 2001, image: img("spirited") }, ["anime", "fantasy"]);
E("m_totoro", "My Neighbor Totoro", "movie", 0.88, { release_year: 1988, image: img("totoro") }, ["anime", "kwnostalgia"]);
E("m_kiki", "Kiki's Delivery Service", "movie", 0.8, { release_year: 1989, image: img("kiki") }, ["anime"]);
E("m_ziggy", "Ziggy Stardust and the Spiders from Mars", "movie", 0.5, { release_year: 1979, image: img("ziggy") }, ["artrock"]);
E("m_labyrinth", "Labyrinth", "movie", 0.78, { release_year: 1986, image: img("labyrinth") }, ["fantasy"]);
E("m_bladerunner", "Blade Runner", "movie", 0.9, { release_year: 1982, image: img("bladerunner") }, ["scifi"]);
E("m_pinball", "Tommy", "movie", 0.6, { release_year: 1975, image: img("tommy") }, ["artrock", "hobbypinball"]);
E("m_colorp", "The Color Purple", "movie", 0.85, { release_year: 1985, image: img("colorp") }, ["drama"]);
E("m_steel", "Steel Magnolias", "movie", 0.8, { release_year: 1989, image: img("steel") }, ["drama", "kwsmalltown"]);
E("m_mocking", "To Kill a Mockingbird", "movie", 0.88, { release_year: 1962, image: img("mocking") }, ["drama"]);
E("m_ghostmovie", "Ghost", "movie", 0.66, { release_year: 1990, image: img("ghostfilm") }, ["drama"]);
E("m_g1", "It's a Wonderful Life", "movie", 0.9, { release_year: 1946, image: img("wonderful") }, ["kwnostalgia", "kwsmalltown"]);
E("m_g2", "The Sandlot", "movie", 0.75, { release_year: 1993, image: img("sandlot") }, ["baseball", "kwnostalgia"]);
E("m_g3", "Casablanca", "movie", 0.88, { release_year: 1942, image: img("casablanca") }, ["drama"]);
E("m_g4", "Cinema Paradiso", "movie", 0.8, { release_year: 1988, image: img("paradiso") }, ["kwnostalgia"]);
E("m_g5", "Singin' in the Rain", "movie", 0.8, { release_year: 1952, image: img("singin") }, ["kwnostalgia"]);
// tv
E("t_rawhide", "Rawhide", "tv_show", 0.5, { release_year: 1959, image: img("rawhide") }, ["western"]);
E("t_gunsmoke", "Gunsmoke", "tv_show", 0.6, { release_year: 1955, image: img("gunsmoke") }, ["western"]);
E("t_bonanza", "Bonanza", "tv_show", 0.6, { release_year: 1959, image: img("bonanza") }, ["western"]);
E("t_hee", "Hee Haw", "tv_show", 0.5, { release_year: 1969, image: img("heehaw") }, ["country", "sitcom"]);
E("t_xfiles", "The X-Files", "tv_show", 0.9, { release_year: 1993, image: img("xfiles") }, ["scifi", "drama"]);
E("t_twin", "Twin Peaks", "tv_show", 0.85, { release_year: 1990, image: img("twinpeaks") }, ["drama", "kwoutsider"]);
E("t_portlandia", "Portlandia", "tv_show", 0.7, { release_year: 2011, image: img("portlandia") }, ["sitcom"]);
E("t_tz", "The Twilight Zone", "tv_show", 0.85, { release_year: 1959, image: img("twilight") }, ["scifi"]);
E("t_andy", "The Andy Griffith Show", "tv_show", 0.82, { release_year: 1960, image: img("andy") }, ["sitcom", "kwsmalltown"]);
E("t_beverly", "The Beverly Hillbillies", "tv_show", 0.7, { release_year: 1962, image: img("hillbillies") }, ["sitcom"]);
E("t_golden", "The Golden Girls", "tv_show", 0.88, { release_year: 1985, image: img("golden") }, ["sitcom"]);
E("t_lawrence", "The Lawrence Welk Show", "tv_show", 0.4, { release_year: 1955, image: img("welk") }, ["kwnostalgia"]);
E("t_mayberry", "Mayberry R.F.D.", "tv_show", 0.4, { release_year: 1968, image: img("mayberry") }, ["sitcom", "kwsmalltown"]);
E("t_gen1", "I Love Lucy", "tv_show", 0.9, { release_year: 1951, image: img("lucy") }, ["sitcom"]);
E("t_gen2", "M*A*S*H", "tv_show", 0.85, { release_year: 1972, image: img("mash") }, ["sitcom", "drama"]);
E("t_gen3", "Little House on the Prairie", "tv_show", 0.75, { release_year: 1974, image: img("prairie") }, ["drama", "kwsmalltown"]);
E("t_gen4", "Cheers", "tv_show", 0.88, { release_year: 1982, image: img("cheers") }, ["sitcom"]);
// podcasts and brands
E("p_scully", "Vin Scully: Dodgers Broadcast Highlights", "podcast", 0.35, {}, ["baseball", "kwnostalgia"]);
E("p_fishing", "The Bass Fishing Hour", "podcast", 0.3, {}, ["hobbyfish"]);
E("p_opry", "Grand Ole Opry Radio Hour", "podcast", 0.4, {}, ["country"]);
E("p_ghibli", "The Ghibli Cast", "podcast", 0.3, {}, ["anime"]);
E("p_bowie", "Bowie: Starman Sessions", "podcast", 0.3, {}, ["artrock"]);
E("p_gardening", "The Garden Hour", "podcast", 0.3, {}, ["hobbygarden"]);
E("p_gospel", "Gospel Hour Radio", "podcast", 0.35, {}, ["gospel"]);
E("p_gen", "Story Hour: Tales Worth Telling", "podcast", 0.4, {}, ["memoir"]);
E("p_gen2", "Songs We Love: A Music Memory Show", "podcast", 0.4, {}, ["kwnostalgia"]);
E("br_dodgers", "Los Angeles Dodgers", "brand", 0.9, {}, ["baseball"]);
E("br_ghibli", "Studio Ghibli", "brand", 0.9, {}, ["anime"]);
E("br_stetson", "Stetson", "brand", 0.6, {}, ["western"]);
E("br_wrangler", "Wrangler", "brand", 0.65, {}, ["western"]);
E("br_shimano", "Shimano", "brand", 0.5, {}, ["hobbyfish"]);
E("br_polaroid", "Polaroid", "brand", 0.6, {}, ["kwnostalgia"]);
E("br_powells", "Powell's Books", "brand", 0.5, {}, ["poetry"]);
E("br_fender", "Fender", "brand", 0.7, {}, ["classicrock"]);
E("br_burpee", "Burpee Seeds", "brand", 0.4, {}, ["hobbygarden"]);
E("br_bible", "Gaither Music", "brand", 0.35, {}, ["gospel"]);
E("br_gen", "Levi's", "brand", 0.8, {}, ["kwnostalgia"]);
E("br_gen2", "Coca-Cola", "brand", 0.9, {}, ["kwnostalgia"]);
// people (writer / actor)
E("pe_eastwood", "Clint Eastwood", "person", 0.9, {}, ["western"]);
E("pe_leguin", "Ursula K. Le Guin", "person", 0.7, {}, ["scifi"]);
E("pe_angelou", "Maya Angelou", "person", 0.85, {}, ["poetry", "memoir"]);

const toSearch = (e: Ent) => ({
  name: e.name, entity_id: id(e.key), types: [e.type], popularity: e.pop,
  properties: { ...(e.props ?? {}) }, tags: tags(...(e.tags ?? [])),
});

// ---- search fixtures ----
const search: Record<string, unknown[]> = {};
const S = (q: string, keys: string[]) => (search[q] = keys.map((k) => toSearch(ENT[k])));
S("merle haggard", ["haggard"]); S("johnny cash", ["cash"]); S("clint eastwood", ["pe_eastwood"]);
S("los angeles dodgers", ["br_dodgers"]); S("dodgers", ["br_dodgers"]);
S("david bowie", ["bowie"]); S("patti smith", ["smith"]); S("studio ghibli", ["br_ghibli"]);
S("ursula k le guin", ["pe_leguin"]); S("the x-files", ["t_xfiles"]); S("x-files", ["t_xfiles"]);
S("mahalia jackson", ["mahalia"]); S("aretha franklin", ["aretha"]); S("dolly parton", ["dolly"]);
S("the andy griffith show", ["t_andy"]); S("andy griffith show", ["t_andy"]); S("maya angelou", ["pe_angelou"]);
S("ghost", ["ghostband", "m_ghostmovie"]);
// tag-like loves resolve through /v2/tags, so /search returns nothing for them
for (const q of ["bass fishing", "carne asada", "black coffee at the diner", "pinball", "thai food", "rainy-day record shops", "rose garden", "fried catfish and greens"]) search[q] = [];

// ---- tag lookups ----
const tagsFx: Record<string, Tag[]> = {
  "carne asada": tags("mexican"), mexican: tags("mexican"),
  "bass fishing": tags("hobbyfish"), fishing: tags("hobbyfish"),
  "black coffee": tags("diner", "coffee"), diner: tags("diner"), coffee: tags("coffee", "diner"),
  "thai": tags("thai"), "thai food": tags("thai"), pinball: tags("hobbypinball", "arcade"),
  "record shops": tags("hobbyrecords", "recordshop"), "rose garden": tags("hobbygarden"), gardening: tags("hobbygarden"),
  catfish: tags("southern"), "fried catfish": tags("southern"), "soul food": tags("southern"), greens: tags("southern"),
  barbecue: tags("bbq"), caterer: tags("catering"), catering: tags("catering"), restaurant: tags("restaurant"),
  "event venue": tags("venue"), "banquet hall": tags("banquet"), "community center": tags("community"),
  "church hall": tags("churchhall"), "fellowship hall": tags("churchhall"), park: tags("park"),
  bar: tags("bar"), nightclub: tags("nightclub"), brewery: tags("brewery"), rooftop: tags("rooftop"), "hiking trail": tags("trail"),
};

// ---- insights lists, keyed by profile (profile id lists live in "signals") ----
const lists = {
  walt: {
    signals: ["haggard", "cash", "br_dodgers", "pe_eastwood"],
    artist: [["haggard", .97, ["haggard", "cash"]], ["cash", .95, ["haggard", "cash"]], ["owens", .91, ["haggard"]], ["jennings", .88, ["haggard", "cash"]], ["nelson", .86, ["haggard", "cash"]], ["strait", .82, ["haggard"]], ["kristofferson", .79, ["cash"]], ["tubb", .74, ["haggard"]], ["parsons", .7, ["haggard"]]],
    book: [["b_lonesome", .9, ["pe_eastwood"]], ["b_trueg", .86, ["pe_eastwood"]], ["b_river", .83, ["haggard"]], ["b_old", .8, ["haggard", "pe_eastwood"]], ["b_ofmice", .76, ["cash"]], ["b_rascal", .72, ["pe_eastwood"]], ["b_ox", .6, ["pe_eastwood"]]],
    movie: [["m_unforgiven", .94, ["pe_eastwood"]], ["m_gbu", .92, ["pe_eastwood"]], ["m_gran", .85, ["pe_eastwood"]], ["m_josey", .84, ["pe_eastwood"]], ["m_walk", .8, ["cash"]], ["m_field", .78, ["br_dodgers"]], ["m_bull", .72, ["br_dodgers"]], ["m_river", .7, ["haggard"]]],
    tv_show: [["t_gunsmoke", .9, ["pe_eastwood"]], ["t_rawhide", .88, ["pe_eastwood"]], ["t_bonanza", .82, ["haggard"]], ["t_hee", .75, ["haggard", "cash"]]],
    podcast: [["p_scully", .93, ["br_dodgers"]], ["p_opry", .84, ["haggard", "cash"]], ["p_fishing", .75, ["haggard"]]],
    brand: [["br_stetson", .86, ["pe_eastwood", "haggard"]], ["br_wrangler", .8, ["haggard"]], ["br_shimano", .7, ["haggard"]]],
    tag: [["country", .96], ["outlaw", .92], ["western", .9], ["kwnostalgia", .84], ["baseball", .8], ["hobbyfish", .78], ["kwroad", .74], ["styleraw", .7], ["stylewarm", .66], ["kwsmalltown", .6]],
    age: { "24_and_younger": -.31, "25_to_29": -.22, "30_to_34": -.12, "35_to_44": .05, "45_to_54": .24, "55_and_older": .41 }, male: .26,
  },
  dana: {
    signals: ["bowie", "smith", "br_ghibli", "pe_leguin", "t_xfiles"],
    artist: [["bowie", .97, ["bowie", "smith"]], ["smith", .95, ["bowie", "smith"]], ["reed", .9, ["bowie", "smith"]], ["talking", .87, ["bowie", "smith"]], ["eno", .85, ["bowie"]], ["kate", .82, ["bowie"]], ["joni", .8, ["smith"]], ["cure", .78, ["bowie"]], ["hisaishi", .72, ["br_ghibli"]]],
    book: [["b_lefthand", .94, ["pe_leguin"]], ["b_dispossessed", .92, ["pe_leguin"]], ["b_justkids", .9, ["smith", "bowie"]], ["b_wizard", .88, ["pe_leguin", "br_ghibli"]], ["b_dick", .84, ["t_xfiles"]], ["b_gaiman", .78, ["br_ghibli"]]],
    movie: [["m_spirited", .95, ["br_ghibli"]], ["m_totoro", .93, ["br_ghibli"]], ["m_kiki", .88, ["br_ghibli"]], ["m_bladerunner", .86, ["t_xfiles", "bowie"]], ["m_labyrinth", .84, ["bowie"]], ["m_pinball", .7, ["bowie", "smith"]]],
    tv_show: [["t_xfiles", .96, ["t_xfiles"]], ["t_twin", .9, ["t_xfiles"]], ["t_tz", .86, ["t_xfiles"]], ["t_portlandia", .74, ["smith"]]],
    podcast: [["p_ghibli", .85, ["br_ghibli"]], ["p_bowie", .82, ["bowie"]]],
    brand: [["br_powells", .88, ["pe_leguin", "smith"]], ["br_fender", .76, ["bowie"]], ["br_polaroid", .7, ["smith"]]],
    tag: [["artrock", .96], ["scifi", .93], ["punk", .9], ["styledreamy", .86], ["anime", .84], ["fantasy", .8], ["kwoutsider", .78], ["poetry", .74], ["hobbyrecords", .7], ["hobbypinball", .64]],
    age: { "24_and_younger": -.08, "25_to_29": .02, "30_to_34": .12, "35_to_44": .26, "45_to_54": .3, "55_and_older": .1 }, male: .08,
  },
  roz: {
    signals: ["mahalia", "aretha", "dolly", "t_andy", "pe_angelou"],
    artist: [["mahalia", .97, ["mahalia", "aretha"]], ["aretha", .96, ["mahalia", "aretha"]], ["dolly", .94, ["dolly"]], ["sam", .9, ["aretha", "mahalia"]], ["staples", .88, ["mahalia", "aretha"]], ["rosetta", .86, ["mahalia"]], ["clark", .84, ["aretha"]], ["otis", .8, ["aretha"]], ["patsy", .76, ["dolly"]]],
    book: [["b_cage", .96, ["pe_angelou"]], ["b_stillirise", .93, ["pe_angelou"]], ["b_color", .9, ["pe_angelou", "aretha"]], ["b_their", .85, ["pe_angelou"]], ["b_mocking", .82, ["t_andy"]], ["b_gilead", .74, ["mahalia"]]],
    movie: [["m_colorp", .9, ["pe_angelou", "aretha"]], ["m_steel", .86, ["dolly", "t_andy"]], ["m_mocking", .84, ["t_andy"]], ["m_g1", .8, ["t_andy"]], ["m_walk", .5, ["dolly"]]],
    tv_show: [["t_andy", .97, ["t_andy"]], ["t_mayberry", .9, ["t_andy"]], ["t_beverly", .85, ["t_andy", "dolly"]], ["t_golden", .8, ["dolly"]], ["t_lawrence", .72, ["mahalia"]]],
    podcast: [["p_gospel", .9, ["mahalia"]], ["p_gardening", .82, ["dolly"]]],
    brand: [["br_burpee", .86, ["dolly"]], ["br_bible", .82, ["mahalia"]], ["br_gen", .6, ["dolly"]]],
    tag: [["gospel", .97], ["soul", .94], ["kwfaith", .9], ["stylewarm", .88], ["kwsmalltown", .84], ["country", .8], ["sitcom", .78], ["poetry", .74], ["memoir", .7], ["hobbygarden", .66]],
    age: { "24_and_younger": -.38, "25_to_29": -.3, "30_to_34": -.2, "35_to_44": -.04, "45_to_54": .22, "55_and_older": .52 }, male: -.2,
  },
};
const generic = {
  artist: ["cash", "nelson", "aretha", "joni", "sam", "dolly", "otis", "talking"],
  book: ["b_gen1", "b_gen2", "b_mocking", "b_gen3", "b_gen4", "b_gen5", "b_gen6"],
  movie: ["m_g1", "m_g3", "m_g4", "m_g5", "m_g2", "m_totoro"],
  tv_show: ["t_gen1", "t_gen2", "t_gen3", "t_gen4"],
  podcast: ["p_gen", "p_gen2"],
  brand: ["br_gen", "br_gen2", "br_polaroid"],
};

const insights: Record<string, unknown> = {};
const sig = (type: string, keys: string[]) => `insights:urn:entity:${type}:${keys.map(id).sort().join(",")}`;
const expl = (because: string[]) => because.map((b, i) => ({ entity_id: id(b), contribution: +(0.6 - i * 0.2).toFixed(2) }));
const entRow = (k: string, aff: number, because: string[]) => ({
  ...toSearch(ENT[k]), subtype: ENT[k].type, query: { affinity: aff, explainability: expl(because) },
});
for (const [pn, p] of Object.entries(lists)) {
  const keys = p.signals;
  for (const type of ["artist", "book", "movie", "tv_show", "podcast", "brand"] as const) {
    const rows = (p as any)[type] as [string, number, string[]][];
    insights[sig(type, keys)] = { entities: rows.map(([k, a, b]) => entRow(k, a, b)) };
  }
  insights[`insights:urn:tag:${keys.map(id).sort().join(",")}`] = {
    tags: (p.tag as [string, number][]).map(([k, a]) => ({ tag_id: T[k].id, name: T[k].name, subtype: T[k].type, types: [T[k].type], query: { affinity: a } })),
  };
  insights[`insights:urn:demographics:${keys.map(id).sort().join(",")}`] = {
    demographics: keys.map((k, i) => ({ entity_id: id(k), query: { age: p.age, gender: { male: +(p.male + (i % 2 ? 0.02 : -0.02)).toFixed(2), female: +(-p.male).toFixed(2) } } })),
  };
}
for (const type of Object.keys(generic) as (keyof typeof generic)[]) {
  insights[`insights:urn:entity:${type}:*`] = {
    entities: generic[type].map((k, i) => entRow(k, +(0.9 - i * 0.05).toFixed(2), [])).map((r) => ({ ...r, query: { affinity: r.query.affinity } })),
  };
}
insights["insights:urn:tag:*"] = { tags: ["kwnostalgia", "stylewarm", "kwsmalltown", "folk", "memoir"].map((k, i) => ({ tag_id: T[k].id, name: T[k].name, subtype: T[k].type, types: [T[k].type], query: { affinity: +(0.85 - i * 0.07).toFixed(2) } })) };
insights["insights:urn:demographics:*"] = { demographics: [{ entity_id: "*", query: { age: { "24_and_younger": -.1, "25_to_29": -.05, "30_to_34": 0, "35_to_44": .08, "45_to_54": .15, "55_and_older": .2 }, gender: { male: .02, female: -.02 } } }] };

// ---- places: fictional businesses, per demo city plus a generic bucket ----
type P = [key: string, name: string, tg: string[], aff: number, rating: number, price: number, street: string, lat: number, lng: number];
const placeSets: Record<string, { city: string; state: string; rows: P[] }> = {
  bakersfield: { city: "Bakersfield", state: "CA", rows: [
    ["bk1", "Rosa's Taqueria", ["mexican", "restaurant", "catering"], .93, 4.6, 2, "1420 Chester Ave", 35.3792, -119.0188],
    ["bk2", "Casa Del Sol Catering", ["mexican", "catering"], .9, 4.4, 2, "2210 Union Ave", 35.3601, -119.0150],
    ["bk3", "Dusty Boots Diner", ["diner", "restaurant"], .86, 4.3, 1, "905 Kern St", 35.3680, -119.0201],
    ["bk4", "Lupe's Carnitas and Grill", ["mexican", "restaurant"], .84, 4.1, 1, "3300 Panama Ln", 35.3480, -119.0020],
    ["bk5", "Gold Rail Steakhouse", ["restaurant", "catering"], .72, 4.5, 3, "700 Truxtun Ave", 35.3745, -119.0210],
    ["bk6", "Stone Table Smokehouse", ["bbq", "catering"], .8, 3.2, 2, "88 Mill Rock Rd", 35.3900, -119.0400],
    ["bv1", "Hillcrest Community Hall", ["community", "venue"], .91, 4.4, 1, "1200 Hillcrest Dr", 35.3912, -119.0334],
    ["bv2", "Kern River Pavilion", ["park", "venue"], .88, 4.5, 1, "4000 Truxtun Ave", 35.3830, -119.0600],
    ["bv3", "Oak Grove Banquet Hall", ["banquet", "venue"], .86, 4.2, 2, "515 Oak St", 35.3765, -119.0190],
    ["bv4", "The Silver Spur Saloon", ["bar", "venue"], .93, 4.0, 2, "2900 Chester Ave", 35.3730, -119.0160],
    ["bv5", "Ridgeview Lookout Terrace", ["rooftop", "trail", "venue"], .84, 4.6, 3, "9 Ridgeview Rd", 35.4200, -119.0100],
    ["bv6", "Starlite Room", ["nightclub", "venue"], .78, 3.9, 3, "1850 19th St", 35.3770, -119.0180],
  ] },
  portland: { city: "Portland", state: "OR", rows: [
    ["pd1", "Basil and Ginger Thai Kitchen", ["thai", "restaurant", "catering"], .94, 4.7, 2, "3120 SE Division St", 45.5049, -122.6317],
    ["pd2", "Lotus Noodle House", ["thai", "restaurant"], .9, 4.5, 2, "815 NW 21st Ave", 45.5282, -122.6960],
    ["pd3", "Green Door Catering Co.", ["catering", "thai"], .86, 4.4, 3, "520 N Killingsworth St", 45.5622, -122.6720],
    ["pd4", "Rainy Day Coffee and Records", ["coffee", "recordshop"], .82, 4.6, 1, "1411 NE Alberta St", 45.5589, -122.6500],
    ["pd5", "Cedar Pot Dumplings", ["restaurant"], .78, 4.2, 1, "77 SW Morrison St", 45.5175, -122.6720],
    ["pv1", "Flipside Pinball Lounge", ["arcade", "bar", "venue"], .95, 4.5, 2, "2200 SE Hawthorne Blvd", 45.5121, -122.6430],
    ["pv2", "Mossgate Brewpub", ["brewery", "bar", "venue"], .9, 4.4, 2, "630 N Russell St", 45.5410, -122.6710],
    ["pv3", "Willow Park Pavilion", ["park", "venue"], .88, 4.6, 1, "40 Willow Park Way", 45.5320, -122.6500],
    ["pv4", "Alder Street Event Loft", ["venue", "rooftop"], .86, 4.5, 3, "1020 SW Alder St", 45.5200, -122.6830],
    ["pv5", "Northside Community Hall", ["community", "venue"], .82, 4.3, 1, "9 N Bryant Ave", 45.5600, -122.6620],
  ] },
  birmingham: { city: "Birmingham", state: "AL", rows: [
    ["bh1", "Miss Odessa's Kitchen", ["southern", "restaurant", "catering"], .95, 4.7, 1, "2040 5th Ave N", 33.5230, -86.8100],
    ["bh2", "Magnolia Table Catering", ["southern", "catering"], .92, 4.5, 2, "310 Highland Ave", 33.5010, -86.7930],
    ["bh3", "Golden Skillet Fish House", ["southern", "restaurant"], .9, 4.3, 1, "1730 Morris Ave", 33.5160, -86.8030],
    ["bh4", "Belle Meade Fine Catering", ["southern", "catering"], .8, 4.8, 3, "55 Mountain Brook Pkwy", 33.4900, -86.7600],
    ["bh5", "Sunday Plate Cafe", ["southern", "diner"], .84, 3.1, 1, "17 Valley Rd", 33.5400, -86.8300],
    ["bv1", "Greater Hope Fellowship Hall", ["churchhall", "community", "venue"], .94, 4.6, 1, "1800 Dr Martin Luther King Jr Dr", 33.5350, -86.8120],
    ["bv2", "Magnolia Park Community Center", ["community", "venue"], .9, 4.4, 1, "600 Magnolia Park Ln", 33.5100, -86.8000],
    ["bv3", "Red Mountain Brewing Taproom", ["brewery", "bar", "venue"], .96, 4.5, 2, "230 Red Mountain Expy", 33.4950, -86.7950],
    ["bv4", "Vestavia Garden Pavilion", ["park", "venue"], .86, 4.7, 2, "3 Garden Way", 33.4600, -86.7800],
    ["bv5", "The Skyline Rooftop", ["rooftop", "bar", "venue"], .82, 4.3, 3, "100 20th St N", 33.5170, -86.8100],
  ] },
};
const placeOut: Record<string, unknown[]> = {};
const placeRow = (s: { city: string; state: string }, p: P) => {
  const [key, name, tgs, aff, rating, price, street, lat, lng] = p;
  return {
    name, entity_id: id(`place:${s.city}:${key}`), types: ["urn:entity:place"], popularity: +(0.3 + aff * 0.4).toFixed(2),
    subtype: "urn:entity:place",
    properties: {
      address: `${street}, ${s.city}, ${s.state}`, geocode: { latitude: lat, longitude: lng, city: s.city },
      business_rating: rating, price_level: price, phone: `+1-555-01${String(Math.floor(rnd() * 90) + 10)}`,
      website: `https://example.invalid/${key}`,
    },
    tags: tags(...tgs), query: { affinity: aff },
  };
};
for (const [ck, s] of Object.entries(placeSets)) placeOut[ck] = s.rows.map((r) => placeRow(s, r));
// generic bucket: "{CITY}" is replaced by the mock at read time
const gen = { city: "{CITY}", state: "US" };
placeOut["*"] = ([
  ["g1", "Maple Street Kitchen", ["restaurant", "catering", "diner"], .85, 4.4, 2, "120 Maple St", 40, -90],
  ["g2", "Harvest Table Catering", ["catering"], .82, 4.5, 2, "44 Main St", 40, -90],
  ["g3", "Corner Cafe", ["diner", "restaurant"], .78, 4.2, 1, "9 Elm St", 40, -90],
  ["g4", "Riverside Community Hall", ["community", "venue"], .88, 4.4, 1, "300 River Rd", 40, -90],
  ["g5", "Town Park Pavilion", ["park", "venue"], .84, 4.5, 1, "1 Park Ln", 40, -90],
  ["g6", "Grand Hall Events", ["banquet", "venue"], .8, 4.3, 3, "75 Grand Ave", 40, -90],
  ["g7", "Hilltop Tap House", ["bar", "brewery", "venue"], .76, 4.1, 2, "12 Hill St", 40, -90],
] as P[]).map((r) => placeRow(gen, r));

const out = (f: string, data: unknown) => fs.writeFileSync(path.join("fixtures/qloo", f), JSON.stringify(data, null, 1) + "\n");
const registry: Record<string, unknown> = {};
for (const e of Object.values(ENT)) registry[id(e.key)] = toSearch(e);
out("search.json", search);
out("tags.json", tagsFx);
out("insights.json", insights);
out("places.json", placeOut);
out("entities.json", registry);
console.log("fixtures written", Object.keys(insights).length, "insight keys");
