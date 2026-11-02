#!/usr/bin/env node
/*
  Collecte des actualités de Vigie.
  Lit les flux RSS de la presse, classe chaque titre par pays et écrit un seul fichier JSON que le site lit ensuite.
  Seuls le titre, le nom du média, la date et le lien vers l'article d'origine sont conservés.
  Aucune dépendance : Node.js suffit.

  Utilisation : node scripts/collecter-actus.mjs anciens.json actus.json

  Pour ajouter un média : ajoute une ligne dans FLUX.
    origine : pays d'édition (code à deux lettres), AF pour un média panafricain, INT pour un média international
    langue  : fr ou en
    pays    : à renseigner si tous les articles du flux concernent ce pays
*/
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const AGENT = "VigieBot/1.0 (+https://github.com/farabougou/vigie)";
const DELAI_MS = 20000;
const APPELS_SIMULTANES = 8;
const PAR_FLUX = 40;
const RETENTION_JOURS = 14;
const TOTAL_MAX = 1500;
const MINIMUM_PAR_PAYS = 30;

const f = (nom, url, origine, langue, pays) => ({ nom, url, origine, langue, pays });

export const FLUX = [
  // Mali
  f("Maliweb", "https://www.maliweb.net/feed", "ML", "fr", "ML"),
  f("Bamada.net", "https://bamada.net/feed", "ML", "fr", "ML"),
  f("Studio Tamani", "https://www.studiotamani.org/feed", "ML", "fr", "ML"),
  f("Journal du Mali", "https://www.journaldumali.com/feed/", "ML", "fr", "ML"),
  f("Maliactu", "https://maliactu.net/feed/", "ML", "fr", "ML"),
  f("Malijet", "https://malijet.com/feed", "ML", "fr", "ML"),
  f("L'Essor", "https://www.essor.ml/feed/", "ML", "fr", "ML"),
  f("Mali24", "https://mali24.info/feed/", "ML", "fr", "ML"),
  f("aBamako", "https://news.abamako.com/rss/", "ML", "fr", "ML"),
  f("allAfrica Mali", "https://fr.allafrica.com/tools/headlines/rdf/mali/headlines.rdf", "AF", "fr", "ML"),

  // Afrique de l'Ouest
  f("Agence de presse sénégalaise", "https://aps.sn/feed/", "SN", "fr", "SN"),
  f("Seneweb", "https://www.seneweb.com/feed/", "SN", "fr", "SN"),
  f("Dakaractu", "https://www.dakaractu.com/xml/syndication.rss", "SN", "fr", "SN"),
  f("LeFaso.net", "https://lefaso.net/spip.php?page=backend", "BF", "fr", "BF"),
  f("Burkina 24", "https://burkina24.com/feed/", "BF", "fr", "BF"),
  f("Fraternité Matin", "https://www.fratmat.info/feed", "CI", "fr", "CI"),
  f("ActuNiger", "https://www.actuniger.com/?format=feed&type=rss", "NE", "fr", "NE"),
  f("Guineenews", "https://guineenews.org/feed/", "GN", "fr", "GN"),
  f("Mediaguinee", "https://mediaguinee.com/feed/", "GN", "fr", "GN"),
  f("Togo First", "https://www.togofirst.com/fr/rss", "TG", "fr", "TG"),
  f("La Nouvelle Tribune", "https://lanouvelletribune.info/feed/", "BJ", "fr", "BJ"),
  f("Premium Times", "https://www.premiumtimesng.com/feed", "NG", "en", "NG"),
  f("Punch", "https://punchng.com/feed/", "NG", "en", "NG"),
  f("MyJoyOnline", "https://www.myjoyonline.com/feed/", "GH", "en", "GH"),

  // Reste de l'Afrique
  f("Journal du Cameroun", "https://www.journalducameroun.com/feed/", "CM", "fr", "CM"),
  f("Actu Cameroun", "https://actucameroun.com/feed/", "CM", "fr", "CM"),
  f("Actualite.cd", "https://actualite.cd/rss.xml", "CD", "fr", "CD"),
  f("Radio Okapi", "https://www.radiookapi.net/rss.xml", "CD", "fr", "CD"),
  f("TSA Algérie", "https://www.tsa-algerie.com/feed/", "DZ", "fr", "DZ"),
  f("Kapitalis", "https://kapitalis.com/tunisie/feed/", "TN", "fr", "TN"),
  f("Le Matin", "https://lematin.ma/rss", "MA", "fr", "MA"),
  f("Daily Maverick", "https://www.dailymaverick.co.za/dmrss/", "ZA", "en", "ZA"),
  f("Addis Standard", "https://addisstandard.com/feed/", "ET", "en", "ET"),

  // Médias panafricains
  f("Jeune Afrique", "https://www.jeuneafrique.com/feed/", "AF", "fr"),
  f("Africanews", "https://fr.africanews.com/feed/rss", "AF", "fr"),
  f("Agence Ecofin", "https://www.agenceecofin.com/rss", "AF", "fr"),
  f("APA News", "https://apanews.net/feed/", "AF", "fr"),
  f("Sahel Intelligence", "https://sahel-intelligence.com/feed", "AF", "fr"),
  f("allAfrica", "https://fr.allafrica.com/tools/headlines/rdf/latest/headlines.rdf", "AF", "fr"),

  // Médias internationaux, rubriques Afrique
  f("RFI Afrique", "https://www.rfi.fr/fr/afrique/rss", "INT", "fr"),
  f("France 24 Afrique", "https://www.france24.com/fr/afrique/rss", "INT", "fr"),
  f("Le Monde Afrique", "https://www.lemonde.fr/afrique/rss_full.xml", "INT", "fr"),
  f("BBC Afrique", "https://feeds.bbci.co.uk/afrique/rss.xml", "INT", "fr"),
  f("DW Afrique", "https://rss.dw.com/rdf/rss-fr-afr", "INT", "fr"),
  f("ONU Info Afrique", "https://news.un.org/feed/subscribe/fr/news/region/africa/feed/rss.xml", "INT", "fr"),
  f("BBC Africa", "https://feeds.bbci.co.uk/news/world/africa/rss.xml", "INT", "en"),

  // Monde
  f("RFI", "https://www.rfi.fr/fr/rss", "INT", "fr"),
  f("France 24", "https://www.france24.com/fr/rss", "INT", "fr"),
  f("Le Monde", "https://www.lemonde.fr/rss/une.xml", "INT", "fr"),
  f("ONU Info", "https://news.un.org/feed/subscribe/fr/news/all/rss.xml", "INT", "fr"),
  f("BBC World", "https://feeds.bbci.co.uk/news/world/rss.xml", "INT", "en"),
  f("Al Jazeera", "https://www.aljazeera.com/xml/rss/all.xml", "INT", "en"),
];

