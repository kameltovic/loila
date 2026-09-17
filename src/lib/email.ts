// Transactional email via Sweego's HTTP API (POST https://api.sweego.io/send, header Api-Key).
const FROM = process.env.EMAIL_FROM ?? "Loilà <connexion@loila.fr>";

function parseFrom(s: string) {
  const m = s.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return m ? { name: m[1], email: m[2] } : { name: "Loilà", email: s.trim() };
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const SITE = (process.env.SITE_URL ?? "https://loila.fr").replace(/\/$/, "");

// Email design mirrors the site: paper background, ink text, heavy display headline, brutalist button with hard shadow.
// Table layout + inline styles for Outlook/Gmail. Web fonts load in Apple Mail/iOS; others fall back to Arial Black.
const INK = "#0E0E0E", PAPER = "#F4F0E8", SURFACE = "#FFFDF8", MUTED = "#5A564E", SIGNAL = "#FF4A1C";
const DISPLAY = "'Bricolage Grotesque','Arial Black','Helvetica Neue',Helvetica,Arial,sans-serif";
const BODY = "Inter,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "'SFMono-Regular',Menlo,Consolas,'Courier New',monospace";

export function emailLayout(o: {
  preheader: string; label: string; title: string; intro: string; cta: { label: string; url: string }; note?: string; rows?: [string, string][];
}) {
  const url = escapeHtml(o.cta.url);
  // `title` may contain <em> for the serif-italic accent word; everything else is escaped.
  const title = escapeHtml(o.title).replace(/&#60;em&#62;/g, `<em style="font-family:'Instrument Serif',Georgia,'Times New Roman',serif;font-style:italic;font-weight:400;letter-spacing:-0.5px">`).replace(/&#60;\/em&#62;/g, "</em>");
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light">
<title>${escapeHtml(o.label)} · Loilà</title>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@800&family=Instrument+Serif:ital@1&family=Inter:wght@400;600&display=swap" rel="stylesheet">
<style>@media (max-width:620px){.card{padding:32px 24px!important}.title{font-size:40px!important;line-height:42px!important}}</style>
</head>
<body style="margin:0;padding:0;background:${PAPER};color:${INK};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(o.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER}"><tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
  <tr><td style="padding:0 0 28px"><a href="${SITE}" style="text-decoration:none"><img src="${SITE}/og/logo.png" width="150" height="60" alt="Loilà." style="display:block;border:0;width:150px;height:60px"></a></td></tr>
  <tr><td style="background:${INK};padding:0 6px 6px 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${SURFACE};border:2px solid ${INK}"><tr><td class="card" style="padding:44px 40px">
      <p style="margin:0 0 20px;font-family:${MONO};font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${INK}"><span style="color:${SIGNAL}">&#9679;</span>&nbsp; ${escapeHtml(o.label)}</p>
      <h1 class="title" style="margin:0 0 20px;font-family:${DISPLAY};font-size:52px;line-height:52px;font-weight:800;letter-spacing:-2px;color:${INK}">${title}</h1>
      <p style="margin:0 0 32px;font-family:${BODY};font-size:17px;line-height:26px;color:${MUTED}">${escapeHtml(o.intro)}</p>
      ${o.rows?.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 32px;border-top:2px solid ${INK}">${o.rows.map(([k, v]) => `<tr><td style="padding:10px 12px 10px 0;border-bottom:1px solid #E4DFD4;font-family:${MONO};font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${MUTED};white-space:nowrap;vertical-align:top">${escapeHtml(k)}</td><td style="padding:10px 0;border-bottom:1px solid #E4DFD4;font-family:${MONO};font-size:14px;color:${INK};word-break:break-all">${escapeHtml(v)}</td></tr>`).join("")}</table>` : ""}
      <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:${INK};padding:0 4px 4px 0">
        <a href="${url}" style="display:block;background:#FFFFFF;border:2px solid ${INK};padding:15px 26px;font-family:${MONO};font-size:15px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${INK};text-decoration:none">${escapeHtml(o.cta.label)} &rarr;</a>
      </td></tr></table>
      ${o.note ? `<p style="margin:32px 0 0;padding-top:24px;border-top:1px solid #E4DFD4;font-family:${BODY};font-size:14px;line-height:22px;color:${MUTED}">${escapeHtml(o.note)}</p>` : ""}
      <p style="margin:16px 0 0;font-family:${BODY};font-size:12px;line-height:18px;color:${MUTED};word-break:break-all">Le bouton ne marche pas ? Copiez ce lien : <a href="${url}" style="color:${INK}">${url}</a></p>
    </td></tr></table>
  </td></tr>
  <tr><td style="padding:32px 4px 0;font-family:${BODY};font-size:12px;line-height:18px;color:${MUTED}">
    <strong style="font-family:${DISPLAY};font-weight:800;color:${INK};font-size:14px">Loilà<span style="color:${SIGNAL}">.</span></strong> Le droit français, enfin lisible.<br>
    Information juridique générale, pas un conseil juridique. <a href="${SITE}" style="color:${INK}">loila.fr</a>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

export async function sendMagicLink(to: string, link: string): Promise<boolean> {
  const key = process.env.SWEEGO_API_KEY;
  if (!key) {
    console.log(`[email] SWEEGO_API_KEY missing, magic link for ${to}: ${link}`);
    return true;
  }
  const subject = "Votre lien de connexion à Loilà";
  const text = `Connectez-vous à Loilà\n\nCliquez sur ce lien pour vous connecter :\n${link}\n\nIl est valable 15 minutes et ne fonctionne qu'une fois.\nSi vous n'avez rien demandé, ignorez cet e-mail.\n\nLoilà, le droit français enfin lisible. https://loila.fr`;
  const html = emailLayout({
    preheader: "Votre lien de connexion, valable 15 minutes.",
    label: "Connexion",
    title: "Votre lien de <em>connexion</em>.",
    intro: "Pas de mot de passe chez Loilà : cliquez sur le bouton ci-dessous pour accéder à votre compte.",
    cta: { label: "Me connecter", url: link },
    note: "Ce lien est valable 15 minutes et ne fonctionne qu'une fois. Si vous n'avez rien demandé, ignorez simplement cet e-mail.",
  });

  return sweego([to], subject, html, text);
}

async function sweego(to: string[], subject: string, html: string, text: string): Promise<boolean> {
  try {
    const res = await fetch("https://api.sweego.io/send", {
      method: "POST",
      headers: { "Api-Key": process.env.SWEEGO_API_KEY ?? "", "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: "email",
        provider: "sweego",
        recipients: to.map((email) => ({ email })),
        from: parseFrom(FROM),
        subject,
        "message-html": html,
        "message-txt": text,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.error("[email] sweego error", res.status, (await res.text()).slice(0, 300));
    return res.ok;
  } catch (e) {
    console.error("[email] sweego request failed", e instanceof Error ? e.message : e);
    return false;
  }
}

// Owner notifications. ADMIN_EMAILS also gates /admin (see isAdmin in auth.ts).
export const adminEmails = () => (process.env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

export type AdminNotice = { subject: string; label: string; title: string; intro: string; rows: [string, string][]; path: string };

// Mutable so tests can observe dispatch without network.
export const adminMailer = {
  async send(to: string[], n: AdminNotice) {
    const url = `${SITE}${n.path}`;
    if (!process.env.SWEEGO_API_KEY) {
      console.log(`[email] SWEEGO_API_KEY missing, admin notice for ${to.join(", ")}: ${n.subject} ${url}`);
      return;
    }
    const html = emailLayout({ preheader: n.intro, label: n.label, title: n.title, intro: n.intro, rows: n.rows, cta: { label: "Voir dans l'admin", url } });
    const text = `${n.subject}\n\n${n.intro}\n\n${n.rows.map(([k, v]) => `${k} : ${v}`).join("\n")}\n\n${url}`;
    await sweego(to, `[Loilà] ${n.subject}`, html, text);
  },
};

// Fire-and-forget: never throws, never blocks the caller (signup, webhook, checkout).
export function notifyAdmins(n: AdminNotice) {
  const to = adminEmails();
  if (!to.length) {
    console.log(`[email] ADMIN_EMAILS unset, skipped admin notice: ${n.subject}`);
    return;
  }
  try {
    adminMailer.send(to, n).catch((e) => console.error("[email] admin notice failed", e instanceof Error ? e.message : e));
  } catch (e) {
    console.error("[email] admin notice failed", e instanceof Error ? e.message : e);
  }
}
