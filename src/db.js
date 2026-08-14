const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const crypto = require('crypto');
const { config } = require('./config');

const FILER = {
    moter: path.join(config.dataDir, 'meetings.json'),
    roller: path.join(config.dataDir, 'roller.json'),
    personer: path.join(config.dataDir, 'personer.json'),
};

// Én skrivekø per fil, så to samtidige lagringer til samme fil aldri
// kan overlappe og skrive over hverandre (Node er i utgangspunktet
// enkelttrådet for JS-kode, men async fil-I/O kan fortsatt interleave).
const skrivekoer = new Map();

function kOForFil(sti) {
    if (!skrivekoer.has(sti)) {
        skrivekoer.set(sti, Promise.resolve());
    }
    return skrivekoer.get(sti);
}

async function lesJsonFil(sti) {
    try {
        const innhold = await fs.readFile(sti, 'utf-8');
        const data = JSON.parse(innhold);
        return Array.isArray(data) ? data : [];
    } catch (feil) {
        if (feil.code === 'ENOENT') {
            return [];
        }
        throw feil;
    }
}

async function lagreJsonFil(sti, data) {
    const nesteSkriving = kOForFil(sti).then(async () => {
        await fs.mkdir(path.dirname(sti), { recursive: true });
        const midlertidigSti = sti + '.tmp-' + crypto.randomBytes(4).toString('hex');
        await fs.writeFile(midlertidigSti, JSON.stringify(data, null, 4), 'utf-8');
        await fs.rename(midlertidigSti, sti); // atomisk bytte, unngår korrupt fil ved krasj midt i skriving
    });
    skrivekoer.set(sti, nesteSkriving.catch(() => {})); // ikke la én feilet skriving blokkere fremtidige
    return nesteSkriving;
}

/** Lager en ny, unik id (12 hex-tegn) — samme format som brukes overalt i datamodellen. */
function nyttId() {
    return crypto.randomBytes(6).toString('hex');
}

// ============================================
//  Møter
// ============================================

async function hentMoter() {
    const data = await lesJsonFil(FILER.moter);
    data.sort((a, b) => (a.dato + a.tid).localeCompare(b.dato + b.tid));
    for (const m of data) {
        m.tildelinger = m.tildelinger || [];
        m.kjoreplan = m.kjoreplan || [];
        m.notat = m.notat || '';
        m.aktivtPunktId = m.aktivtPunktId ?? null;
    }
    return data;
}

async function lagreMoter(moter) {
    return lagreJsonFil(FILER.moter, moter);
}

function finnMote(moter, id) {
    return moter.find((m) => m.id === id) || null;
}

function finnPunkt(mote, punktId) {
    if (!punktId) return null;
    return mote.kjoreplan.find((k) => k.id === punktId) || null;
}

// ============================================
//  Roller
// ============================================

async function hentRoller() {
    const data = await lesJsonFil(FILER.roller);
    data.sort((a, b) => (a.rekkefolge ?? 0) - (b.rekkefolge ?? 0));
    return data;
}

async function lagreRoller(roller) {
    return lagreJsonFil(FILER.roller, roller);
}

function finnRolle(roller, id) {
    if (!id) return null;
    return roller.find((r) => r.id === id) || null;
}

// ============================================
//  Personer
// ============================================

async function hentPersoner() {
    const data = await lesJsonFil(FILER.personer);
    data.sort((a, b) => (a.navn || '').localeCompare(b.navn || '', 'no', { sensitivity: 'base' }));
    for (const p of data) {
        p.rolleIder = p.rolleIder || [];
        p.epost = p.epost || '';
        p.telefon = p.telefon || '';
        p.notat = p.notat || '';
    }
    return data;
}

async function lagrePersoner(personer) {
    return lagreJsonFil(FILER.personer, personer);
}

function finnPerson(personer, id) {
    if (!id) return null;
    return personer.find((p) => p.id === id) || null;
}

function finnPersonVedEpost(personer, epost) {
    const e = (epost || '').trim().toLowerCase();
    if (!e) return null;
    return personer.find((p) => (p.epost || '').trim().toLowerCase() === e) || null;
}

module.exports = {
    nyttId,
    hentMoter,
    lagreMoter,
    finnMote,
    finnPunkt,
    hentRoller,
    lagreRoller,
    finnRolle,
    hentPersoner,
    lagrePersoner,
    finnPerson,
    finnPersonVedEpost,
};
