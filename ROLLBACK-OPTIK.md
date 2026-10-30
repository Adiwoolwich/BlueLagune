# Rollback Tesla-Optik / Besuchszählung

- Sicherung: Tag `backup-22e3d25-vor-optik` (= Stand vor dem Umbau).
- Nicht deployt. Falls später deployt und zurück nötig: `git checkout backup-22e3d25-vor-optik && npm ci && npm run build && npx wrangler deploy` (nur durch Lead/User).
- Service Worker: Cache-Namen auf `bl-app-v3` / `bl-tiles-v5` erhöht (offline-tiles.ts nutzt ebenfalls v5; Offline nur OpenFreeMap-Vektor + Schriften, kein Esri, kein Satellit) → alte Caches werden beim Aktivieren gelöscht. Ein Rollback muss die Namen erneut erhöhen (z. B. `bl-app-v4`), sonst bleibt die neue Shell im Cache.
- Besuchszählung: Der Durable Object behält die alten Schlüssel `salt` (String) und `h:<hash>` aus dem Altstand, bis der neue Code einmal läuft. Der neue Code legt `salt` als Objekt neu an. Beim ersten Aufruf erkennt er den alten Salt (kein Tagesfeld), rotiert und löscht alle `h:`-, `seen:`-, `fb:`- und `st:rl:`-Schlüssel. Der alte Gesamtzähler `count` bleibt als Zahl erhalten.
