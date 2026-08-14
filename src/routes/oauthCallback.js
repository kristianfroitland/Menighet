const express = require('express');
const crypto = require('crypto');
const router = express.Router();

const { config } = require('../config');
const { hentBruker, tilgangOk } = require('../oauth');

router.get('/callback', async (req, res) => {
    const modus = req.session.oauthModus || '';
    const leverandor = req.session.oauthLeverandor || '';
    const tilbakeTil = modus === 'admin' ? '/admin' : '/';

    const state = req.query.state || '';
    const forventetState = req.session.oauthState || '';
    const stateOk =
        state &&
        forventetState &&
        state.length === forventetState.length &&
        crypto.timingSafeEqual(Buffer.from(state), Buffer.from(forventetState));

    if (!stateOk) {
        return visFeil(res, 'Innloggingsforsøket var ugyldig eller utløpt. Prøv på nytt.', tilbakeTil);
    }
    req.session.oauthState = null;

    if (req.query.error) {
        return visFeil(res, 'Innlogging ble avbrutt eller nektet.', tilbakeTil);
    }

    const code = req.query.code || '';
    if (!code || !['google', 'microsoft'].includes(leverandor)) {
        return visFeil(res, 'Mangler nødvendig informasjon fra innloggingen. Prøv på nytt.', tilbakeTil);
    }

    const bruker = await hentBruker(req, leverandor, code);
    if (!bruker) {
        return visFeil(res, 'Klarte ikke bekrefte innloggingen hos leverandøren. Prøv på nytt.', tilbakeTil);
    }

    const ok =
        modus === 'admin'
            ? tilgangOk(bruker.epost, config.adminTillatteEposter, config.adminTillatteDomener)
            : tilgangOk(bruker.epost, config.teamTillatteEposter, config.teamTillatteDomener);

    if (!ok) {
        return visFeil(
            res,
            `Kontoen ${bruker.epost} har ikke tilgang. Be en administrator legge e-posten din til i tillatelseslisten.`,
            tilbakeTil
        );
    }

    if (modus === 'admin') {
        req.session.adminInnlogget = true;
    } else {
        req.session.teamInnlogget = true;
    }
    req.session.innloggetEpost = bruker.epost;
    req.session.innloggetNavn = bruker.navn;

    res.redirect(tilbakeTil);
});

function visFeil(res, melding, tilbakeTil) {
    res.render('oauthFeil', { melding, tilbakeTil });
}

module.exports = router;
