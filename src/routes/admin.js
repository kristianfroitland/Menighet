const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();

const { config } = require('../config');
const { hentMoter, lagreMoter, hentRoller, hentPersoner, nyttId } = require('../db');
const { sikreCsrf, sjekkCsrf } = require('../auth');
const { innloggingsUrl } = require('../oauth');
const { formaterDato } = require('../helpers');

router.post('/logg-inn', async (req, res) => {
    const passord = req.body.passord || '';
    const ok = config.adminPassordHash && (await bcrypt.compare(passord, config.adminPassordHash));
    if (ok) {
        req.session.adminInnlogget = true;
        return res.redirect('/admin');
    }
    return visInnlogging(req, res, 'Feil passord.');
});

router.post('/nytt-mote', async (req, res) => {
    if (!req.session.adminInnlogget) return res.redirect('/admin');
    if (!sjekkCsrf(req)) return res.redirect('/admin');

    const dato = (req.body.dato || '').trim();
    const tid = (req.body.tid || '').trim();
    const notat = (req.body.notat || '').trim();
    if (!dato || !tid) {
        return res.redirect('/admin');
    }

    const moter = await hentMoter();
    const id = nyttId();
    moter.push({ id, dato, tid, notat, tildelinger: [], kjoreplan: [], aktivtPunktId: null });
    await lagreMoter(moter);
    res.redirect(`/mote/${id}/rediger`);
});

router.post('/slett-mote', async (req, res) => {
    if (!req.session.adminInnlogget) return res.redirect('/admin');
    if (!sjekkCsrf(req)) return res.redirect('/admin');

    const id = req.body.id || '';
    const moter = (await hentMoter()).filter((m) => m.id !== id);
    await lagreMoter(moter);
    res.redirect('/admin');
});

router.get('/', async (req, res) => {
    if (!req.session.adminInnlogget) {
        return visInnlogging(req, res, '');
    }

    const [moter, roller, personer] = await Promise.all([hentMoter(), hentRoller(), hentPersoner()]);
    res.render('admin', {
        moter,
        roller,
        personer,
        csrf: sikreCsrf(req),
        aktivFane: 'moter',
        formaterDato,
    });
});

function visInnlogging(req, res, feilmelding) {
    res.render('adminLogin', {
        feil: feilmelding,
        googleUrl: config.google.palogget ? innloggingsUrl(req, 'google', 'admin') : null,
        msUrl: config.microsoft.palogget ? innloggingsUrl(req, 'microsoft', 'admin') : null,
    });
}

module.exports = router;
