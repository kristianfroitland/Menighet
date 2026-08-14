# Bruker Puppeteers offisielle image som base — den har Chromium og alle
# systemavhengighetene PDF-eksporten trenger allerede riktig installert.
# Å sette dette opp manuelt på et vanlig node-image er en vanlig kilde til
# vanskelig-å-feilsøke feil ("libnss3 mangler" osv.), så vi unngår det helt.
FROM ghcr.io/puppeteer/puppeteer:22.15.0

# Image-et kjører som ikke-root-brukeren "pptruser" fra start, som er fint —
# appen vår trenger ingen root-rettigheter.
WORKDIR /app

# Kopier kun package-filene først, så Docker kan cache npm install-laget
# mellom bygg når selve koden endres men avhengighetene ikke gjør det
COPY package*.json ./

# PUPPETEER_SKIP_DOWNLOAD er allerede satt i dette base-imaget (Chromium
# følger med imaget), så "npm install" her laster IKKE ned en ekstra
# Chromium-kopi på toppen.
RUN npm install --omit=dev

COPY . .

# Deploy-panelet ditt (CapRover/Coolify) setter som regel PORT selv og
# ruter trafikk til den — 3000 er bare en fornuftig standardverdi.
ENV PORT=3000
EXPOSE 3000

# data/-mappen må kunne skrives til og bør helst kobles til et persistent
# volum i deploy-panelet ditt, slik at møter/roller/personer overlever
# omstarter og nye utrullinger.
VOLUME ["/app/data"]

CMD ["node", "server.js"]
