import { SourceBadge } from "@/components/SourceBadge";
import { label } from "@/components/ui";
import { JURISDICTION_ROLE, jurisdictionsFor, type JurisdictionKind } from "@/lib/jurisdictions";
import { SOURCES, getSourceRecord } from "@/lib/sources";

const SRC = SOURCES["MINJUSTICE:competences-territoriales"];

/** "Où agir" aside: the courts territorially competent for a commune. Renders nothing without data. */
export default function JurisdictionCard({ citycode, city, kinds, note }: { citycode: string | null | undefined; city?: string | null; kinds: JurisdictionKind[]; note?: string }) {
  const rows = jurisdictionsFor(citycode).filter((j) => kinds.includes(j.kind));
  if (!rows.length) return null;
  const rec = getSourceRecord(rows[0].source_record_id ?? "");
  return (
    <div className="border-t-2 border-fg pt-4">
      <h2 className={`${label} text-fg-2`}>En cas de litige{city ? ` · ${city}` : ""}</h2>
      <ul className="mt-3 space-y-3 text-sm">
        {rows.map((j) => (
          <li key={j.kind}>
            <span className="font-semibold">{j.label}</span>
            <span className="block text-fg-2">{JURISDICTION_ROLE[j.kind]}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-fg-2">
        {note ?? "Compétence territoriale. La juridiction exacte dépend aussi de la nature et du montant du litige."}
      </p>
      <SourceBadge name={SRC.name} url={rec?.official_url ?? SRC.url} licence={SRC.licence} retrievedAt={rec?.retrieved_at} matchQuality="CERTAIN" />
    </div>
  );
}
