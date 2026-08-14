const { config } = require('./config');
const { kjoreplanTypeNavn } = require('./helpers');

/** Konverterer en lokal Europe/Oslo-dato+tid til et UTC Date-objekt (håndterer sommer-/vintertid korrekt). */
function tilUtcDato(dato, tid) {
    const naivUtc = new Date(`${dato}T${tid}:00Z`);
    const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Europe/Oslo',
        hour12: false,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    const deler = fmt.formatToParts(naivUtc).reduce((acc, p) => {
        acc[p.type] = p.value;
        return acc;
    }, {});
    const time = deler.hour === '24' ? '00' : deler.hour;
    const gjettetOsloSomUtc = new Date(Date.UTC(deler.year, deler.month - 1, deler.day, time, deler.minute, deler.second));
    const offsetMs = gjettetOsloSomUtc.getTime() - naivUtc.getTime();
    return new Date(naivUtc.getTime() - offsetMs);
}

/** Formaterer et UTC Date-objekt som ICS-tidsstempel, f.eks. 20260816T090000Z. */
function icsTidsstempel(dato) {
    return dato.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

/** Escaper spesialtegn og bryter en linje til maks 75 oktetter (bytes), slik ICS-spesifikasjonen krever. */
function icsLinje(tekst) {
    const escaped = String(tekst).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
    const bytes = Buffer.from(escaped, 'utf-8');

    if (bytes.length <= 75) {
        return escaped + '\r\n';
    }

    let ut = '';
    let start = 0;
    let forsteLinje = true;
    const maks = 75;
    while (start < bytes.length) {
        // Ikke kutt midt i et multi-byte UTF-8-tegn: gå bakover til en byte
        // som ikke er en "fortsettelsesbyte" (0x80–0xBF)
        let slutt = Math.min(start + (forsteLinje ? maks : maks - 1), bytes.length);
        while (slutt < bytes.length && (bytes[slutt] & 0xc0) === 0x80) {
            slutt--;
        }
        ut += bytes.slice(start, slutt).toString('utf-8') + '\r\n';
        start = slutt;
        if (start < bytes.length) {
            ut += ' ';
        }
        forsteLinje = false;
    }
    return ut;
}

/**
 * Bygger hele .ics-innholdet for en liste med møter.
 * moter: liste med møteobjekter (fra db.hentMoter, evt. filtrert)
 * roller/personer: fulle lister, for oppslag av navn
 * kalendernavn: vises som kalenderens navn i abonnentens app
 */
function bygIcs({ moter, roller, personer, kalendernavn }) {
    const linjer = [];
    const push = (t) => linjer.push(icsLinje(t));

    push('BEGIN:VCALENDAR');
    push('VERSION:2.0');
    push(`PRODID:-//${config.kalenderDomene}//Teknikerkalender//NO`);
    push('CALSCALE:GREGORIAN');
    push('METHOD:PUBLISH');
    push('X-WR-CALNAME:' + kalendernavn);
    push('X-WR-TIMEZONE:Europe/Oslo');
    push('X-PUBLISHED-TTL:PT12H');
    push('REFRESH-INTERVAL;VALUE=DURATION:PT12H');

    const naa = icsTidsstempel(new Date());

    for (const m of moter) {
        const start = tilUtcDato(m.dato, m.tid);
        const slutt = new Date(start.getTime() + config.moteVarighetMin * 60000);

        const rolleTekster = [];
        for (const rolle of roller) {
            const navnListe = m.tildelinger
                .filter((t) => t.roleId === rolle.id)
                .map((t) => {
                    const p = personer.find((x) => x.id === t.personId);
                    return p ? p.navn : 'ikke satt';
                });
            if (navnListe.length > 0) {
                rolleTekster.push(`${rolle.navn}: ${navnListe.join(', ')}`);
            }
        }
        const bemanningTekst = rolleTekster.length > 0 ? rolleTekster.join(' · ') : 'Ingen roller bemannet ennå';
        const tittel = rolleTekster.length > 0
            ? 'Møte – ' + rolleTekster.map((r) => r.split(':')[0]).join(', ')
            : 'Møte';

        let beskrivelse = bemanningTekst;
        if (m.kjoreplan.length > 0) {
            const punkter = m.kjoreplan.slice(0, 6);
            beskrivelse += '\n\nMøteplan:\n' + punkter.map((p) => '- ' + p.tittel).join('\n');
            if (m.kjoreplan.length > 6) {
                beskrivelse += `\n… og ${m.kjoreplan.length - 6} punkt(er) til`;
            }
        }
        if (m.notat) {
            beskrivelse += '\n' + m.notat;
        }

        push('BEGIN:VEVENT');
        push(`UID:${m.id}@${config.kalenderDomene}`);
        push('DTSTAMP:' + naa);
        push('DTSTART:' + icsTidsstempel(start));
        push('DTEND:' + icsTidsstempel(slutt));
        push('SUMMARY:' + tittel);
        push('DESCRIPTION:' + beskrivelse);
        push('END:VEVENT');
    }

    push('END:VCALENDAR');
    return linjer.join('');
}

module.exports = { bygIcs, tilUtcDato, icsTidsstempel, icsLinje };
