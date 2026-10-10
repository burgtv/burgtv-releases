#!/usr/bin/env node
// Sincronizza index.html di download.burgtv.com con le fonti:
//  1. DL_DICT (11 lingue) da scripts/download-i18n.mjs;
//  2. HTML statico di base = testi INGLESI aggiornati (quello che leggono Google e gli assistenti AI, e chi non ha JS);
//  3. versioni e link di download statici + dati strutturati JSON-LD, dalle stesse fonti della pagina:
//     version.json (TV), version-ios.json (iPhone/iPad), vercel.json /mobile.apk (Android telefoni).
// Uso: node scripts/sync-download-i18n.mjs   (ripetibile; non tocca version*.json, vercel.json, changelog_i18n.json)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DICT } from './download-i18n.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
let html = fs.readFileSync(FILE, 'utf8');

// --- controlli sul dizionario
const keys = Object.keys(DICT.en);
for (const [l, d] of Object.entries(DICT)) {
  const miss = keys.filter(k => !(k in d));
  const extra = Object.keys(d).filter(k => !keys.includes(k));
  if (miss.length || extra.length) throw new Error(`${l}: mancano ${miss} / in piu' ${extra}`);
  for (const [k, v] of Object.entries(d)) {
    if (/APKPure/i.test(v)) throw new Error(`${l}.${k}: APKPure non e' un canale ufficiale`);
    if (l === 'ar' && /بريميوم/.test(v)) throw new Error(`ar.${k}: Premium va in caratteri latini`);
  }
}

