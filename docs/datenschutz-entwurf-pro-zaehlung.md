# ENTWURF – Datenschutz-Absatz „Pro-Europa-Test: anonyme Zählung“

> **⚠ FÜR LEX: Bitte vor jedem Live-Gang prüfen.** Nicht veröffentlicht, nicht in der App eingebaut.
> Stand 30.10.2026, Build (miniHard), Branch minihard/pro-europa. Grundlage: Lex' Baustein „Besuchs- und Testzählung“ (`/workspace/legal/bluelagune-recht-20261030.md`, Frage 4c), an die Umsetzung angepasst.

## DE
**Test „Pro Europa“ (anonyme Zählung):** Wir testen bis zum 27.11.2026, ob Interesse an einem geplanten Angebot „Pro Europa“ besteht. Dazu zählen wir nur, wie oft der Hinweis „Pro Europa“ angezeigt und wie oft „Interesse zeigen“ angetippt wurde, getrennt nach Testvariante (Europa/Frankreich), als Tagessumme. Wir setzen dafür keine Cookies, speichern nichts auf deinem Gerät und speichern weder IP-Adresse noch eine Kennung, einen Hashwert oder Browserangaben. Für die Übermittlung wird deine IP-Adresse technisch kurzzeitig von unserem Hoster Cloudflare verarbeitet (Art. 6 Abs. 1 lit. f DSGVO; berechtigtes Interesse: Weiterentwicklung des Angebots). Die Tagessummen enthalten keine personenbezogenen Daten. Der Test endet am 27.11.2026.

## Prüfpunkte für Lex
1. § 25 TDDDG: Der Zähler „Hinweis gesehen“ wird vom Browser beim Einblenden gesendet, nicht durch eine Nutzerhandlung. Reicht Abs. 2 Nr. 2, oder sollte nur der Klick „Interesse zeigen“ gezählt und „gesehen“ serverseitig ermittelt werden? (Frage 4b)
2. Cloudflare als Auftragsverarbeiter / Drittland (Hosting-Baustein, DPF-Status offen).
3. Kein Rate-Limit (bewusst, um keinen IP-Hash zu bilden). Manipulation der Zahlen ist möglich – nur für die Aussagekraft relevant.
4. Enddatum 27.11.2026 nennen; Verlängerung nach Business-Plan wäre eine Textänderung.

## EN / NL
Folgt nach Freigabe des DE-Texts.

## Übernommen aus Lex-QS 30.10.2026 (DE wörtlich, EN/NL übersetzt – FÜR LEX: EN/NL prüfen)
Im Code: `privacyProP` in src/lib/i18n.ts, angezeigt auf der Datenschutzseite.

> **Anonyme Tageszähler (Test „Pro Europa“):** Wenn dir der Hinweis „Pro Europa“ angezeigt wird, du auf „Interesse zeigen“ tippst oder welche Variante (Europa/Frankreich) du siehst, erhöht unser Server (Cloudflare Workers) einen Zähler für den jeweiligen Tag. Wir speichern dabei keine IP-Adresse, keinen Hash, keine Kennung und keine Cookies und lesen nichts aus deinem Gerätespeicher; deine IP-Adresse wird technisch bedingt nur kurz für die Übertragung verarbeitet. Es entstehen nur Summen pro Tag, die keinen Bezug zu dir haben. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (unser Interesse, herauszufinden, ob genug Nachfrage für Pro Europa besteht). Der Test endet am 27.11.2026.
