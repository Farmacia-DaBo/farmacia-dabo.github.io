/* Farmacia — logica condivisa tra app e service worker */
const DAY = 86400000;

const FORME = {
  compresse:  { nome: 'Compresse',  s: 'compressa',    p: 'compresse' },
  capsule:    { nome: 'Capsule',    s: 'capsula',      p: 'capsule' },
  bustine:    { nome: 'Bustine',    s: 'bustina',      p: 'bustine' },
  gocce:      { nome: 'Gocce',      s: 'goccia',       p: 'gocce' },
  sciroppo:   { nome: 'Sciroppo / soluzione', s: 'ml', p: 'ml' },
  fiale:      { nome: 'Fiale',      s: 'fiala',        p: 'fiale' },
  iniezioni:  { nome: 'Iniezioni / penne', s: 'iniezione', p: 'iniezioni' },
  cerotti:    { nome: 'Cerotti',    s: 'cerotto',      p: 'cerotti' },
  spray:      { nome: 'Spray',      s: 'erogazione',   p: 'erogazioni' },
  inalatore:  { nome: 'Inalatore',  s: 'erogazione',   p: 'erogazioni' },
  collirio:   { nome: 'Collirio',   s: 'goccia',       p: 'gocce' },
  supposte:   { nome: 'Supposte',   s: 'supposta',     p: 'supposte' },
  pomata:     { nome: 'Pomata / crema', s: 'applicazione', p: 'applicazioni' },
  altro:      { nome: 'Altro',      s: 'unità',        p: 'unità' }
};

const pad2 = n => String(n).padStart(2, '0');
function oggi0(d = new Date()) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); }
function parseData(s) { if (!s) return null; const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d).getTime(); }
function isoData(ts = Date.now()) { const d = new Date(ts); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }

function impostazioniDefault() {
  return { sogliaDefault: 10, giorniGiallo: 7, copertura: 60, promemoriaInventario: 30, tema: 'auto', notifiche: false, ultimoInventario: null, ultimoBackup: null };
}

/* Unità (gocce, compresse…) consumate in media al giorno */
function rateUnita(t) {
  const s = t.schema || {}; const d = +t.dose || 0;
  switch (s.tipo) {
    case 'giornaliero': return d * (s.volte || 1);
    case 'ogniN': return d * (s.volte || 1) / Math.max(1, s.ogniN || 1);
    case 'settimanale': return d * (s.volte || 1) * ((s.giorni || []).length) / 7;
    case 'bisogno': return (+s.stimaSettimana || 0) / 7;
    default: return 0;
  }
}

/* Flaconi con validità dopo l'apertura: la scorta si misura in giorni di flacone */
function modoApertura(t) { return +t.apertura > 0 && +t.unitaConf > 0; }
function vitaConf(t) {
  const r = rateUnita(t);
  return Math.min(+t.apertura, r > 0 ? t.unitaConf / r : Infinity);
}
function flaconiInfo(t, s) {
  const L = vitaConf(t);
  if (!(s > 0.001)) return { L, chiusi: 0, rem: 0 };
  const n = Math.ceil(s / L - 1e-9);
  return { L, chiusi: n - 1, rem: s - (n - 1) * L };
}
/* Velocità con cui cala la scorta memorizzata (unità o giorni di flacone) */
function rateGiornaliero(t) { return modoApertura(t) ? 1 : rateUnita(t); }

/* Orari indicativi dei momenti: la dose viene scalata a quell'ora */
const ORE_MOMENTI = { Mattina: 8, Pranzo: 13, Pomeriggio: 17, Sera: 20, Notte: 22 };

/* Le terapie a orario (non "al bisogno") consumano a scatti, dose per dose */
function discreto(t) { return modoApertura(t) || !!(t.schema && t.schema.tipo !== 'bisogno'); }

/* Dosi previste in un giorno: [[timestamp, quantità], …] */
function eventiGiorno(t, day) {
  const ts0 = day.getTime();
  if (modoApertura(t)) return [[ts0, 1]];
  const s = t.schema || {}; const d = +t.dose || 0; if (!d) return [];
  if (s.tipo === 'ogniN') {
    const anc = oggi0(new Date(t.inizio ? parseData(t.inizio) : (t.creato || ts0)));
    const N = Math.max(1, s.ogniN || 1); const k = Math.round((ts0 - anc) / DAY);
    if (((k % N) + N) % N !== 0) return [];
  }
  if (s.tipo === 'settimanale' && !(s.giorni || []).includes((day.getDay() + 6) % 7)) return [];
  const volte = s.volte || 1;
  const mom = (s.momenti || []).filter(m => ORE_MOMENTI[m] != null);
  if (mom.length === volte) return mom.map(m => [new Date(day.getFullYear(), day.getMonth(), day.getDate(), ORE_MOMENTI[m]).getTime(), d]);
  return [[ts0, d * volte]];
}
function limiti(t) {
  return { ini: t.inizio ? parseData(t.inizio) : -Infinity, fin: t.fine ? parseData(t.fine) + DAY : Infinity };
}

