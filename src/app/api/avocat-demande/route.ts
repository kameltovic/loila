import { clientIp, isEmail, rateLimited, sameOrigin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { notifyAdmins } from "@/lib/email";

// Demand test for lawyer matching: store the lead, email the owners. Requests are forwarded by hand for now.
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Origine non autorisée." }, { status: 403 });
  if (rateLimited(`avocat:${clientIp(request)}`, 5, 60 * 60_000)) {
    return Response.json({ error: "Trop de demandes, réessayez plus tard." }, { status: 429 });
  }
  let body: { email?: unknown; city?: unknown; page?: unknown; website?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Requête invalide." }, { status: 400 });
  }
  if (typeof body?.website === "string" && body.website) return Response.json({ ok: true }); // honeypot
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!isEmail(email)) return Response.json({ error: "Adresse e-mail invalide." }, { status: 400 });
  const city = typeof body.city === "string" ? body.city.trim().slice(0, 80) || null : null;
  const page = typeof body.page === "string" && /^\/(sujets\/)?[a-z0-9-]+\/[a-z0-9-]+$/.test(body.page) ? body.page : null;
  if (!page) return Response.json({ error: "Requête invalide." }, { status: 400 });

  const inserted = getDb().prepare("INSERT INTO lawyer_requests (email, city, page) VALUES (?, ?, ?) ON CONFLICT(email, page) DO NOTHING").run(email, city, page).changes > 0;
  if (inserted) {
    notifyAdmins({
      subject: `Demande d'avocat : ${email}${city ? ` (${city})` : ""}`, label: "Demande d'avocat", title: "Quelqu'un cherche un <em>avocat</em>.",
      intro: "Une personne a laissé son e-mail depuis une page questions-réponses pour être mise en relation avec un avocat.",
      rows: [["E-mail", email], ["Ville", city ?? "—"], ["Page", page]], path: page,
      cta: { label: `Répondre à ${email}`, url: `mailto:${email}?subject=${encodeURIComponent("Votre demande d'avocat sur Loilà")}` },
    });
  }
  return Response.json({ ok: true, message: "C’est noté : nous revenons vers vous par e-mail." });
}
