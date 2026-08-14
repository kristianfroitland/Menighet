#!/usr/bin/env node
const bcrypt = require('bcryptjs');
const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

console.log('');
console.log('Lag et passord-hash til .env (ADMIN_PASSORD_HASH eller TEAM_PASSORD_HASH)');
console.log('');

rl.question('Skriv inn passordet: ', (passord) => {
    rl.close();
    if (!passord) {
        console.log('Ingen passord skrevet inn — avbryter.');
        process.exit(1);
    }
    const hash = bcrypt.hashSync(passord, 10);
    console.log('');
    console.log('Kopier denne verdien inn i .env:');
    console.log('');
    console.log(hash);
    console.log('');
});