// --- 1. DL_DICT
const dictSrc = '{\n' + Object.entries(DICT).map(([l, d]) => `          ${l}: ${JSON.stringify(d)}`).join(',\n') + '\n        }';
html = html.replace(/\/\*DL_DICT_START\*\/[\s\S]*?\/\*DL_DICT_END\*\//, `/*DL_DICT_START*/${dictSrc}/*DL_DICT_END*/`);

// --- 2. HTML statico in inglese (contenuto di ogni elemento data-i18n)
function replaceInner(src, key, inner) {
  const open = new RegExp(`<([a-zA-Z0-9]+)\\b[^>]*\\bdata-i18n="${key.replace(/\./g, '\\.')}"[^>]*>`, 'g');
  let out = src, m, count = 0;
  while ((m = open.exec(out))) {
    const tag = m[1].toLowerCase();
    const startInner = m.index + m[0].length;
    const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi');
    re.lastIndex = startInner;
    let depth = 1, mm, endInner = -1;
    while ((mm = re.exec(out))) {
      if (mm[1] === '/') { if (--depth === 0) { endInner = mm.index; break; } }
      else if (!/\/>$/.test(mm[0])) depth++;
    }
    if (endInner < 0) throw new Error('chiusura non trovata per ' + key);
    out = out.slice(0, startInner) + inner + out.slice(endInner);
    open.lastIndex = startInner + inner.length;
    count++;
  }
  return { out, count };
}
const used = new Set([...html.matchAll(/data-i18n="([^"]+)"/g)].map(m => m[1]));
for (const k of used) {
  if (!(k in DICT.en)) throw new Error('chiave usata nella pagina ma assente nel dizionario: ' + k);
  const r = replaceInner(html, k, DICT.en[k]);
  html = r.out;
}
const unused = keys.filter(k => !used.has(k) && k !== 'meta.title');
if (unused.length) console.warn('Chiavi non usate nella pagina:', unused.join(', '));

// --- 3. versioni, link e JSON-LD
const tv = JSON.parse(fs.readFileSync(path.join(ROOT, 'version.json'), 'utf8'));
const ios = JSON.parse(fs.readFileSync(path.join(ROOT, 'version-ios.json'), 'utf8'));
const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
const mobUrl = vercel.redirects.find(r => r.source === '/mobile.apk').destination;
const mobVer = (mobUrl.match(/(\d+\.\d+\.\d+)-release\.apk$/) || [])[1];
if (!tv.version_name || !ios.version || !mobVer) throw new Error('versioni non trovate');

const setText = (id, txt) => {
  const re = new RegExp(`(<[^>]*\\bid="${id}"[^>]*>)[^<]*(<)`);
  if (!re.test(html)) throw new Error('id non trovato: ' + id);
  html = html.replace(re, `$1${txt}$2`);
};
const setHref = (id, href) => {
  const re = new RegExp(`(<a\\b[^>]*\\bid="${id}"[^>]*\\bhref=")[^"]*(")|(<a\\b[^>]*\\bhref=")[^"]*("[^>]*\\bid="${id}")`);
  if (!re.test(html)) throw new Error('link non trovato: ' + id);
  html = html.replace(re, (m, a1, a2, b1, b2) => a1 ? a1 + href + a2 : b1 + href + b2);
};
setText('tv-version', 'v' + tv.version_name);
setText('mobile-version', 'v' + mobVer);
setText('ios-version', 'v' + ios.version);
setHref('tv-download', tv.download_url);
setHref('mobile-download', mobUrl);

const ORG = { '@type': 'Organization', '@id': 'https://burgtv.com/#org', name: 'BurgTV', url: 'https://burgtv.com/' };
const LANGS_APP = ['it', 'en', 'es', 'fr', 'de', 'pt-BR', 'nl', 'pl', 'tr', 'ar', 'zh-CN', 'ru', 'sq', 'bg', 'cs', 'hr', 'hu', 'ja', 'ko', 'ro', 'sr'];
const ld = [
  {
    '@context': 'https://schema.org', '@type': 'SoftwareApplication', '@id': 'https://burgtv.com/#app-tv',
    name: 'BurgTV for Fire TV, Google TV and Android TV', applicationCategory: 'MultimediaApplication',
    applicationSubCategory: 'IPTV player', operatingSystem: 'Fire OS, Android TV, Google TV',
    softwareVersion: tv.version_name, downloadUrl: 'https://download.burgtv.com/tv.apk', installUrl: 'https://download.burgtv.com/',
    inLanguage: LANGS_APP,
    featureList: ['M3U playlists, Xtream Codes, Jellyfin and Portal sources', 'TV guide (EPG, XMLTV)', 'Timeshift up to 120 minutes (Premium)', 'Multi-View up to 4 channels (Premium)', 'Recordings (Premium)', 'Profiles and Kids profile (Premium)', 'Parental controls with PIN'],
    offers: [
      { '@type': 'Offer', name: 'Free', price: '0', priceCurrency: 'CHF' },
      { '@type': 'Offer', name: 'Premium yearly (7 days free), 5 devices across TV and Android', price: '8.90', priceCurrency: 'CHF', url: 'https://app.burgtv.com/register.html' },
      { '@type': 'Offer', name: 'Premium lifetime, 5 devices across TV and Android', price: '25.90', priceCurrency: 'CHF', url: 'https://app.burgtv.com/register.html' },
    ],
    publisher: ORG,
  },
  {
    '@context': 'https://schema.org', '@type': 'MobileApplication', '@id': 'https://burgtv.com/#app-android',
    name: 'BurgTV for Android phones and tablets', applicationCategory: 'MultimediaApplication', operatingSystem: 'Android',
    softwareVersion: mobVer, downloadUrl: 'https://download.burgtv.com/mobile.apk', installUrl: 'https://download.burgtv.com/',
    // Stesse regole Gratis/Premium della TV; limiti attivi dal 10/11/2026 (fino ad allora tutto incluso);
    // la licenza del sito vale su 5 dispositivi in totale tra TV e Android.
    offers: [
      { '@type': 'Offer', name: 'Free (all features included until 2026-11-10, then the same limits as the TV)', price: '0', priceCurrency: 'CHF' },
      { '@type': 'Offer', name: 'Premium yearly (7 days free), 5 devices across TV and Android', price: '8.90', priceCurrency: 'CHF', url: 'https://app.burgtv.com/register.html' },
      { '@type': 'Offer', name: 'Premium lifetime, 5 devices across TV and Android', price: '25.90', priceCurrency: 'CHF', url: 'https://app.burgtv.com/register.html' },
    ],
    publisher: ORG,
  },
  {
    '@context': 'https://schema.org', '@type': 'MobileApplication', '@id': 'https://burgtv.com/#app-ios',
    name: 'BurgTV for iPhone and iPad', applicationCategory: 'MultimediaApplication', operatingSystem: 'iOS, iPadOS',
    softwareVersion: ios.version, downloadUrl: ios.url || 'https://apps.apple.com/app/id6761636987',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'CHF', description: 'Free download with a 7-day trial; Premium is an in-app purchase in the App Store' },
    publisher: ORG,
  },
];
html = html.replace(/(<script type="application\/ld\+json" id="dl-jsonld">)[\s\S]*?(<\/script>)/, `$1${JSON.stringify(ld)}$2`);

fs.writeFileSync(FILE, html);
console.log(`ok: ${Object.keys(DICT).length} lingue, ${used.size} chiavi nella pagina; TV ${tv.version_name}, Android ${mobVer}, iOS ${ios.version}`);