function consumo(t, da, a) {
  if (!(a > da)) return 0;
  const { ini, fin } = limiti(t);
  if (!discreto(t)) {
    const r = rateUnita(t); const x = Math.max(da, ini), y = Math.min(a, fin);
    return r && y > x ? r * (y - x) / DAY : 0;
  }
  let tot = 0; const d0 = new Date(oggi0(new Date(da)));
  for (let i = 0; i < 4000; i++) {
    const day = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() + i);
    if (day.getTime() > a) break;
    for (const [ts, q] of eventiGiorno(t, day)) if (ts > da && ts <= a && ts >= ini && ts < fin) tot += q;
  }
  return tot;
}

function stima(t, now = Date.now()) {
  if (t.stato !== 'attiva') return t.scortaBase;
  return t.scortaBase - consumo(t, t.dataBase, now);
}

/* Prima dose che la scorta non riesce a coprire (= giorno in cui si resta senza) */
function simula(t, s, now) {
  const { ini, fin } = limiti(t);
  if (!discreto(t)) {
    const r = rateUnita(t); if (!r) return { esaur: null, copreFine: false };
    const e = Math.max(now, ini) + Math.max(0, s) / r * DAY;
    return { esaur: e, copreFine: fin !== Infinity && e >= fin };
  }
  let rem = Math.max(0, s); const d0 = new Date(oggi0(new Date(now)));
  for (let i = 0; i < 3700; i++) {
    const day = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() + i);
    if (day.getTime() >= fin) return { esaur: null, copreFine: true };
    for (const [ts, q] of eventiGiorno(t, day)) {
      if (ts <= now || ts < ini || ts >= fin) continue;
      if (rem < q - 1e-6) return { esaur: ts, copreFine: false };
      rem -= q;
    }
  }
  return { esaur: null, copreFine: false };
}

const RANK = { esaurito: 0, rosso: 1, giallo: 2, verde: 3, ok: 4, inattiva: 5 };

function analisi(t, imp, now = Date.now()) {
  const s = stima(t, now), r = rateGiornaliero(t);
  const soglia = t.soglia != null ? t.soglia : imp.sogliaDefault;
  let esaur = null, copreFine = false;
  if (r > 0 && t.stato === 'attiva') ({ esaur, copreFine } = simula(t, s, now));
  const giorni = esaur ? (esaur - now) / DAY : Infinity;
  let livello;
  if (t.stato !== 'attiva') livello = 'inattiva';
  else if (!modoApertura(t) && t.schema && t.schema.tipo === 'bisogno' && t.scortaMin != null && s <= t.scortaMin) livello = s <= 0.001 ? 'esaurito' : 'rosso';
  else if (r === 0) livello = (t.scortaMin != null && s <= t.scortaMin) ? (s <= 0.001 ? 'esaurito' : 'rosso') : 'ok';
  else if (copreFine) livello = 'ok';
  else if (s <= 0.001 || (esaur && esaur - now < DAY && s < (+t.dose || 1) - 1e-6 && !modoApertura(t))) livello = 'esaurito';
  else if (giorni <= soglia) livello = 'rosso';
  else if (giorni <= soglia + imp.giorniGiallo) livello = 'giallo';
  else livello = 'verde';
  const entro = esaur ? esaur - soglia * DAY : null;
  return { stima: s, rate: r, giorni, esaurimento: esaur, entro, livello, soglia, copreFine, richiesta: !!(t.riordino && t.riordino.data) };
}

function daGestire(db, now = Date.now()) {
  return db.terapie.filter(t => t.stato === 'attiva')
    .map(t => ({ t, a: analisi(t, db.impostazioni, now) }))
    .filter(x => (x.a.livello === 'esaurito' || x.a.livello === 'rosso') && !x.a.richiesta)
    .sort((x, y) => RANK[x.a.livello] - RANK[y.a.livello] || x.a.giorni - y.a.giorni);
}

function testoAvviso(db, now = Date.now()) {
  const l = daGestire(db, now);
  if (!l.length) return { count: 0, body: '' };
  const nomi = l.slice(0, 3).map(x => {
    const p = db.persone.find(p => p.id === x.t.pid);
    return `${x.t.nome}${p ? ' (' + p.nome + ')' : ''}`;
  }).join(', ');
  const body = (l.length === 1 ? 'Da chiedere al medico: ' : `${l.length} farmaci da chiedere al medico: `) + nomi + (l.length > 3 ? '…' : '');
  return { count: l.length, body };
}

/* IndexedDB minimale chiave/valore */
const IDB = {
  _db: null,
  open() {
    if (this._db) return Promise.resolve(this._db);
    return new Promise((res, rej) => {
      const rq = indexedDB.open('farmacia', 1);
      rq.onupgradeneeded = () => rq.result.createObjectStore('kv');
      rq.onsuccess = () => { this._db = rq.result; res(rq.result); };
      rq.onerror = () => rej(rq.error);
    });
  },
  async get(k) {
    const db = await this.open();
    return new Promise((res, rej) => { const rq = db.transaction('kv').objectStore('kv').get(k); rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error); });
  },
  async set(k, v) {
    const db = await this.open();
    return new Promise((res, rej) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
  }
};
