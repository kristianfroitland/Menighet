const express = require('express');
const router = express.Router();

const { config } = require('../config');
const { hentMoter, lagreMoter, finnMote, hentRoller, hentPersoner, finnPerson, nyttId } = require('../db');
const { krevAdmin, sikreCsrf, sjekkCsrf } = require('../auth');
const { formaterDato, kjoreplanTypeNavn } = require('../helpers');
const { kringkastOppdatering } = require('../ws');

router.use(krevAdmin);

async function hentMoteEllerSendTilAdmin(req, res) {
    const moter = await hentMoter();
    const mote = finnMote(moter, req.params.id);
    if (!mote) {
        res.redirect('/admin');
        return null;
    }
    return { moter, mote };
}

async function lagreEndretMote(moter, moteOppdatert) {
    const nye = moter.map((m) => (m.id === moteOppdatert.id ? moteOppdatert : m));
    await lagreMoter(nye);
}

// ---------- Møteredigering ----------

router.get('/:id/rediger', async (req, res) => {
    const funnet = await hentMoteEllerSendTilAdmin(req, res);
    if (!funnet) return;
    const [roller, personer] = await Promise.all([hentRoller(), hentPersoner()]);

    res.render('moteRediger', {
        mote: funnet.mote,
        roller,
        personer,
        csrf: sikreCsrf(req),
        finnPerson,
        formaterDato,
        kjoreplanTypeNavn,
    });
});

router.post('/:id/oppdater-detaljer', async (req, res) => {
    if (!sjekkCsrf(req)) return res.redirect(`/mote/${req.params.id}/rediger`);
    const { moter, mote } = (await hentMoteEllerSendTilAdmin(req, res)) || {};
    if (!mote) return;

    mote.dato = (req.body.dato || mote.dato).trim();
    mote.tid = (req.body.tid || mote.tid).trim();
    mote.notat = (req.body.notat || '').trim();
    await lagreEndretMote(moter, mote);
    res.redirect(`/mote/${mote.id}/rediger`);
});

router.post('/:id/legg-til-tildeling', async (req, res) => {
    if (!sjekkCsrf(req)) return res.redirect(`/mote/${req.params.id}/rediger`);
    const { moter, mote } = (await hentMoteEllerSendTilAdmin(req, res)) || {};
    if (!mote) return;

    const roleId = req.body.roleId || '';
    const personId = (req.body.personId || '').trim() || null;
    if (roleId) {
        mote.tildelinger.push({ roleId, personId });
        await lagreEndretMote(moter, mote);
    }
    res.redirect(`/mote/${mote.id}/rediger`);
});

router.post('/:id/fjern-tildeling', async (req, res) => {
    if (!sjekkCsrf(req)) return res.redirect(`/mote/${req.params.id}/rediger`);
    const { moter, mote } = (await hentMoteEllerSendTilAdmin(req, res)) || {};
    if (!mote) return;

    const indeks = parseInt(req.body.indeks, 10);
    if (Number.isInteger(indeks) && mote.tildelinger[indeks] !== undefined) {
        mote.tildelinger.splice(indeks, 1);
        await lagreEndretMote(moter, mote);
    }
    res.redirect(`/mote/${mote.id}/rediger`);
});

router.post('/:id/legg-til-punkt', async (req, res) => {
    if (!sjekkCsrf(req)) return res.redirect(`/mote/${req.params.id}/rediger`);
    const { moter, mote } = (await hentMoteEllerSendTilAdmin(req, res)) || {};
    if (!mote) return;

    const tittel = (req.body.tittel || '').trim();
    const type = (req.body.type || 'annet').trim();
    const notat = (req.body.punktNotat || '').trim();
    if (tittel) {
        mote.kjoreplan.push({ id: nyttId(), tittel, type, notat });
        await lagreEndretMote(moter, mote);
    }
    res.redirect(`/mote/${mote.id}/rediger`);
});

router.post('/:id/slett-punkt', async (req, res) => {
    if (!sjekkCsrf(req)) return res.redirect(`/mote/${req.params.id}/rediger`);
    const { moter, mote } = (await hentMoteEllerSendTilAdmin(req, res)) || {};
    if (!mote) return;

    const punktId = req.body.punktId || '';
    mote.kjoreplan = mote.kjoreplan.filter((k) => k.id !== punktId);
    if (mote.aktivtPunktId === punktId) mote.aktivtPunktId = null;
    await lagreEndretMote(moter, mote);
    await kringkastOppdatering(mote.id);
    res.redirect(`/mote/${mote.id}/rediger`);
});

