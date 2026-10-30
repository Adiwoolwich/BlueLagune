# Deploy (Worker `bluelagune`)

Nur nach Freigabe (Lead/User). Kein Auto-Deploy: Es gibt keinen GitHub-Workflow und keine Cloudflare-Git-Integration.

## 1. Build
- **Key-Quelle:** `ESRI_API_KEY` aus `/home/box/.secrets/esri.env` (nur diese Zeile lesen, nie ausgeben/loggen, nie ins Repo). Der Key ist eine Build-Variable (`__ESRI_API_KEY__`) und landet im Client-Bundle, er ist kein Worker-Secret.
- **Produktion:**
  ```bash
  ESRI_API_KEY=$(grep '^ESRI_API_KEY=' /home/box/.secrets/esri.env | cut -d= -f2-) VITE_SAT_MOCK=0 npm run build
  ```
- **Sperre:** `prebuild` (`scripts/check-build-env.mjs`) bricht ab, wenn `ESRI_API_KEY` fehlt oder leer ist oder `VITE_SAT_MOCK` nicht `"0"` ist. Der Key wird nur als „vorhanden/fehlt“ gemeldet. Ein direktes `npx vite build` umgeht die Sperre und ist für Deploys nicht erlaubt.
- **Override (lokal, Tests, e2e):** `npm run build:test` (= `BL_ALLOW_MOCK_BUILD=1 npm run build`) baut mit Warnung einen Mock-Build. Den nie deployen; `scripts/deploy.sh` lehnt ihn ab.

## 2. Deploy
```bash
BL_DEPLOY_AGENT=<agent> npm run deploy          # z. B. macrohard
BL_DEPLOY_AGENT=<agent> BL_DEPLOY_DRY_RUN=1 npm run deploy   # Probe ohne Upload
```
- Ruft `wrangler deploy --message "<agent>/<sha>"` auf. Die SHA kommt aus `git rev-parse --short HEAD`, bei uncommitteten Änderungen mit `-dirty`.
- `BL_DEPLOY_AGENT` ist Pflicht. Ohne `dist` oder bei einem Mock-Build (`VITE_SAT_MOCK:"0"` fehlt im Bundle) bricht das Skript ab.
- Das Skript gibt die Message und den Bundle-Namen (`index-*.js`) aus; beides für den Smoke notieren.

## 3. Smoke immer gegen die bestätigte aktive Version
1. **Vor und nach dem Smoke:** `npx wrangler deployments list`. Der neueste Eintrag muss 100 % auf der eigenen Version stehen, mit Message `<agent>/<sha>`. Steht dort eine fremde Version oder eine Message `-`: Stopp, an Lead melden.
2. **Bundle-Abgleich:** `curl -s https://blue-lagune.com/ | grep -o '/assets/index[^"]*\.js'` muss dem eigenen `dist/assets/index-*.js` entsprechen.
3. **Optional:** `curl -s https://blue-lagune.com/assets/<bundle> | grep -c 'VITE_SAT_MOCK:"0"'` liefert 1.
4. **Rollback:** `npx wrangler rollback <version-id> --message "<agent>/rollback"`.
