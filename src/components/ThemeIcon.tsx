import { Briefcase, Building2, KeyRound, ScrollText, type LucideProps } from "lucide-react";

const ICONS = { travail: Briefcase, urbanisme: Building2, logement: KeyRound, conventions: ScrollText };

export default function ThemeIcon({ slug, ...props }: { slug: string } & LucideProps) {
  const Icon = ICONS[slug as keyof typeof ICONS] ?? ScrollText;
  return <Icon aria-hidden strokeWidth={2} {...props} />;
}
