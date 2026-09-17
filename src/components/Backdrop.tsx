import { Scale, Stamp } from "lucide-react";
import ThemeIcon from "@/components/ThemeIcon";

// Theme colour as literal classes (Tailwind only generates classes it can read in source).
const TEXT: Record<string, string> = {
  travail: "text-travail",
  urbanisme: "text-urbanisme",
  logement: "text-logement",
  conventions: "text-conventions",
  copropriete: "text-copropriete",
  construction: "text-construction",
  diagnostics: "text-diagnostics",
};

const WORDS: Record<string, string[]> = {
  travail: ["Contrat", "Congés", "Salaire"],
  urbanisme: ["Permis", "PLU", "Travaux"],
  logement: ["Bail", "Loyer", "Préavis"],
  conventions: ["IDCC", "Branche", "Salaire"],
  copropriete: ["Syndic", "AG", "Charges"],
  construction: ["Chantier", "Décennale", "Devis"],
  diagnostics: ["DPE", "Amiante", "Plomb"],
};

/**
 * Decorative background for reading pages: giant theme-coloured words and line icons in the side gutters.
 * Purely visual (aria-hidden, no pointer events) and wide screens only, so it never competes with the text.
 */
export default function Backdrop({ theme, words }: { theme: string; words?: string[] }) {
  const [w1, w2, w3] = [...(words ?? []), ...(WORDS[theme] ?? ["Loi", "Article", "Droit"])];
  const color = TEXT[theme] ?? "text-fg";
  const word = "absolute font-display font-extrabold leading-[0.8] tracking-[-0.05em] whitespace-nowrap uppercase opacity-[0.13]";
  const icon = "absolute opacity-[0.12]";
  // Sticky layer: the decor follows the reader down the page instead of leaving empty stretches.
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 -z-10 hidden overflow-clip select-none xl:block ${color}`}>
      <div className="sticky top-0 h-screen">
        <span className={`${word} top-1/2 left-[max(0rem,calc(50%-44rem))] -translate-x-[38%] -translate-y-1/2 -rotate-90 text-[clamp(8rem,13vw,14rem)]`}>{w1}</span>
        <span className={`${word} top-[18%] right-[max(0rem,calc(50%-46rem))] translate-x-[30%] text-[clamp(6rem,9vw,10rem)]`}>{w2}</span>
        <span className={`${word} bottom-[8%] right-[max(0rem,calc(50%-46rem))] translate-x-[18%] text-[clamp(5rem,7vw,8rem)]`}>{w3}</span>
        <ThemeIcon slug={theme} strokeWidth={1} className={`${icon} top-[44%] right-[max(1rem,calc(50%-42rem))] size-48`} />
        <Scale strokeWidth={1} className={`${icon} top-[12%] left-[max(1rem,calc(50%-40rem))] size-32`} />
        <Stamp strokeWidth={1} className={`${icon} bottom-[10%] left-[max(1rem,calc(50%-41rem))] size-28`} />
      </div>
    </div>
  );
}
