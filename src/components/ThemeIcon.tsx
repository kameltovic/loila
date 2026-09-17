import { Briefcase, Building, Building2, Gauge, HardHat, KeyRound, ScrollText, type LucideProps } from "lucide-react";

const ICONS = { travail: Briefcase, urbanisme: Building2, logement: KeyRound, conventions: ScrollText, copropriete: Building, construction: HardHat, diagnostics: Gauge };

export default function ThemeIcon({ slug, ...props }: { slug: string } & LucideProps) {
  const Icon = ICONS[slug as keyof typeof ICONS] ?? ScrollText;
  return <Icon aria-hidden strokeWidth={1.75} {...props} />;
}
