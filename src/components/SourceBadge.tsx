import { ExternalLink } from "lucide-react";
import { LICENCE_LABEL, MATCH_LABEL, type Licence, type MatchQuality } from "@/lib/sources";

/**
 * Provenance of one data block: source name, licence, retrieval date and match quality.
 * Every sourced block on a company/address page carries one, so a claim is always traceable.
 */
export function SourceBadge({
  name,
  url,
  licence,
  retrievedAt,
  matchQuality,
  note,
}: {
  name: string;
  url: string;
  licence: Licence;
  retrievedAt?: number | null;
  matchQuality?: MatchQuality;
  note?: string;
}) {
  const date = retrievedAt ? new Date(retrievedAt * 1000).toLocaleDateString("fr-FR") : undefined;
  return (
    <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-rule pt-3 text-xs text-fg-2">
      <span>
        Source :{" "}
        <a href={url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
          {name}
        </a>{" "}
        · {LICENCE_LABEL[licence]}
        {date && <> · données récupérées le {date}</>}
      </span>
      {matchQuality && (
        <span className="border border-fg-2 px-1.5 py-0.5 font-mono text-[0.6875rem] uppercase" title={MATCH_LABEL[matchQuality]}>
          {matchQuality}
        </span>
      )}
      {note && <span className="basis-full">{note}</span>}
      <ExternalLink aria-hidden className="size-3" />
    </p>
  );
}
