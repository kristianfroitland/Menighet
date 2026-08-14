require('dotenv').config();
const bcrypt = require('bcryptjs');

/** Splitter en kommaseparert env-variabel til en ren liste (tomme verdier fjernes). */
function liste(verdi) {
    return (verdi || '')
        .split(',')
        .map((v) => v.trim())
        .filter((v) => v !== '');
}

function boolsk(verdi) {
    return String(verdi).toLowerCase() === 'true';
}

/**
 * Godtar enten et ferdig bcrypt-hash (ADMIN_PASSORD_HASH, laget med
 * "npm run generate-hash") ELLER et vanlig passord i klartekst
 * (ADMIN_PASSORD), som i så fall hashes automatisk her ved oppstart.
 *
 * Poenget med klartekst-varianten er Coolify (og lignende deploy-paneler)
 * sine auto-genererte "magic" passord — de kan lage et ekte tilfeldig
 * passord for deg, men ikke en bcrypt-hash av det. Med denne støtten
 * trenger du ikke noe manuelt hash-steg når du deployer på Coolify.
 */
function lesPassordHash(hashEnvNavn, klartekstEnvNavn) {
    const hash = process.env[hashEnvNavn] || '';
    if (hash) return hash;
    const klartekst = process.env[klartekstEnvNavn] || '';
    if (klartekst) return bcrypt.hashSync(klartekst, 10);
    return '';
}

const config = {
    port: parseInt(process.env.PORT || '3000', 10),

    siteNavn: process.env.SITE_NAVN || 'Teknikeransvar',
    siteUndertekst: process.env.SITE_UNDERTEKST || 'Se hvilken søndag du har teknikeransvar på møte.',
    moteVarighetMin: parseInt(process.env.MOTE_VARIGHET_MIN || '120', 10),

    sessionSecret: process.env.SESSION_SECRET || '',

    adminPassordHash: lesPassordHash('ADMIN_PASSORD_HASH', 'ADMIN_PASSORD'),
    teamPassordHash: lesPassordHash('TEAM_PASSORD_HASH', 'TEAM_PASSORD'),

    feedNokkel: process.env.FEED_NOKKEL || '',
    liveNokkel: process.env.LIVE_NOKKEL || '',

    kalenderDomene: process.env.KALENDER_DOMENE || 'teknikerkalender.local',

    google: {
        palogget: boolsk(process.env.GOOGLE_PALOGGET),
        clientId: process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    },
    microsoft: {
        palogget: boolsk(process.env.MS_PALOGGET),
        clientId: process.env.MS_CLIENT_ID || '',
        clientSecret: process.env.MS_CLIENT_SECRET || '',
        tenant: process.env.MS_TENANT || 'common',
    },

    teamTillatteEposter: liste(process.env.TEAM_TILLATTE_EPOSTER),
    teamTillatteDomener: liste(process.env.TEAM_TILLATTE_DOMENER),
    adminTillatteEposter: liste(process.env.ADMIN_TILLATTE_EPOSTER),
    adminTillatteDomener: liste(process.env.ADMIN_TILLATTE_DOMENER),

    baseUrlOverride: process.env.BASE_URL || '',

    dataDir: require('path').join(__dirname, '..', 'data'),
};

// ---------- Enkel oppstartssjekk med tydelige feilmeldinger ----------
function sjekkOppsett() {
    const feil = [];
    if (!config.sessionSecret || config.sessionSecret.length < 16) {
        feil.push('SESSION_SECRET mangler eller er for kort (minst 16 tegn) — sett en lang, tilfeldig verdi i .env');
    }
    if (!config.adminPassordHash) {
        feil.push('ADMIN_PASSORD (eller ADMIN_PASSORD_HASH) er ikke satt — se .env.example');
    }
    if (!config.teamPassordHash) {
        feil.push('TEAM_PASSORD (eller TEAM_PASSORD_HASH) er ikke satt — se .env.example');
    }
    if (!config.feedNokkel || config.feedNokkel.length < 12) {
        feil.push('FEED_NOKKEL mangler eller er for kort — se .env.example for hvordan du genererer en');
    }
    if (!config.liveNokkel || config.liveNokkel.length < 12) {
        feil.push('LIVE_NOKKEL mangler eller er for kort — se .env.example for hvordan du genererer en');
    }
    return feil;
}

module.exports = { config, sjekkOppsett };
