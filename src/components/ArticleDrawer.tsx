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
                className="rounded-md bg-violet-100 px-1 font-semibold text-violet-800 no-underline hover:bg-violet-200 dark:bg-violet-400/15 dark:text-violet-200 dark:hover:bg-violet-400/25"
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
        className={`absolute inset-0 bg-slate-950/40 backdrop-blur-[2px] transition-opacity duration-300 motion-reduce:transition-none ${shown ? "opacity-100" : "opacity-0"}`}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col rounded-t-3xl bg-white shadow-2xl transition-transform duration-300 ease-out motion-reduce:transition-none sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[520px] sm:rounded-none sm:rounded-l-3xl dark:bg-slate-900 dark:ring-1 dark:ring-white/10 ${
          shown ? "translate-y-0 sm:translate-x-0" : "translate-y-full sm:translate-y-0 sm:translate-x-full"
        }`}
      >
        <header className="flex items-start gap-3 border-b border-slate-200 px-5 py-4 sm:px-7 sm:py-5 dark:border-white/10">
          <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300">
            <BookOpen className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-violet-700 dark:text-violet-300">
              {data ? data.codeName : error ? "Erreur" : <span className="inline-block h-4 w-40 animate-pulse rounded bg-slate-200 align-middle dark:bg-white/10" />}
            </p>
            <h2 id={titleId} className="mt-0.5 text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              {title}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="grid size-10 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-violet-500 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <X className="size-5" aria-hidden />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-7" aria-busy={!data && !error}>
          {error ? (
            <p role="alert" className="flex items-start gap-3 rounded-2xl bg-red-50 p-4 text-red-800 dark:bg-red-500/10 dark:text-red-300">
              <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
              Impossible de charger cet article. Réessayez ou ouvrez-le sur Légifrance.
            </p>
          ) : !data ? (
            <div className="space-y-3" aria-label="Chargement">
              {[90, 100, 95, 70, 100, 85].map((w, i) => (
                <div key={i} className="h-4 animate-pulse rounded bg-slate-200 dark:bg-white/10" style={{ width: `${w}%` }} />
              ))}
            </div>
          ) : (
            <>
              {data.section && (
                <nav aria-label="Emplacement dans le texte" className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {data.section.split(" > ").join(" › ")}
                </nav>
              )}
              <div className="mt-4 space-y-3 text-[1.0625rem] leading-relaxed text-slate-800 dark:text-slate-200">
                {data.texte
                  .split(/\n+/)
                  .filter((p) => p.trim())
                  .map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
              </div>
              {data.date_debut && (
                <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
                  Version en vigueur depuis le {new Date(data.date_debut).toLocaleDateString("fr-FR")}
                </p>
              )}
            </>
          )}
        </div>

        <footer className="flex flex-wrap gap-3 border-t border-slate-200 px-5 py-4 sm:px-7 dark:border-white/10">
          {data && (
          <a
            href={data.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            Voir sur Légifrance <ArrowUpRight className="size-4" aria-hidden />
            <span className="sr-only">(nouvel onglet)</span>
          </a>
          )}
          <a
            href={`/article/${id}`}
            className="inline-flex items-center rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5"
          >
            Ouvrir la page
          </a>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
