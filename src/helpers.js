const DAGER = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag'];
const MAANEDER = ['', 'januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember'];

/** Formaterer en dato (YYYY-MM-DD) pent på norsk, f.eks. "søndag 16. august 2026". */
function formaterDato(dato) {
    const [aar, maaned, dag] = dato.split('-').map(Number);
    const d = new Date(aar, maaned - 1, dag);
    return `${DAGER[d.getDay()]} ${d.getDate()}. ${MAANEDER[d.getMonth() + 1]} ${d.getFullYear()}`;
}

const KJOREPLAN_TYPE_NAVN = {
    sang: 'Sang',
    tale: 'Tale',
    bonn: 'Bønn',
    nadverd: 'Nattverd',
    pause: 'Pause',
    annonsering: 'Annonsering',
    annet: 'Annet',
};

function kjoreplanTypeNavn(type) {
    return KJOREPLAN_TYPE_NAVN[type] || 'Annet';
}

module.exports = { formaterDato, kjoreplanTypeNavn };
