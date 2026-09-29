import type { SVGProps } from "react";

// Original Loilà drawings. A 32-unit grid and deliberately off-axis silhouettes.
// Keep interiors open: these also appear at 14–16px beside article labels.
const drawings: Record<string, React.ReactNode> = {
  travail: <><path d="m5 12 22-2 1 16-23 1Z" /><path d="m11 11-.4-5 9-1 .5 5M5 17q11 5 22-1M15 18v4" /><path d="m24 3 1 3m4-2-2 2" /></>,
  urbanisme: <><path d="m3 27 26-2M6 26V15l8-5v16m0-18 11-4v21M9 18v2m10-10v2m2 5v2" /><path d="m3 7 6-2m-3-2 1 5M26 10l3 2-3 2" /></>,
  logement: <><path d="M5 15 16 4l12 9M8 13v14l17-1V13" /><circle cx="16" cy="16" r="3" /><path d="m16 19 1 6m0-3h3M4 5l1 3m-4 1 3 1" /></>,
  copropriete: <><path d="m4 27 1-19 10-3 1 21m0-13 10-3 2 17M3 28l26-1M9 11v2m1 5v2m10-3v2m3 4v3" /><path d="M19 5q1-4 3-1 3-2 3 1t-4 4Z" /></>,
  construction: <><path d="M5 22q-1-12 10-13m4 0q9 2 8 12M3 23l26-2v5L3 28ZM13 19l1-13 6-1-1 14M8 15l1 4m15-5-1 4" /><path d="m4 5 2 3m-5 3 3 1M26 3l-2 3" /></>,
  diagnostics: <><path d="M3 14 13 4l8 7M6 12v15h10" /><circle cx="22" cy="20" r="6" /><path d="m26 25 3 4m-7-9 2-3M10 14h4m-4 4h3m-3 4h2" /></>,
  conventions: <><path d="m7 8 18-4 3 20-19 4ZM4 6 3 25l3 1M12 12l9-2m-8 6 7-1m-7 5 2 2 7-6" /><path d="m3 1 1 2m23-2 1 2" /></>,
};

export const hasThemeIcon = (slug: string) => Object.hasOwn(drawings, slug);

type ThemeIconProps = SVGProps<SVGSVGElement> & { slug: string; size?: string | number };

export default function ThemeIcon({ slug, size = 24, strokeWidth = 1.8, ...props }: ThemeIconProps) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}>
      {drawings[slug] ?? drawings.conventions}
    </svg>
  );
}
