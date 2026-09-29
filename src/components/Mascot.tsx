import type { SVGProps } from "react";

/** « Alinéa »: a folded law page, getting up to lend a hand. */
export default function Mascot(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 180 180" fill="none" aria-hidden="true" focusable="false" {...props}>
      <g stroke="#0e0e0e" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="m69 129-5 24m42-26 6 24" stroke="#f4f0e8" />
        <path d="M64 147q-16-2-22 10-1 5 8 5h22l-1-13ZM110 147q17-3 23 8 3 6-7 7h-19l-2-13Z" fill="#ff4a1c" />
        <path d="M48 88Q27 99 24 81m109-9q19 0 20-21" stroke="#f4f0e8" />
        <path d="m22 82-5-7m7 6 1-10m126-19-4-7m6 6 5-7" stroke="#f4f0e8" />
        <path d="m49 32 65-7 23 24-9 82-80 6Z" fill="#f4f0e8" />
        <path d="m114 25-2 27 25-3" fill="#9dc4ff" />
        <path d="m59 45 25-3m-26 9 15-1" strokeWidth="2.5" />
        <ellipse cx="76" cy="76" rx="4" ry="7" fill="#0e0e0e" stroke="none" />
        <ellipse cx="105" cy="73" rx="4" ry="7" fill="#0e0e0e" stroke="none" />
        <path d="M80 90q9 10 18-2" />
        <path d="m62 113 43-4m-43 12 27-2" strokeWidth="2.5" />
        <path d="m144 25 5-8m5 15 9-2" stroke="#ff4a1c" />
      </g>
    </svg>
  );
}
