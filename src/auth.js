const crypto = require('crypto');

/** Middleware: krever at admin er logget inn, ellers redirect til /admin. */
function krevAdmin(req, res, next) {
    if (!req.session.adminInnlogget) {
        return res.redirect('/admin');
    }
    next();
}

/** Sjekker (uten redirect) om noen er logget inn på team-siden. */
function erTeamInnlogget(req) {
    return !!req.session.teamInnlogget;
}

/** Sørger for at forespørselen har en CSRF-token i sesjonen, og returnerer den. */
function sikreCsrf(req) {
    if (!req.session.csrf) {
        req.session.csrf = crypto.randomBytes(16).toString('hex');
    }
    return req.session.csrf;
}

/** Sjekker at innsendt CSRF-token matcher sesjonens. */
function sjekkCsrf(req) {
    const innsendt = (req.body && req.body.csrf) || '';
    const forventet = req.session.csrf || '';
    if (!forventet || !innsendt) return false;
    const a = Buffer.from(innsendt);
    const b = Buffer.from(forventet);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}

/** Fjerner alt av innloggingsdata fra sesjonen (både team og admin). */
function loggUt(req) {
    req.session.adminInnlogget = null;
    req.session.teamInnlogget = null;
    req.session.innloggetEpost = null;
    req.session.innloggetNavn = null;
}

module.exports = { krevAdmin, erTeamInnlogget, sikreCsrf, sjekkCsrf, loggUt };
