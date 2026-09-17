import { WizardError, followUp, synthesizeDossier, wizardRoute } from "@/lib/wizard";

// { action: "synthesize", answers } → synthesis (1 unit) · { action: "followup", question } → follow-up (1 unit).
export async function POST(request: Request, { params }: RouteContext<"/api/dossiers/[id]">) {
  const { id: dossierId } = await params;
  return wizardRoute(request, async (id, body) => {
    if (body.action === "synthesize") return synthesizeDossier(id, dossierId, body.answers);
    if (body.action === "followup") return followUp(id, dossierId, body.question);
    throw new WizardError(400, "Requête invalide.");
  });
}
