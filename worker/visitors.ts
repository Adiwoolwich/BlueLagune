// Platzhalter (rot): Implementierung folgt.
export type KV = { get<T>(k: string): Promise<T | undefined>; put(k: string, v: unknown): Promise<void>; delete(k: string | string[]): Promise<unknown>; list<T>(o: { prefix: string }): Promise<Map<string, T>> };
export class VisitorStore { constructor(_kv: KV, _now?: () => number) {} async salt(): Promise<string> { return ""; } async visit(_ip: string): Promise<void> {} async weeks(): Promise<{ week: string; visits: number; uniques: number }[]> { return []; } }
export function isoWeek(_d: string): string { return ""; }
export async function handleAdmin(..._a: unknown[]): Promise<Response> { return new Response("ok"); }
