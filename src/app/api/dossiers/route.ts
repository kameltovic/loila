import { startDossier, wizardRoute } from "@/lib/wizard";

// Steps 1–4: story → analysis → retrieval → clarifying questions (free, rate-limited).
export async function POST(request: Request) {
  return wizardRoute(request, async (id, body) => ({ dossier: await startDossier(id, body.story) }));
}
