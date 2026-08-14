const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();

const { config } = require('../config');
const { hentMoter, hentRoller, hentPersoner, finnPersonVedEpost } = require('../db');
const { erTeamInnlogget, loggUt } = require('../auth');
const { innloggingsUrl } = require('../oauth');
const { formaterDato, kjoreplanTypeNavn } = require('../helpers');

router.get('/logout', (req, res) => {
    loggUt(req);
    res.redirect(req.query.til === 'admin' ? '/admin' : '/');
});

router.post('/', async (req, res) => {
    const passord = req.body.passord || '';
    const ok = config.teamPassordHash && (await bcrypt.compare(passord, config.teamPassordHash));
    if (ok) {
        req.session.teamInnlogget = true;
        return res.redirect('/');
    }
    return visInnlogging(req, res, 'Feil passord.');
});

router.get('/', async (req, res) => {
    if (!erTeamInnlogget(req)) {
        return visInnlogging(req, res, '');
    }

    const [moter, roller, personer] = await Promise.all([hentMoter(), hentRoller(), hentPersoner()]);
    const idag = new Date().toISOString().slice(0, 10);
    const kommende = moter.filter((m) => m.dato >= idag);

    let forhandsvalgtId = '';
    if (req.session.innloggetEpost) {
        const treff = finnPersonVedEpost(personer, req.session.innloggetEpost);
        if (treff) forhandsvalgtId = treff.id;
    }

    const baseUrl = grunnUrlFraForesporsel(req);

    res.render('index', {
        moter: kommende,
        roller,
        personer,
        forhandsvalgtId,
        baseUrl,
        feedNokkel: config.feedNokkel,
        formaterDato,
        kjoreplanTypeNavn,
    });
});

function grunnUrlFraForesporsel(req) {
    if (config.baseUrlOverride) return config.baseUrlOverride.replace(/\/$/, '');
    const protokoll = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.get('host');
    return `${protokoll}://${host}`;
}

function visInnlogging(req, res, feilmelding) {
    res.render('teamLogin', {
        feil: feilmelding,
        googleUrl: config.google.palogget ? innloggingsUrl(req, 'google', 'team') : null,
        msUrl: config.microsoft.palogget ? innloggingsUrl(req, 'microsoft', 'team') : null,
    });
}

module.exports = router;
