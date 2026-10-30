import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, MapPin, Search, X } from "lucide-react";
import { findCity, searchCities, CITIES, cityKey, registerCity, type City } from "@/lib/cities";
import { searchNominatimDe } from "@/lib/nominatim";
import { t, useLang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type MenuBox = { left: number; width: number; top?: number; bottom?: number; maxHeight: number };

export function CitySelect({
  value,
  onChange,
  label,
  placeholder,
  allowEmpty = true,
  warnUnmatched = true,
  compactMenu = false,
}: {
  value: string;
  onChange: (name: string) => void;
  label?: string;
  placeholder?: string;
  allowEmpty?: boolean;
  warnUnmatched?: boolean;
  compactMenu?: boolean;
}) {
  useLang();
  const ph = placeholder ?? t("cityPh");
  const id = useId();
  const listId = `${id}-list`;
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [active, setActive] = useState(0);
  const [menuBox, setMenuBox] = useState<MenuBox | null>(null);
  const resolved = findCity(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const node = e.target as Node;
      if (rootRef.current?.contains(node) || menuRef.current?.contains(node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const local = useMemo(() => searchCities(draft, 14), [draft]);
  const [remote, setRemote] = useState<City[]>([]);
  useEffect(() => {
    const q = draft.trim();
    if (q.length < 2) {
      setRemote([]);
      return;
    }
    if (local.length >= 8) {
      setRemote([]);
      return;
    }
    let alive = true;
    const timer = window.setTimeout(() => {
      void searchNominatimDe(q, 8).then((hits) => {
        if (!alive) return;
        setRemote(
          hits.map((h) => ({
            name: h.name,
            lat: h.lat,
            lng: h.lng,
            state: h.state || "",
            postalCode: h.postalCode,
          })),
        );
      });
    }, 220);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [draft, local.length]);
  const matches = useMemo(() => {
    const out: City[] = [...local];
    const seen = new Set(local.map((c) => c.name.toLowerCase()));
    for (const c of remote) {
      const k = c.name.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(c);
    }
    return out.slice(0, 14);
  }, [local, remote]);
  const unmatched = draft.trim().length > 0 && !findCity(draft);

  useLayoutEffect(() => {
    if (!open) {
      setMenuBox(null);
      return;
    }
    // Pflicht-Attribution (mobil direkt unter der Suche) nie verdecken: Liste darunter beginnen.
    function belowAttribution(input: DOMRect) {
      let top = input.bottom + 4;
      const a = document.querySelector(".leaflet-control-attribution")?.getBoundingClientRect();
      if (a && a.height > 1 && a.bottom > top - 4 && a.top < top + 60 && Math.min(input.right, a.right) > Math.max(input.left, a.left)) top = a.bottom + 4;
      return top;
    }
    function keepClearBounds(input: DOMRect) {
      let reservedTop = 8;
      let reservedBottom = 8;
      document.querySelectorAll("[data-bl-keep-clear]").forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        const root = rootRef.current;
        if (root && (root.contains(node) || node.contains(root))) return;
        const b = node.getBoundingClientRect();
        if (b.width < 2 || b.height < 2) return;
        const overlapX = Math.min(input.right, b.right) - Math.max(input.left, b.left);
        const sameColumn = overlapX > 8;
        const beside = b.left >= input.right - 4 || b.right <= input.left + 4;
        if (beside && !sameColumn) return;
        if (b.bottom <= input.top + 10) reservedTop = Math.max(reservedTop, b.bottom + 8);
        else if (b.top >= input.bottom - 10) reservedBottom = Math.max(reservedBottom, window.innerHeight - b.top + 8);
        else if (b.top < input.top) reservedTop = Math.max(reservedTop, b.bottom + 8);
        else reservedBottom = Math.max(reservedBottom, window.innerHeight - b.top + 8);
      });
      return { reservedTop, reservedBottom };
    }
    function place() {
      const el = rootRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const { reservedTop, reservedBottom } = keepClearBounds(r);
      const spaceBelow = window.innerHeight - r.bottom - reservedBottom;
      const spaceAbove = r.top - reservedTop;
      const cap = compactMenu ? 168 : 248;
      const openUp = spaceBelow < 132 && spaceAbove > spaceBelow;
      const maxHeight = Math.max(88, Math.min(cap, openUp ? spaceAbove : spaceBelow));
      setMenuBox({
        left: Math.max(8, Math.min(r.left, window.innerWidth - Math.min(r.width, window.innerWidth - 16) - 8)),
        width: Math.min(r.width, window.innerWidth - 16),
        maxHeight,
        ...(openUp ? { bottom: window.innerHeight - r.top + 4 } : { top: belowAttribution(r) }),
      });
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, compactMenu, draft]);

  function pick(city: City) {
    const saved = registerCity(city);
    const next = cityKey(saved);
    onChange(next);
    setDraft(city.postalCode ? `${city.postalCode} ${city.name}` : next);
    setOpen(false);
  }

  function clear() {
    onChange("");
    setDraft("");
    setOpen(true);
    inputRef.current?.focus();
  }

  function commitOrWarn() {
    const exact = findCity(draft);
    if (exact) {
      onChange(exact.name);
      setDraft(exact.name);
    } else if (draft.trim() && !allowEmpty) {
      onChange("");
    }
    setOpen(false);
  }

  const list =
    open && menuBox ? (
      <ul
        ref={menuRef}
        id={listId}
        role="listbox"
        style={{
          position: "fixed",
          left: menuBox.left,
          width: menuBox.width,
          top: menuBox.top,
          bottom: menuBox.bottom,
          maxHeight: menuBox.maxHeight,
          zIndex: 80,
        }}
        className="overflow-y-auto rounded-lg bg-bg-elevated py-1 shadow-panel ring-1 ring-border"
      >
        {matches.length === 0 ? (
          <li className="px-3 py-3 text-sm text-muted">
            {t("noCityHits", { n: CITIES.length.toLocaleString(undefined) })}
          </li>
        ) : (
          <>
            {unmatched ? (
              <li className="px-3 py-1.5 text-[11px] tracking-wide text-stale uppercase">{t("didYouMean")}</li>
            ) : !draft.trim() ? (
              <li className="px-3 py-1.5 text-[11px] tracking-wide text-muted uppercase">{t("popular")}</li>
            ) : null}
            {matches.map((c, i) => {
              const selected = cityKey(c) === (resolved ? cityKey(resolved) : value);
              return (
                <li key={`${c.name}-${c.state}-${c.postalCode ?? i}`}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => pick(c)}
                    className={cn(
                      "flex min-h-11 w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm",
                      i === active ? "bg-surface-2 text-fg" : "text-fg hover:bg-surface",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {c.postalCode ? `${c.postalCode} ${c.name}` : c.name}
                      </span>
                      <span className="block truncate text-xs text-muted">{c.state}</span>
                    </span>
                    {selected ? <Check className="size-4 shrink-0 text-primary" /> : null}
                  </button>
                </li>
              );
            })}
            <li className="border-t border-border px-3 py-1.5 text-[11px] text-subtle">
              {t("placesFooter", { n: CITIES.length.toLocaleString(undefined) })}
            </li>
          </>
        )}
      </ul>
    ) : null;

  return (
    <div ref={rootRef} className="relative">
      {label ? (
        <label htmlFor={id} className="mb-1 block text-xs font-medium text-muted">
          {label}
        </label>
      ) : null}
      <div
        className={cn(
          "flex items-center gap-2 ring-1",
          compactMenu ? "bl-tap h-11 rounded-[10px] bg-chrome px-4 text-chrome-fg shadow-[var(--shadow-btn)] ring-border" : "h-11 rounded-full bg-surface px-3 ring-border",
          open && "ring-2 ring-fg/25",
          warnUnmatched && unmatched && open === false && draft.trim() && "ring-2 ring-bad/60",
        )}
      >
        {compactMenu ? (
          <Search className="size-4 shrink-0 text-muted" aria-hidden />
        ) : (
          <MapPin className="size-4 shrink-0 text-muted" />
        )}
        <input
          ref={inputRef}
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          value={draft}
          placeholder={ph}
          autoComplete="off"
          spellCheck={false}
          onFocus={(e) => {
            setOpen(true);
            setActive(0);
            if (compactMenu) e.currentTarget.select();
          }}
          onBlur={() => {
            window.setTimeout(commitOrWarn, 120);
          }}
          onChange={(e) => {
            const v = e.target.value;
            setDraft(v);
            setOpen(true);
            setActive(0);
            onChange(v);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActive((i) => Math.min(i + 1, Math.max(0, matches.length - 1)));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (matches[active]) pick(matches[active]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          className={cn("h-11 min-w-0 flex-1 bg-transparent text-fg outline-none", compactMenu ? "text-left text-[15px] placeholder:text-muted" : "text-base placeholder:text-subtle md:text-sm")}
        />
        {allowEmpty && (value || draft) ? (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={clear}
            className={cn(
              "bl-tap grid shrink-0 place-items-center text-muted hover:text-fg",
              compactMenu ? "-mr-3 size-11 rounded-full" : "size-11 rounded-md",
            )}
            aria-label={t("clearPlace")}
          >
            <X className="size-3.5" />
          </button>
        ) : null}
        {compactMenu ? null : (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setOpen((o) => !o);
            inputRef.current?.focus();
          }}
          className="bl-tap grid size-11 place-items-center rounded-md bg-surface-2 text-muted hover:text-fg"
          aria-label={t("showCities")}
        >
          <ChevronDown className={cn("size-4 transition-transform duration-150", open && "rotate-180")} />
        </button>
        )}
      </div>
      {warnUnmatched && unmatched && !open ? (
        <p className="mt-1 text-xs text-bad">{t("noCity")}</p>
      ) : null}
      {list && typeof document !== "undefined" ? createPortal(list, document.body) : null}
    </div>
  );
}
