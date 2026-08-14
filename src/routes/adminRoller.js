const express = require('express');
const router = express.Router();

const { hentRoller, lagreRoller, hentMoter, lagreMoter, finnRolle, nyttId } = require('../db');
const { krevAdmin, sikreCsrf, sjekkCsrf } = require('../auth');

router.use(krevAdmin);

router.post('/lagre', async (req, res) => {
    if (!sjekkCsrf(req)) return res.redirect('/admin-roller');

    const navn = (req.body.navn || '').trim();
    const id = (req.body.id || '').trim();
    if (!navn) return res.redirect('/admin-roller');

    let roller = await hentRoller();
    if (id) {
        roller = roller.map((r) => (r.id === id ? { ...r, navn } : r));
    } else {
        const storste = roller.reduce((maks, r) => Math.max(maks, r.rekkefolge || 0), 0);
        roller.push({ id: nyttId(), navn, rekkefolge: storste + 1 });
    }
    await lagreRoller(roller);
    res.redirect('/admin-roller');
});

router.post('/slett', async (req, res) => {
    if (!sjekkCsrf(req)) return res.redirect('/admin-roller');

    const id = req.body.id || '';
    const roller = (await hentRoller()).filter((r) => r.id !== id);
    await lagreRoller(roller);

    // Fjern eventuelle tildelinger til den slettede rollen fra alle møter
    const moter = await hentMoter();
    for (const m of moter) {
        m.tildelinger = m.tildelinger.filter((t) => t.roleId !== id);
    }
    await lagreMoter(moter);

    res.redirect('/admin-roller');
});

router.post('/flytt', async (req, res) => {
    if (!sjekkCsrf(req)) return res.redirect('/admin-roller');

    const id = req.body.id || '';
    const retning = req.body.retning || '';
    const roller = (await hentRoller()).sort((a, b) => (a.rekkefolge || 0) - (b.rekkefolge || 0));
    const indeks = roller.findIndex((r) => r.id === id);
    if (indeks !== -1) {
        const bytte = retning === 'opp' ? indeks - 1 : indeks + 1;
        if (bytte >= 0 && bytte < roller.length) {
            const temp = roller[indeks].rekkefolge ?? indeks;
            roller[indeks].rekkefolge = roller[bytte].rekkefolge ?? bytte;
            roller[bytte].rekkefolge = temp;
            await lagreRoller(roller);
        }
    }
    res.redirect('/admin-roller');
});

router.get('/', async (req, res) => {
    const roller = await hentRoller();
    const redigerId = req.query.rediger || '';
    const redigerRolle = redigerId ? finnRolle(roller, redigerId) : null;

    res.render('adminRoller', {
        roller,
        redigerRolle,
        csrf: sikreCsrf(req),
        aktivFane: 'roller',
    });
});

module.exports = router;
