# Vorschlag: WAF-/Rate-Limiting-Regel für `/api/metric` (nur Vorschlag, NICHT angelegt)

Stand 30.10.2026, Verify-Auflage zu 048904c. Diese Datei ist ein Vorschlag; die Regel wurde **nicht** im
Cloudflare-Dashboard angelegt. Anlage nur nach Freigabe durch den User.

## Warum zusätzlich zur App-Grenze?
Die App begrenzt im Durable Object pro kurzlebigem Tages-Hash (`st:rl:mt:<hash>`, gleicher Salt wie
feedback-rl, Löschung durch den bestehenden Alarm 00:00 UTC): `pro_chip_seen` 3×/Tag, `pro_interest` 1×/Tag,
darüber `429` ohne Zählererhöhung. Eine WAF-Regel bremst Floods schon an der Kante, bevor der Worker bzw. das
DO Rechenzeit kostet, und speichert nichts in unserer App.

## Vorgeschlagene Regel (Security → WAF → Rate limiting rules)
- Name: `bl-metric-flood`
- Ausdruck: `(http.request.uri.path eq "/api/metric" and http.request.method eq "POST")`
- Zählen nach: IP (Standard-Characteristic)
- Schwelle: 10 Anfragen / 1 Minute (Free-Plan: Zeitraum 10 s → 3 Anfragen / 10 s)
- Aktion: Block, Dauer 10 Minuten (Free: 10 s), Antwort 429
- Optional zweite Regel: alle anderen Methoden außer GET/POST auf `/api/metric` → Block.

## Datenschutz
Cloudflare verarbeitet die IP dabei als Auftragsverarbeiter ohnehin für die Auslieferung; kein neues Speichern
bei uns. Vor Anlage von Lex prüfen lassen, ob die DSE (Abschnitt Hosting/Cloudflare) das abdeckt.
