import { isEmail } from "./auth";
import { getDb } from "./db";
import { adminEmails, adminMailer } from "./email";

export type ContactInput = { firstName: string; lastName: string; company: string | null; email: string; message: string };

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Returns the cleaned input, or a French error message. `website` is a honeypot: humans leave it empty. */
export function parseContact(body: Record<string, unknown> | null): ContactInput | { error: string } | { spam: true } {
  if (!body) return { error: "Requête invalide." };
  if (text(body.website, 200)) return { spam: true };
  const firstName = text(body.firstName, 80);
  const lastName = text(body.lastName, 80);
  const company = text(body.company, 120) || null;
  const email = text(body.email, 254).toLowerCase();
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!firstName || !lastName) return { error: "Indiquez votre prénom et votre nom." };
  if (!isEmail(email)) return { error: "Adresse e-mail invalide." };
  if (message.length < 10) return { error: "Votre message est trop court." };
  if (message.length > 5000) return { error: "Votre message est trop long (5 000 caractères au maximum)." };
  return { firstName, lastName, company, email, message };
}

/** Saves first (nothing lost if email fails), then emails the owners with a one-click reply. */
export async function submitContact(c: ContactInput): Promise<number> {
  const db = getDb();
  const id = Number(
    db.prepare("INSERT INTO contact_messages (first_name, last_name, company, email, message) VALUES (?, ?, ?, ?, ?)")
      .run(c.firstName, c.lastName, c.company, c.email, c.message).lastInsertRowid,
  );
  const to = adminEmails();
  if (!to.length) {
    console.log(`[contact] ADMIN_EMAILS unset, message #${id} saved only`);
    return id;
  }
  const name = `${c.firstName} ${c.lastName}`;
  const reply = `mailto:${c.email}?subject=${encodeURIComponent("Re: votre message à Loilà")}`;
  try {
    const sent = await adminMailer.send(to, {
      subject: `Message de ${name}${c.company ? ` (${c.company})` : ""}`,
      label: "Contact",
      title: "Un nouveau <em>message</em>.",
      intro: `${name} vous a écrit depuis le formulaire de contact.`,
      rows: [["Prénom", c.firstName], ["Nom", c.lastName], ["Entreprise", c.company ?? "—"], ["E-mail", c.email]],
      quote: c.message,
      path: "/admin#contact",
      cta: { label: `Répondre à ${c.firstName}`, url: reply },
    });
    if (sent) db.prepare("UPDATE contact_messages SET emailed = 1 WHERE id = ?").run(id);
  } catch (e) {
    console.error(`[contact] email for #${id} failed`, e instanceof Error ? e.message : e);
  }
  return id;
}