/* Mots qui désignent chaque pays africain, en français et en anglais. */
const MOTS_PAYS = {
  ML: ["Mali", "malien", "malienne", "maliens", "maliennes", "Bamako", "Tombouctou", "Timbuktu", "Gao", "Kidal", "Ségou", "Segou", "Mopti", "Sikasso", "Kayes", "Ménaka", "Menaka", "Koulikoro"],
  SN: ["Sénégal", "Senegal", "sénégalais", "sénégalaise", "sénégalaises", "Senegalese", "Dakar", "Saint-Louis du Sénégal", "Ziguinchor", "Touba"],
  BF: ["Burkina", "Burkina Faso", "burkinabè", "burkinabé", "burkinabe", "Ouagadougou", "Bobo-Dioulasso"],
  CI: ["Côte d'Ivoire", "Côte d’Ivoire", "Cote d'Ivoire", "Ivory Coast", "ivoirien", "ivoirienne", "ivoiriens", "ivoiriennes", "Ivorian", "Abidjan", "Yamoussoukro"],
  NE: ["Niger", "nigérien", "nigérienne", "nigériens", "nigériennes", "Niamey", "Agadez", "Zinder"],
  NG: ["Nigeria", "Nigéria", "nigérian", "nigériane", "nigérians", "nigérianes", "nigerian", "Abuja", "Lagos", "Kano", "Maiduguri"],
  GN: ["Guinée", "Guinea", "guinéen", "guinéenne", "guinéens", "guinéennes", "Guinean", "Conakry"],
  GW: [],
  GQ: [],
  MR: ["Mauritanie", "Mauritania", "mauritanien", "mauritanienne", "mauritaniens", "Mauritanian", "Nouakchott"],
  GM: ["Gambie", "Gambia", "gambien", "gambienne", "Gambian", "Banjul"],
  SL: ["Sierra Leone", "sierra-léonais", "Freetown"],
  LR: ["Liberia", "Libéria", "libérien", "libérienne", "Liberian", "Monrovia"],
  GH: ["Ghana", "ghanéen", "ghanéenne", "Ghanaian", "Accra", "Kumasi"],
  TG: ["Togo", "togolais", "togolaise", "Togolese", "Lomé"],
  BJ: ["Bénin", "Benin", "béninois", "béninoise", "Beninese", "Cotonou", "Porto-Novo"],
  CV: ["Cap-Vert", "Cabo Verde", "Cape Verde", "capverdien", "capverdienne", "Praia"],
  DZ: ["Algérie", "Algeria", "algérien", "algérienne", "algériens", "algériennes", "Algerian", "Alger", "Algiers", "Oran"],
  MA: ["Maroc", "Morocco", "marocain", "marocaine", "marocains", "marocaines", "Moroccan", "Rabat", "Casablanca", "Marrakech"],
  TN: ["Tunisie", "Tunisia", "tunisien", "tunisienne", "tunisiens", "tunisiennes", "Tunisian", "Tunis", "Sfax"],
  LY: ["Libye", "Libya", "libyen", "libyenne", "libyens", "Libyan", "Tripoli", "Benghazi"],
  EG: ["Égypte", "Egypte", "Egypt", "égyptien", "égyptienne", "égyptiens", "Egyptian", "Le Caire", "Cairo", "Alexandrie"],
  SD: ["Soudan", "Sudan", "soudanais", "soudanaise", "Sudanese", "Khartoum", "Darfour", "Darfur", "El-Fasher", "El Fasher"],
  SS: [],
  TD: ["Tchad", "Chad", "tchadien", "tchadienne", "tchadiens", "Chadian", "N'Djamena", "N’Djamena", "Ndjamena"],
  ET: ["Éthiopie", "Ethiopie", "Ethiopia", "éthiopien", "éthiopienne", "Ethiopian", "Addis-Abeba", "Addis Ababa", "Tigré", "Tigray", "Amhara"],
  ER: ["Érythrée", "Erythrée", "Eritrea", "érythréen", "Eritrean", "Asmara"],
  DJ: ["Djibouti", "djiboutien", "djiboutienne"],
  SO: ["Somalie", "Somalia", "somalien", "somalienne", "Somali", "Mogadiscio", "Mogadishu", "Somaliland"],
  KE: ["Kenya", "kényan", "kényane", "kenyan", "Nairobi", "Mombasa"],
  UG: ["Ouganda", "Uganda", "ougandais", "ougandaise", "Ugandan", "Kampala"],
  TZ: ["Tanzanie", "Tanzania", "tanzanien", "tanzanienne", "Tanzanian", "Dodoma", "Dar es Salaam", "Zanzibar"],
  RW: ["Rwanda", "rwandais", "rwandaise", "Rwandan", "Kigali"],
  BI: ["Burundi", "burundais", "burundaise", "Burundian", "Bujumbura", "Gitega"],
  CD: ["RDC", "RD Congo", "DR Congo", "DRC", "République démocratique du Congo", "Democratic Republic of the Congo", "Congo", "congolais", "congolaise", "Congolese", "Kinshasa", "Goma", "Bukavu", "Kivu", "Lubumbashi", "Kisangani", "M23"],
  CG: [],
  CM: ["Cameroun", "Cameroon", "camerounais", "camerounaise", "Cameroonian", "Yaoundé", "Douala"],
  CF: ["Centrafrique", "République centrafricaine", "Central African Republic", "centrafricain", "centrafricaine", "Bangui"],
  GA: ["Gabon", "gabonais", "gabonaise", "Gabonese", "Libreville"],
  ST: ["Sao Tomé", "São Tomé", "Sao Tome"],
  AO: ["Angola", "angolais", "angolaise", "Angolan", "Luanda"],
  ZM: ["Zambie", "Zambia", "zambien", "zambienne", "Zambian", "Lusaka"],
  ZW: ["Zimbabwe", "zimbabwéen", "zimbabwéenne", "Zimbabwean", "Harare"],
  MW: ["Malawi", "malawien", "malawienne", "Malawian", "Lilongwe"],
  MZ: ["Mozambique", "mozambicain", "mozambicaine", "Mozambican", "Maputo", "Cabo Delgado"],
  ZA: ["Afrique du Sud", "South Africa", "sud-africain", "sud-africaine", "sud-africains", "South African", "Pretoria", "Johannesburg", "Le Cap", "Cape Town", "Durban"],
  NA: ["Namibie", "Namibia", "namibien", "namibienne", "Namibian", "Windhoek"],
  BW: ["Botswana", "botswanais", "Gaborone"],
  LS: ["Lesotho", "Maseru"],
  SZ: ["Eswatini", "Swaziland", "Mbabane"],
  MG: ["Madagascar", "malgache", "malgaches", "Malagasy", "Antananarivo", "Tananarive"],
  MU: ["île Maurice", "Mauritius", "mauricien", "mauricienne", "Mauritian", "Port-Louis"],
  KM: ["Comores", "Comoros", "comorien", "comorienne", "Moroni"],
  SC: ["Seychelles", "seychellois"],
  EH: ["Sahara occidental", "Western Sahara", "Laâyoune"],
};

