const express = require('express');
const crypto = require('crypto');
const router = express.Router();

const { config } = require('../config');
const { hentMoter, hentRoller, hentPersoner, finnPerson } = require('../db');
const { bygIcs } = require('../ics');

function nokkelOk(gitt) {
    const a = Buffer.from(gitt || '');
    const b = Buffer.from(config.feedNokkel || '');
    if (a.length !== b.length || b.length === 0) return false;
    return crypto.timingSafeEqual(a, b);
}

router.get('/', async (req, res) => {
    if (!nokkelOk(req.query.nokkel)) {
        return res.status(403).type('text/plain').send('Ingen tilgang. Denne kalenderlenken mangler eller har feil nøkkel.\nHent riktig lenke på nytt fra forsiden.');
    }

    const type = req.query.type || 'alle';
    const personId = (req.query.person || '').trim();

    let [moter, roller, personer] = await Promise.all([hentMoter(), hentRoller(), hentPersoner()]);

    let kalendernavn = config.siteNavn + ' – alle';
    if (type === 'person' && personId) {
        const p = finnPerson(personer, personId);
        moter = moter.filter((m) => m.tildelinger.some((t) => t.personId === personId));
        kalendernavn = config.siteNavn + ' – ' + (p ? p.navn : 'ukjent');
    }

    const ics = bygIcs({ moter, roller, personer, kalendernavn });
    res.set('Content-Type', 'text/calendar; charset=utf-8');
    res.set('Content-Disposition', 'inline; filename="teknikerkalender.ics"');
    res.send(ics);
});

module.exports = router;