router.post('/:id/flytt-punkt', async (req, res) => {
    if (!sjekkCsrf(req)) return res.redirect(`/mote/${req.params.id}/rediger`);
    const { moter, mote } = (await hentMoteEllerSendTilAdmin(req, res)) || {};
    if (!mote) return;

    const punktId = req.body.punktId || '';
    const retning = req.body.retning || '';
    const indeks = mote.kjoreplan.findIndex((k) => k.id === punktId);
    if (indeks !== -1) {
        const bytte = retning === 'opp' ? indeks - 1 : indeks + 1;
        if (bytte >= 0 && bytte < mote.kjoreplan.length) {
            [mote.kjoreplan[indeks], mote.kjoreplan[bytte]] = [mote.kjoreplan[bytte], mote.kjoreplan[indeks]];
            await lagreEndretMote(moter, mote);
        }
    }
    res.redirect(`/mote/${mote.id}/rediger`);
});

// ---------- Live styring ----------

router.get('/:id/styring', async (req, res) => {
    const funnet = await hentMoteEllerSendTilAdmin(req, res);
    if (!funnet) return;

    const baseUrl = grunnUrlFraForesporsel(req);
    res.render('moteStyring', {
        mote: funnet.mote,
        csrf: sikreCsrf(req),
        formaterDato,
        kjoreplanTypeNavn,
        liveUrl: `${baseUrl}/live/${funnet.mote.id}?nokkel=${encodeURIComponent(config.liveNokkel)}`,
    });
});

router.post('/:id/styring/handling', async (req, res) => {
    if (!sjekkCsrf(req)) return res.redirect(`/mote/${req.params.id}/styring`);
    const { moter, mote } = (await hentMoteEllerSendTilAdmin(req, res)) || {};
    if (!mote) return;

    const handling = req.body.handling || '';
    const punktIder = mote.kjoreplan.map((k) => k.id);
    const naavaerendeIndeks = punktIder.indexOf(mote.aktivtPunktId);

    if (handling === 'sett-aktiv') {
        const nyttPunktId = req.body.punktId || '';
        mote.aktivtPunktId = nyttPunktId || null;
    } else if (handling === 'neste') {
        if (naavaerendeIndeks === -1) {
            mote.aktivtPunktId = punktIder[0] ?? null;
        } else if (naavaerendeIndeks < punktIder.length - 1) {
            mote.aktivtPunktId = punktIder[naavaerendeIndeks + 1];
        }
    } else if (handling === 'forrige') {
        if (naavaerendeIndeks > 0) {
            mote.aktivtPunktId = punktIder[naavaerendeIndeks - 1];
        }
    } else if (handling === 'stopp') {
        mote.aktivtPunktId = null;
    }

    await lagreEndretMote(moter, mote);
    await kringkastOppdatering(mote.id);
    res.redirect(`/mote/${mote.id}/styring`);
});

// ---------- Program (utskrift/PDF) ----------

router.get('/:id/program', async (req, res) => {
    const funnet = await hentMoteEllerSendTilAdmin(req, res);
    if (!funnet) return;
    const html = await renderProgramHtml(funnet.mote, req.app);
    res.send(html);
});

router.get('/:id/program.pdf', async (req, res) => {
    const funnet = await hentMoteEllerSendTilAdmin(req, res);
    if (!funnet) return;

    let puppeteer;
    try {
        puppeteer = require('puppeteer');
    } catch {
        return res
            .status(500)
            .send('PDF-generering krever pakken "puppeteer" — kjør "npm install" på serveren først.');
    }

    const html = await renderProgramHtml(funnet.mote, req.app, { forUtskrift: true });
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    try {
        const side = await browser.newPage();
        await side.setContent(html, { waitUntil: 'networkidle0' });
        const pdfBuffer = await side.pdf({ format: 'A4', printBackground: true, margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' } });
        res.set('Content-Type', 'application/pdf');
        res.set('Content-Disposition', `attachment; filename="program-${funnet.mote.dato}.pdf"`);
        res.send(pdfBuffer);
    } finally {
        await browser.close();
    }
});

async function renderProgramHtml(mote, app, valg = {}) {
    const [roller, personer] = await Promise.all([hentRoller(), hentPersoner()]);
    return new Promise((resolve, reject) => {
        app.render(
            'moteProgram',
            { mote, roller, personer, finnPerson, formaterDato, kjoreplanTypeNavn, forUtskrift: !!valg.forUtskrift },
            (feil, html) => (feil ? reject(feil) : resolve(html))
        );
    });
}

function grunnUrlFraForesporsel(req) {
    if (config.baseUrlOverride) return config.baseUrlOverride.replace(/\/$/, '');
    const protokoll = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.get('host');
    return `${protokoll}://${host}`;
}

module.exports = router;
