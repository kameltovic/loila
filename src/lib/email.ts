// Transactional email via Sweego's HTTP API (POST https://api.sweego.io/send, header Api-Key).
const FROM = process.env.EMAIL_FROM ?? "Loilà <connexion@loila.fr>";

function parseFrom(s: string) {
  const m = s.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return m ? { name: m[1], email: m[2] } : { name: "Loilà", email: s.trim() };
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export async function sendMagicLink(to: string, link: string): Promise<boolean> {
  const key = process.env.SWEEGO_API_KEY;
  if (!key) {
    console.log(`[email] SWEEGO_API_KEY missing, magic link for ${to}: ${link}`);
    return true;
  }
  const subject = "Votre lien de connexion à Loilà";
  const text = `Bonjour,\n\nCliquez sur ce lien pour vous connecter à Loilà :\n${link}\n\nIl est valable 15 minutes et ne fonctionne qu'une fois.\nSi vous n'avez rien demandé, ignorez cet e-mail.\n\nLoilà — le droit du quotidien, expliqué simplement.`;
  const url = escapeHtml(link);
  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#f6f4ef;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1f2937">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:480px;background:#fff;border-radius:12px;padding:32px">
<tr><td style="font-size:22px;font-weight:700;padding-bottom:16px">Loilà</td></tr>
<tr><td style="font-size:16px;line-height:1.5;padding-bottom:24px">Bonjour,<br>Cliquez sur le bouton ci-dessous pour vous connecter.</td></tr>
<tr><td style="padding-bottom:24px"><a href="${url}" style="display:inline-block;background:#1f2937;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">Me connecter</a></td></tr>
<tr><td style="font-size:13px;line-height:1.5;color:#6b7280">Ce lien est valable 15 minutes et ne fonctionne qu'une fois. Si vous n'avez rien demandé, ignorez cet e-mail.<br><br>Lien direct : <a href="${url}" style="color:#6b7280">${url}</a></td></tr>
</table></td></tr></table></body></html>`;

  try {
    const res = await fetch("https://api.sweego.io/send", {
      method: "POST",
      headers: { "Api-Key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        channel: "email",
        provider: "sweego",
        recipients: [{ email: to }],
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