/* Noms composés traités d'abord, puis retirés du texte : « Guinée-Bissau » ne doit pas compter pour la Guinée. */
const NOMS_COMPOSES = [
  { motif: /(?<![\p{L}\p{N}])(?:Guin[ée]e[- ]Bissau|Guinea[- ]Bissau|bissau-guin[ée]en\p{L}*|Bissau)(?![\p{L}\p{N}])/giu, pays: "GW" },
  { motif: /(?<![\p{L}\p{N}])(?:Guin[ée]e [ée]quatoriale|Equatorial Guinea|[ée]quato-guin[ée]en\p{L}*|Malabo)(?![\p{L}\p{N}])/giu, pays: "GQ" },
  { motif: /(?<![\p{L}\p{N}])(?:Papouasie[- ]Nouvelle[- ]Guin[ée]e|Papua New Guinea|Nouvelle[- ]Guin[ée]e|New Guinea)(?![\p{L}\p{N}])/giu, pays: null },
  { motif: /(?<![\p{L}\p{N}])(?:Soudan du Sud|South Sudan|sud[- ]soudanais\p{L}*|South Sudanese|Juba)(?![\p{L}\p{N}])/giu, pays: "SS" },
  { motif: /(?<![\p{L}\p{N}])(?:Congo[- ]Brazzaville|R[ée]publique du Congo|Republic of the Congo|Brazzaville)(?![\p{L}\p{N}])/giu, pays: "CG" },
  { motif: /(?<![\p{L}\p{N}])(?:fleuve Niger|delta du Niger|Niger Delta|Niger River|Niger State|Niger-Delta)(?![\p{L}\p{N}])/giu, pays: null },
  { motif: /(?<![\p{L}\p{N}])(?:Afrique de l['’]Ouest|West Africa)(?![\p{L}\p{N}])/giu, pays: null },
];

const echapper = (mot) => mot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const MOTIFS_PAYS = Object.entries(MOTS_PAYS)
  .filter(([, mots]) => mots.length)
  .map(([code, mots]) => [code, new RegExp(`(?<![\\p{L}\\p{N}])(?:${[...mots].sort((a, b) => b.length - a.length).map(echapper).join("|")})(?![\\p{L}\\p{N}])`, "iu")]);

/* Trouve les pays africains cités dans un texte. */
export function paysDans(texte) {
  const trouves = new Set();
  let reste = texte;
  for (const { motif, pays } of NOMS_COMPOSES) {
    reste = reste.replace(motif, () => {
      if (pays) trouves.add(pays);
      return " ";
    });
  }
  for (const [code, motif] of MOTIFS_PAYS) {
    if (motif.test(reste)) trouves.add(code);
  }
  return [...trouves];
}

const ENTITES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", laquo: "«", raquo: "»", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", hellip: "…", ndash: "–", mdash: "—", eacute: "é", egrave: "è", ecirc: "ê", agrave: "à", acirc: "â", ccedil: "ç", ocirc: "ô", ucirc: "û", icirc: "î", iuml: "ï", ugrave: "ù", Eacute: "É", oelig: "œ" };

function decoderEntites(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (tout, e) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : " ";
    }
    return ENTITES[e] ?? tout;
  });
}

