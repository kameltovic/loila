"use client";

import { createPortal } from "react-dom";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { AlertTriangle, ArrowUpRight, BookOpen, X } from "lucide-react";

type ArticleData = {
  id: string;
  num: string;
  code: string;
  codeName: string;
  section: string | null;
  texte: string;
  date_debut: string | null;
  url: string;
};

const OpenContext = createContext<((id: string) => void) | null>(null);

export function ArticleDrawerProvider({ children }: { children: React.ReactNode }) {
  const [id, setId] = useState<string | null>(null);
  const open = useCallback((next: string) => setId(next), []);
  const close = useCallback(() => setId(null), []);
  return (
    <OpenContext.Provider value={open}>
      {children}
      {id && <Drawer key={id} id={id} onClose={close} />}
    </OpenContext.Provider>
  );
}

/** Real link to /article/[id]; opens the drawer on plain left click when a provider is present. */
export function ArticleLink({ id, className, children, ...rest }: { id: string } & React.ComponentProps<"a">) {
  const open = useContext(OpenContext);
  return (
    <a
      {...rest}
      href={`/article/${id}`}
      className={className}
      onClick={(e) => {
        if (!open || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        open(id);
      }}
    >
      {children}
    </a>
  );
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Turns "art. 22" / "article L1237-19" into drawer links, only for numbers in `articles`. */
export function linkCitations(md: string, articles: { id: string; num: string }[]) {
  const byNum = new Map(articles.filter((a) => a.num).map((a) => [a.num, a.id]));
  if (!byNum.size) return md;
  const nums = [...byNum.keys()].sort((a, b) => b.length - a.length).map(escapeRe).join("|");
  // Not followed by a word char, hyphen, or ".digit" so "art. 9" never matches inside "art. 9.3".
  const re = new RegExp(`\\b(art\\.|articles?)(\\s+)(${nums})(?![\\w-]|\\.\\d)`, "gi");
  return md.replace(re, (_m, word: string, sp: string, num: string) => `[${word}${sp}${num}](#article:${byNum.get(num)})`);
}

export function ArticleMarkdown({ md, articles }: { md: string; articles: { id: string; num: string }[] }) {
  return (
    <ReactMarkdown
      components={{
        a: ({ href, children, node: _node, ...props }) => {
          void _node;
          if (href?.startsWith("#article:")) {
            return (
              <ArticleLink
                id={href.slice(9)}
                className="font-semibold underline decoration-signal decoration-2 underline-offset-4 hover:bg-signal hover:text-ink"
              >
                {children}
              </ArticleLink>
            );
          }
          return (
            <a href={href} {...props}>
              {children}
            </a>
          );
        },
      }}
    >
      {linkCitations(md, articles)}
    </ReactMarkdown>
  );
}

function Drawer({ id, onClose }: { id: string; onClose: () => void }) {
  const [data, setData] = useState<ArticleData | null>(null);
  const [error, setError] = useState(false);
  const [shown, setShown] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = `article-drawer-${id}`;

  useEffect(() => {
    let alive = true;
    fetch(`/api/article/${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: ArticleData) => alive && setData(d))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [id]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const raf = requestAnimationFrame(() => setShown(true));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusables = panelRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [onClose]);

  const title = data ? (data.num ? `Article ${data.num}` : data.section?.split(" > ").pop() || "Article") : "Article de loi";

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div
        aria-hidden
        onClick={onClose}
        className={`absolute inset-0 bg-ink/50 transition-opacity duration-300 motion-reduce:transition-none ${shown ? "opacity-100" : "opacity-0"}`}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col rounded-t-2xl border-t-2 border-fg bg-bg text-fg transition-transform duration-300 ease-out motion-reduce:transition-none sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[560px] sm:rounded-none sm:border-t-0 sm:border-l-2 ${
          shown ? "translate-y-0 sm:translate-x-0" : "translate-y-full sm:translate-y-0 sm:translate-x-full"
        }`}
      >
        <header className="flex items-start gap-3 border-b-2 border-fg px-5 py-5 sm:px-8 sm:py-7">
          <div className="min-w-0 flex-1">
            <p className="flex items-start gap-2 text-xs leading-snug font-semibold tracking-[0.16em] text-fg-2 uppercase">
              <BookOpen className="mt-px size-3.5 shrink-0" strokeWidth={1.75} aria-hidden />
              {data ? data.codeName : error ? "Erreur" : <span className="inline-block h-4 w-40 animate-pulse bg-rule align-middle" />}
            </p>
            <h2 id={titleId} className="mt-2 font-display text-4xl leading-[0.95] font-extrabold tracking-[-0.04em] sm:text-5xl">
              {title}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="grid size-11 shrink-0 place-items-center rounded-full border-2 border-fg transition hover:bg-fg hover:text-bg"
          >
            <X className="size-5" strokeWidth={1.75} aria-hidden />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-8" aria-busy={!data && !error}>
          {error ? (
            <p role="alert" className="flex items-start gap-3 border-2 border-signal bg-danger-bg p-4">
              <AlertTriangle className="mt-0.5 size-5 shrink-0" strokeWidth={1.75} aria-hidden />
              Impossible de charger cet article. Réessayez ou ouvrez-le sur Légifrance.
            </p>
          ) : !data ? (
            <div className="space-y-3" aria-label="Chargement">
              {[90, 100, 95, 70, 100, 85].map((w, i) => (
                <div key={i} className="h-4 animate-pulse bg-rule" style={{ width: `${w}%` }} />
              ))}
            </div>
          ) : (
            <>
              {data.section && (
                <nav aria-label="Emplacement dans le texte" className="border-l-2 border-signal pl-3 font-serif text-base leading-snug text-fg-2 italic">
                  {data.section.split(" > ").join(" › ")}
                </nav>
              )}
              <div className="mt-6 max-w-[62ch] space-y-4 text-[1.0625rem] leading-[1.75]">
                {data.texte
                  .split(/\n+/)
                  .filter((p) => p.trim())
                  .map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
              </div>
              {data.date_debut && (
                <p className="mt-8 border-t border-rule pt-4 text-xs font-semibold tracking-[0.12em] text-fg-2 uppercase">
                  Version en vigueur depuis le {new Date(data.date_debut).toLocaleDateString("fr-FR")}
                </p>
              )}
            </>
          )}
        </div>

        <footer className="flex flex-wrap gap-3 border-t-2 border-fg px-5 py-4 sm:px-8">
          {data && (
          <a
            href={data.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border-2 border-fg bg-fg px-4 py-2 text-sm font-semibold text-bg transition hover:bg-signal hover:text-ink"
          >
            Voir sur Légifrance <ArrowUpRight className="size-4" strokeWidth={1.75} aria-hidden />
            <span className="sr-only">(nouvel onglet)</span>
          </a>
          )}
          <a
            href={`/article/${id}`}
            className="inline-flex items-center rounded-full border-2 border-fg px-4 py-2 text-sm font-semibold transition hover:bg-fg hover:text-bg"
          >
            Ouvrir la page
          </a>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
