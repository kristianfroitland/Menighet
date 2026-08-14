const express = require('express');
const router = express.Router();

const { hentRoller, hentPersoner, lagrePersoner, hentMoter, lagreMoter, finnPerson, nyttId } = require('../db');
const { krevAdmin, sikreCsrf, sjekkCsrf } = require('../auth');

router.use(krevAdmin);

router.post('/lagre', async (req, res) => {
    if (!sjekkCsrf(req)) return res.redirect('/admin-personer');

    const navn = (req.body.navn || '').trim();
    const epost = (req.body.epost || '').trim();
    const telefon = (req.body.telefon || '').trim();
    const notat = (req.body.notat || '').trim();
    const id = (req.body.id || '').trim();
    let valgteRoller = req.body.roller || [];
    if (!Array.isArray(valgteRoller)) valgteRoller = [valgteRoller].filter(Boolean);

    if (!navn) return res.redirect('/admin-personer');

    let personer = await hentPersoner();
    const ny = { id: id || nyttId(), navn, epost, telefon, rolleIder: valgteRoller, notat };

    if (id) {
        personer = personer.map((p) => (p.id === id ? ny : p));
    } else {
        personer.push(ny);
    }
    await lagrePersoner(personer);
    res.redirect('/admin-personer');
});

router.post('/slett', async (req, res) => {
    if (!sjekkCsrf(req)) return res.redirect('/admin-personer');

    const id = req.body.id || '';
    const personer = (await hentPersoner()).filter((p) => p.id !== id);
    await lagrePersoner(personer);

    const moter = await hentMoter();
    for (const m of moter) {
        m.tildelinger = m.tildelinger.filter((t) => t.personId !== id);
    }
    await lagreMoter(moter);

    res.redirect('/admin-personer');
});

router.get('/', async (req, res) => {
    const [roller, personer] = await Promise.all([hentRoller(), hentPersoner()]);
    const redigerId = req.query.rediger || '';
    const redigerPerson = redigerId ? finnPerson(personer, redigerId) : null;

    res.render('adminPersoner', {
        roller,
        personer,
        redigerPerson,
        csrf: sikreCsrf(req),
        aktivFane: 'personer',
    });
});

module.exports = router;
