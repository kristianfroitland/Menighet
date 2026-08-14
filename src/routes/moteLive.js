const express = require('express');
const crypto = require('crypto');
const router = express.Router();

const { config } = require('../config');
const { hentMoter, finnMote } = require('../db');
const { formaterDato } = require('../helpers');

function nokkelOk(gitt) {
    const a = Buffer.from(gitt || '');
    const b = Buffer.from(config.liveNokkel || '');
    if (a.length !== b.length || b.length === 0) return false;
    return crypto.timingSafeEqual(a, b);
}

router.get('/:id', async (req, res) => {
    if (!nokkelOk(req.query.nokkel)) {
        return res.status(403).type('text/plain').send('Ingen tilgang. Denne lenken mangler eller har feil nøkkel.');
    }

    const moter = await hentMoter();
    const mote = finnMote(moter, req.params.id);
    if (!mote) {
        return res.status(404).type('text/plain').send('Fant ikke møtet.');
    }

    res.render('moteLive', {
        mote,
        formaterDato,
        wsUrl: `/ws/live?id=${encodeURIComponent(mote.id)}&nokkel=${encodeURIComponent(config.liveNokkel)}`,
    });
});

module.exports = router;
