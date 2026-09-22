import Link from "next/link";
import { SourceBadge } from "@/components/SourceBadge";
import { label } from "@/components/ui";
import { SOURCES, getSourceRecord } from "@/lib/sources";
import { housingZone } from "@/lib/zones";

const SRC = SOURCES["MTE:zonage-tlv"];
const TITLE = { 1: "Zone tendue", 2: "Zone touristique et tendue", 3: "Hors zone tendue" } as const;

/** Rental rules that depend on the commune's zoning. Renders nothing without data. */
export default function HousingZoneCard({ citycode }: { citycode: string | null | undefined }) {
  const z = housingZone(citycode);
  if (!z) return null;
  const rec = getSourceRecord(z.source_record_id ?? "");
  return (
    <div className="border-t-2 border-fg pt-4">
      <h2 className={`${label} text-fg-2`}>Location</h2>
      <p className="mt-3 font-semibold">{TITLE[z.zone]}</p>
      <p className="mt-1 text-sm text-fg-2">
        {z.zone === 1 ? (
          <>
            Logement loué vide : le locataire peut donner congé avec un{" "}
            <Link href="/article/loi-89-462/15" className="underline underline-offset-2">préavis d’un mois</Link> au lieu de trois.
            À la relocation, la hausse du loyer est encadrée (article 17 de la loi du 6 juillet 1989).
          </>
        ) : z.zone === 2 ? (
          <>La commune peut majorer la taxe d’habitation des résidences secondaires. Ce classement ne réduit pas le préavis du locataire.</>
        ) : (
          <>
            Logement loué vide : <Link href="/article/loi-89-462/15" className="underline underline-offset-2">préavis de trois mois</Link>, sauf
            cas de réduction prévus par la loi (mutation, perte d’emploi, raison de santé…).
          </>
        )}
      </p>
      <p className="mt-2 text-sm">
        <Link href="/revision-loyer" className="underline underline-offset-2">Calculer une révision de loyer (IRL)</Link>
      </p>
      <SourceBadge name={SRC.name} url={rec?.official_url ?? SRC.url} licence={SRC.licence} retrievedAt={rec?.retrieved_at} matchQuality="CERTAIN" />
    </div>
  );
}