/* Texte brut : retire CDATA, entités et balises, y compris celles qui étaient encodées. */
export function texteBrut(s) {
  if (!s) return "";
  const sansCdata = s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  return decoderEntites(decoderEntites(sansCdata).replace(/<[^>]*>/g, " ")).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function champ(bloc, noms) {
  for (const nom of noms) {
    const m = new RegExp(`<${nom}(?:\\s[^>]*)?>([\\s\\S]*?)</${nom}>`, "i").exec(bloc);
    if (m && m[1].trim()) return m[1];
  }
  return "";
}

function lienDe(bloc) {
  const simple = texteBrut(champ(bloc, ["link"]));
  if (/^https?:\/\//i.test(simple)) return simple;
  const atom = [...bloc.matchAll(/<link\b([^>]*?)\/?>/gi)].map((m) => m[1]);
  const prefere = atom.find((a) => /rel=["']alternate["']/i.test(a)) || atom.find((a) => !/rel=/i.test(a));
  const href = prefere && /href=["']([^"']+)["']/i.exec(prefere);
  if (href) return decoderEntites(href[1]);
  const guid = texteBrut(champ(bloc, ["guid"]));
  return /^https?:\/\//i.test(guid) ? guid : "";
}

/* Lit un flux RSS 2.0, RDF ou Atom. */
export function lireFlux(xml) {
  const articles = [];
  for (const m of xml.matchAll(/<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi)) {
    const bloc = m[2];
    const titre = texteBrut(champ(bloc, ["title"]));
    const lien = lienDe(bloc);
    if (!titre || !/^https?:\/\//i.test(lien)) continue;
    const date = Date.parse(texteBrut(champ(bloc, ["pubDate", "dc:date", "published", "updated"])));
    const resume = texteBrut(champ(bloc, ["description", "summary", "content:encoded", "content"])).slice(0, 400);
    articles.push({ titre: titre.slice(0, 300), lien, date: Number.isFinite(date) ? date : null, resume });
  }
  return articles;
}

/* Décode le flux selon son encodage déclaré : certains sites africains restent en ISO-8859-1. */
function decoderOctets(octets, entete) {
  const debut = new TextDecoder("latin1").decode(octets.slice(0, 200));
  const declare = /encoding=["']([\w-]+)["']/i.exec(debut)?.[1] || /charset=([\w-]+)/i.exec(entete || "")?.[1] || "utf-8";
  try {
    return new TextDecoder(declare).decode(octets);
  } catch {
    return new TextDecoder("utf-8").decode(octets);
  }
}

async function lireUnFlux(flux) {
  const ctrl = new AbortController();
  const minuteur = setTimeout(() => ctrl.abort(), DELAI_MS);
  try {
    const rep = await fetch(flux.url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "user-agent": AGENT, accept: "application/rss+xml, application/rdf+xml, application/atom+xml, application/xml, text/xml, */*" },
    });
    if (!rep.ok) throw new Error("HTTP " + rep.status);
    const texte = decoderOctets(new Uint8Array(await rep.arrayBuffer()), rep.headers.get("content-type"));
    const articles = lireFlux(texte).slice(0, PAR_FLUX);
    if (!articles.length) throw new Error("aucun article lisible");
    return { articles };
  } finally {
    clearTimeout(minuteur);
  }
}

async function enParallele(elements, fonction, limite) {
  const resultats = new Array(elements.length);
  let suivant = 0;
  await Promise.all(Array.from({ length: limite }, async () => {
    while (suivant < elements.length) {
      const i = suivant++;
      resultats[i] = await fonction(elements[i]);
    }
  }));
  return resultats;
}

const cleTitre = (t) => t.toLowerCase().normalize("NFD").replace(/[^\p{L}\p{N}]+/gu, "");

/* Assemble anciens et nouveaux articles : pas de doublon, rien de trop vieux, et chaque pays garde son minimum. */
export function assembler(anciens, nouveaux, maintenant = Date.now()) {
  const limite = maintenant - RETENTION_JOURS * 864e5;
  const parLien = new Map();
  const anciensParLien = new Map(anciens.map((a) => [a.u, a]));
  for (const n of nouveaux) {
    const connu = anciensParLien.get(n.u);
    const date = Math.min(n.d ?? connu?.d ?? maintenant, maintenant);
    parLien.set(n.u, { ...n, d: date });
  }
  for (const a of anciens) if (!parLien.has(a.u)) parLien.set(a.u, a);
  const tries = [...parLien.values()].filter((a) => a.d >= limite).sort((a, b) => b.d - a.d);
  const parTitre = new Map();
  for (const a of tries) {
    const cle = cleTitre(a.t);
    const deja = parTitre.get(cle);
    if (!deja) parTitre.set(cle, a);
    else deja.p = [...new Set([...deja.p, ...a.p])];
  }
  const uniques = [...parTitre.values()];
  const gardes = new Set(uniques.slice(0, TOTAL_MAX));
  const compte = new Map();
  for (const a of uniques) {
    for (const code of a.p) {
      const n = compte.get(code) || 0;
      if (n < MINIMUM_PAR_PAYS) gardes.add(a);
      compte.set(code, n + 1);
    }
  }
  return uniques.filter((a) => gardes.has(a));
}

async function principal() {
  const [cheminAnciens = "anciens.json", cheminSortie = "actus.json"] = process.argv.slice(2);
  let anciens = [];
  try {
    anciens = JSON.parse(await readFile(cheminAnciens, "utf8")).articles || [];
  } catch { /* première collecte */ }

  const etats = await enParallele(FLUX, async (flux) => {
    try {
      return { flux, ...(await lireUnFlux(flux)) };
    } catch (e) {
      return { flux, erreur: e.name === "AbortError" ? "délai dépassé" : String(e.message || e).slice(0, 100), articles: [] };
    }
  }, APPELS_SIMULTANES);

  const nouveaux = [];
  for (const { flux, articles } of etats) {
    for (const a of articles) {
      const p = new Set(paysDans(`${a.titre} ${a.resume}`));
      if (flux.pays) p.add(flux.pays);
      nouveaux.push({ t: a.titre, u: a.lien, m: flux.nom, d: a.date, l: flux.langue, o: flux.origine, p: [...p] });
    }
  }
  const maintenant = Date.now();
  const articles = assembler(anciens, nouveaux, maintenant);
  if (!articles.length) throw new Error("Aucun article : la publication précédente reste en place.");

  const sortie = {
    genere: maintenant,
    medias: etats.map(({ flux, articles: a, erreur }) => ({ nom: flux.nom, origine: flux.origine, n: a.length, ...(erreur ? { erreur } : {}) })),
    articles,
  };
  await writeFile(cheminSortie, JSON.stringify(sortie));
  const actifs = etats.filter((e) => !e.erreur).length;
  console.log(`${actifs} flux actifs sur ${FLUX.length}, ${articles.length} articles.`);
  for (const e of etats) if (e.erreur) console.log(`  Échec ${e.flux.nom} : ${e.erreur}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
