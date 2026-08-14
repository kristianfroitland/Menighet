const crypto = require('crypto');
const { config } = require('./config');

/** Bygger redirect-URI-en vi oppgir hos Google/Microsoft (må matche eksakt det som er registrert der). */
function redirectUri(req) {
    return grunnUrl(req) + '/oauth/callback';
}

/** Finner nettadressen til denne installasjonen, med støtte for reverse proxy / BASE_URL-override. */
function grunnUrl(req) {
    if (config.baseUrlOverride) {
        return config.baseUrlOverride.replace(/\/$/, '');
    }
    const protokoll = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.get('host');
    return `${protokoll}://${host}`;
}

/** Bygger lenken brukeren sendes til for å logge inn hos leverandøren, og lagrer state+modus i sesjonen. */
function innloggingsUrl(req, leverandor, modus) {
    const state = crypto.randomBytes(16).toString('hex');
    req.session.oauthState = state;
    req.session.oauthModus = modus; // 'team' eller 'admin'
    req.session.oauthLeverandor = leverandor;

    const redirect = redirectUri(req);

    if (leverandor === 'google') {
        const params = new URLSearchParams({
            client_id: config.google.clientId,
            redirect_uri: redirect,
            response_type: 'code',
            scope: 'openid email profile',
            state,
            prompt: 'select_account',
        });
        return 'https://accounts.google.com/o/oauth2/v2/auth?' + params.toString();
    }

    if (leverandor === 'microsoft') {
        const params = new URLSearchParams({
            client_id: config.microsoft.clientId,
            redirect_uri: redirect,
            response_type: 'code',
            scope: 'openid email profile',
            state,
            response_mode: 'query',
        });
        const tenant = config.microsoft.tenant || 'common';
        return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?` + params.toString();
    }

    throw new Error('Ukjent leverandør: ' + leverandor);
}

/** Bytter engangskoden fra leverandøren mot brukerens e-post og navn. Returnerer null hvis noe feiler. */
async function hentBruker(req, leverandor, code) {
    const redirect = redirectUri(req);

    try {
        if (leverandor === 'google') {
            const tokenSvar = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    code,
                    client_id: config.google.clientId,
                    client_secret: config.google.clientSecret,
                    redirect_uri: redirect,
                    grant_type: 'authorization_code',
                }),
            });
            const token = await tokenSvar.json();
            if (!token.access_token) return null;

            const brukerSvar = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
                headers: { Authorization: 'Bearer ' + token.access_token },
            });
            const bruker = await brukerSvar.json();
            if (!bruker.email) return null;
            return { epost: bruker.email, navn: bruker.name || bruker.email };
        }

        if (leverandor === 'microsoft') {
            const tenant = config.microsoft.tenant || 'common';
            const tokenSvar = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    code,
                    client_id: config.microsoft.clientId,
                    client_secret: config.microsoft.clientSecret,
                    redirect_uri: redirect,
                    grant_type: 'authorization_code',
                    scope: 'openid email profile',
                }),
            });
            const token = await tokenSvar.json();
            if (!token.access_token) return null;

            const brukerSvar = await fetch('https://graph.microsoft.com/oidc/userinfo', {
                headers: { Authorization: 'Bearer ' + token.access_token },
            });
            const bruker = await brukerSvar.json();
            if (!bruker.email) return null;
            return { epost: bruker.email, navn: bruker.name || bruker.email };
        }
    } catch (feil) {
        return null;
    }

    return null;
}

/** Sjekker en e-post mot en liste med tillatte adresser og domener. */
function tilgangOk(epost, tillatteEposter, tillatteDomener) {
    const e = (epost || '').trim().toLowerCase();
    if (!e) return false;
    if (tillatteEposter.some((x) => x.trim().toLowerCase() === e)) return true;
    return tillatteDomener.some((d) => d.trim() !== '' && e.endsWith(d.trim().toLowerCase()));
}

module.exports = { grunnUrl, redirectUri, innloggingsUrl, hentBruker, tilgangOk };
