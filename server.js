const express = require('express');
const cookieSession = require('cookie-session');
const path = require('path');
const http = require('http');

const { config, sjekkOppsett } = require('./src/config');

const feil = sjekkOppsett();
if (feil.length > 0) {
    console.error('\nTeknikerkalender kan ikke starte — sjekk .env:\n');
    feil.forEach((f) => console.error('  - ' + f));
    console.error('\nSe .env.example for veiledning.\n');
    process.exit(1);
}

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', true); // for riktig protokoll/host bak reverse proxy

app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(
    cookieSession({
        name: 'tk_sesjon',
        secret: config.sessionSecret,
        maxAge: 24 * 60 * 60 * 1000, // 24 timer
        httpOnly: true,
        sameSite: 'lax',
        secure: 'auto', // secure-cookie automatisk når forespørselen er https (også bak trusted proxy)
    })
);

// Gjør konfig og hjelpefunksjoner tilgjengelig i alle EJS-views uten å måtte sende dem hver gang
app.use((req, res, next) => {
    res.locals.config = config;
    res.locals.session = req.session;
    next();
});

// Enkel helsesjekk for Coolify (og docker-compose sin healthcheck) — svarer
// 200 uten å kreve innlogging, så deploy-panelet vet at appen faktisk kjører.
app.get('/healthz', (req, res) => {
    res.status(200).type('text/plain').send('ok');
});

app.use('/', require('./src/routes/index'));
app.use('/admin', require('./src/routes/admin'));
app.use('/admin-roller', require('./src/routes/adminRoller'));
app.use('/admin-personer', require('./src/routes/adminPersoner'));
app.use('/mote', require('./src/routes/mote')); // /mote/:id/rediger, /styring, /program
app.use('/feed.ics', require('./src/routes/feed'));
app.use('/oauth', require('./src/routes/oauthCallback'));
app.use('/live', require('./src/routes/moteLive'));

app.use((req, res) => {
    res.status(404).send('Fant ikke siden.');
});

const server = http.createServer(app);
require('./src/ws').settOpp(server);

server.listen(config.port, () => {
    console.log(`Teknikerkalender kjører på http://localhost:${config.port}`);
});
