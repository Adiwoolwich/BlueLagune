#!/usr/bin/env node
// Prebuild-Sperre: kein Produktions-Build ohne Esri-Key oder mit Mock-Satellit.
// Override für lokal/Tests: BL_ALLOW_MOCK_BUILD=1 (nur Warnung). Der Key wird nie ausgegeben.

/** @param {Record<string, string | undefined>} env */
export function checkBuildEnv(env) {
  const hasKey = typeof env.ESRI_API_KEY === "string" && env.ESRI_API_KEY.trim() !== "";
  const mockOff = env.VITE_SAT_MOCK === "0";
  const problems = [];
  if (!hasKey) problems.push("ESRI_API_KEY fehlt oder ist leer");
  if (!mockOff) problems.push(`VITE_SAT_MOCK ist nicht "0" (aktuell: ${env.VITE_SAT_MOCK === undefined ? "nicht gesetzt" : JSON.stringify(env.VITE_SAT_MOCK)})`);
  const status = `ESRI_API_KEY: ${hasKey ? "vorhanden" : "fehlt"}, VITE_SAT_MOCK: ${mockOff ? "0" : "nicht 0"}`;
  if (problems.length === 0) return { ok: true, level: "ok", message: `Build-Umgebung ok (${status}).` };
  if (env.BL_ALLOW_MOCK_BUILD === "1") {
    return { ok: true, level: "warn", message: `WARNUNG: Nicht-Produktions-Build per BL_ALLOW_MOCK_BUILD=1 (${problems.join("; ")}). NICHT deployen.` };
  }
  return {
    ok: false,
    level: "error",
    message:
      `Build abgebrochen: ${problems.join("; ")}.\n` +
      `Produktion: ESRI_API_KEY=$(grep '^ESRI_API_KEY=' /home/box/.secrets/esri.env | cut -d= -f2-) VITE_SAT_MOCK=0 npm run build\n` +
      `Lokal/Tests (Mock, nicht deployen): BL_ALLOW_MOCK_BUILD=1 npm run build`,
  };
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const r = checkBuildEnv(process.env);
  if (r.level === "error") console.error(r.message);
  else if (r.level === "warn") console.warn(r.message);
  else console.log(r.message);
  process.exit(r.ok ? 0 : 1);
}
