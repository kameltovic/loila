"use client";

import { useState } from "react";
import { Check, Copy, Download, Printer } from "lucide-react";
import type { LetterField } from "@/lib/lettres";
import { label } from "@/components/ui";

const frDate = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`);
  return isNaN(+d) ? iso : d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }).replace(/^1 /, "1er ");
};

/** Fills {{name}} placeholders; empty fields show "[Label]". Two passes: a select option's text may hold placeholders itself. */
function render(body: string, fields: LetterField[], values: Record<string, string>) {
  const byName = new Map(fields.map((f) => [f.name, f]));
  const fill = (s: string) =>
    s.replace(/\{\{(\w+)\}\}/g, (_, name: string) => {
      const f = byName.get(name);
      const v = values[name]?.trim();
      if (!f) return "";
      if (f.type === "select") return f.options?.[Number(v) || 0]?.text ?? "";
      if (!v) return `[${f.label.replace(/ \(.*\)$/, "")}]`;
      return f.type === "date" ? frDate(v) : v;
    });
  return fill(fill(body));
}

const input = "w-full border-2 border-fg bg-bg px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal";
const action = "inline-flex items-center gap-2 border-2 border-fg bg-surface px-3 py-2 font-mono text-xs font-bold uppercase hover:bg-fg hover:text-bg";

export default function LetterForm({ slug, title, fields, body }: { slug: string; title: string; fields: LetterField[]; body: string }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const text = render(body, fields, values);
  const set = (name: string, v: string) => setValues((s) => ({ ...s, [name]: v }));

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const download = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    a.download = `${slug}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const print = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.title = title;
    const pre = w.document.createElement("pre");
    pre.style.cssText = "white-space:pre-wrap;font:12pt/1.5 Arial,Helvetica,sans-serif;margin:2cm";
    pre.textContent = text; // textContent: user input is never parsed as HTML
    w.document.body.appendChild(pre);
    w.print();
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <form className="grid content-start gap-4" onSubmit={(e) => e.preventDefault()} aria-label="Compléter la lettre">
        {fields.map((f) => {
          const id = `f-${f.name}`;
          return (
            <div key={f.name}>
              <label htmlFor={id} className="mb-1 block text-sm font-semibold">{f.label}</label>
              {f.type === "select" ? (
                <select id={id} className={input} value={values[f.name] ?? "0"} onChange={(e) => set(f.name, e.target.value)}>
                  {f.options?.map((o, i) => <option key={o.label} value={i}>{o.label}</option>)}
                </select>
              ) : f.type === "textarea" ? (
                <textarea id={id} rows={3} className={input} placeholder={f.placeholder} value={values[f.name] ?? ""} onChange={(e) => set(f.name, e.target.value)} />
              ) : (
                <input id={id} type={f.type} className={input} placeholder={f.placeholder} value={values[f.name] ?? ""} onChange={(e) => set(f.name, e.target.value)} />
              )}
            </div>
          );
        })}
      </form>

      <div className="lg:sticky lg:top-20 lg:self-start">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className={`${label} text-fg-2`}>Aperçu de la lettre</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={copy} data-umami-event="lettre-copy" data-umami-event-lettre={slug} className={action}>
              {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
              {copied ? "Copié" : "Copier"}
            </button>
            <button type="button" onClick={download} data-umami-event="lettre-download" data-umami-event-lettre={slug} className={action}>
              <Download aria-hidden className="size-4" /> .txt
            </button>
            <button type="button" onClick={print} data-umami-event="lettre-print" data-umami-event-lettre={slug} className={action}>
              <Printer aria-hidden className="size-4" /> Imprimer
            </button>
          </div>
        </div>
        <div aria-live="polite" className="mt-3 border-2 border-fg bg-surface p-5 font-[Arial,Helvetica,sans-serif] text-base leading-relaxed sm:text-[1.0625rem] whitespace-pre-wrap shadow-hard sm:p-8">
          {text}
        </div>
        <p className="mt-3 text-sm text-fg-2">Vos informations restent dans votre navigateur : rien n’est envoyé ni enregistré.</p>
      </div>
    </div>
  );
}
