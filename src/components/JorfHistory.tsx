import Link from "next/link";
import { label } from "@/components/ui";
import { type ArticleJorfRow, type JorfRelation, jorfForArticle, jorfUrl } from "@/lib/jorf";

const GROUPS: { relation: JorfRelation; title: string; max: number }[] = [
  { relation: "abroge", title: "Abrogation prévue par", max: 3 },
  { relation: "modifie", title: "Modifié par", max: 5 },
  { relation: "cree", title: "Créé par", max: 3 },
  { relation: "deplace", title: "Déplacé par", max: 2 },
  { relation: "codifie", title: "Issu de", max: 3 },
  { relation: "cite", title: "Renvoie à", max: 5 },
];

const frDate = (d: string | null) => (d ? new Date(`${d}T12:00:00Z`).toLocaleDateString("fr-FR", { timeZone: "UTC" }) : "");

/** "Au Journal officiel" aside of an article: the official texts that created, modified, repealed or are cited by it. */
export default function JorfHistory({ articleId }: { articleId: string }) {
  const rows = jorfForArticle(articleId);
  if (!rows.length) return null;
  const by = (r: JorfRelation) => {
    const seen = new Set<string>();
    return rows.filter((x) => x.relation === r && !seen.has(x.id) && seen.add(x.id));
  };
  return (
    <div className="border-t-2 border-fg pt-4">
      <h2 className={`${label} text-fg-2`}>Au Journal officiel</h2>
      <dl className="mt-3 space-y-4 text-sm">
        {GROUPS.map(({ relation, title, max }) => {
          const list = by(relation);
          if (!list.length) return null;
          return (
            <div key={relation}>
              <dt className="font-mono text-xs uppercase text-fg-2">{title}</dt>
              {list.slice(0, max).map((t: ArticleJorfRow) => (
                <dd key={t.id} className="mt-1">
                  <Link href={jorfUrl(t.id)} className="font-semibold underline decoration-rule underline-offset-2 hover:decoration-signal">
                    {t.titre}
                  </Link>
                  {t.jorf_article && <span className="text-fg-2">, art. {t.jorf_article}</span>}
                  {t.date_publi && <span className="block text-xs text-fg-2">JO du {frDate(t.date_publi)}</span>}
                </dd>
              ))}
              {list.length > max && <dd className="mt-1 text-xs text-fg-2">et {list.length - max} autre{list.length - max > 1 ? "s" : ""}</dd>}
            </div>
          );
        })}
      </dl>
    </div>
  );
}
