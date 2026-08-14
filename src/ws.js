const { WebSocketServer } = require('ws');
const { URL } = require('url');
const { config } = require('./config');
const { hentMoter, finnMote, finnPunkt } = require('./db');
const { kjoreplanTypeNavn } = require('./helpers');

// Hvilke websocket-klienter som følger med på hvilket møte
const klienterPerMote = new Map(); // moteId -> Set<ws>

function settOpp(server) {
    const wss = new WebSocketServer({ noServer: true });

    server.on('upgrade', (req, socket, head) => {
        let url;
        try {
            url = new URL(req.url, 'http://localhost');
        } catch {
            socket.destroy();
            return;
        }
        if (url.pathname !== '/ws/live') {
            return; // la andre ev. upgrade-handlers ta den
        }
        const nokkel = url.searchParams.get('nokkel') || '';
        const moteId = url.searchParams.get('id') || '';

        if (nokkel !== config.liveNokkel || !moteId) {
            socket.destroy();
            return;
        }

        wss.handleUpgrade(req, socket, head, (ws) => {
            ws.moteId = moteId;
            if (!klienterPerMote.has(moteId)) {
                klienterPerMote.set(moteId, new Set());
            }
            klienterPerMote.get(moteId).add(ws);

            ws.on('close', () => {
                const settet = klienterPerMote.get(moteId);
                if (settet) {
                    settet.delete(ws);
                    if (settet.size === 0) klienterPerMote.delete(moteId);
                }
            });
            ws.on('error', () => ws.close());

            sendStatusTil(ws, moteId).catch(() => {});
        });
    });

    return wss;
}

/** Bygger og sender gjeldende status for ett møte til én websocket-klient. */
async function sendStatusTil(ws, moteId) {
    if (ws.readyState !== 1 /* OPEN */) return;
    const status = await byggStatus(moteId);
    ws.send(JSON.stringify(status));
}

/** Kalles fra kontrollsiden når aktivt punkt endres — pusher til alle som ser på dette møtet. */
async function kringkastOppdatering(moteId) {
    const settet = klienterPerMote.get(moteId);
    if (!settet || settet.size === 0) return;
    const status = await byggStatus(moteId);
    const melding = JSON.stringify(status);
    for (const klient of settet) {
        if (klient.readyState === 1) {
            klient.send(melding);
        }
    }
}

async function byggStatus(moteId) {
    const moter = await hentMoter();
    const mote = finnMote(moter, moteId);
    if (!mote) {
        return { feil: 'Fant ikke møtet' };
    }
    const aktivt = finnPunkt(mote, mote.aktivtPunktId);
    let neste = null;
    if (aktivt) {
        const indeks = mote.kjoreplan.findIndex((k) => k.id === mote.aktivtPunktId);
        if (indeks !== -1 && mote.kjoreplan[indeks + 1]) {
            neste = mote.kjoreplan[indeks + 1];
        }
    } else if (mote.kjoreplan.length > 0) {
        neste = mote.kjoreplan[0];
    }

    return {
        aktivt: aktivt ? { tittel: aktivt.tittel, type: kjoreplanTypeNavn(aktivt.type), notat: aktivt.notat } : null,
        neste: neste ? { tittel: neste.tittel, type: kjoreplanTypeNavn(neste.type) } : null,
    };
}

module.exports = { settOpp, kringkastOppdatering };
