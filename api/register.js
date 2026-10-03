/**
 * SCUTE early access → Brevo   (Vercel serverless function: POST /api/register)
 * Saves the person as a Brevo contact, sends a "Welcome to SCUTE" email on first sign-up,
 * and alerts the team. The Brevo API key stays here on the server, never in the website.
 *
 * Environment variables (Vercel → Project → Settings → Environment Variables):
 *   BREVO_API_KEY   Brevo → SMTP & API → API keys
 *   LIST_ID         Brevo list ID for "SCUTE early access" (a number)
 *   SENDER_EMAIL    verified Brevo sender, e.g. hello@yourdomain.com
 *   SENDER_NAME     e.g. SCUTE
 *   TEAM_EMAIL      where new-registration alerts go (optional)
 *   SITE_URL        your live address, e.g. https://scute.in (optional; defaults to the site's own address)
 */
module.exports = async function handler(req, res) {
  const env = process.env;
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return send(res, 405, { ok: false, error: 'method_not_allowed' }); }
  if (!env.BREVO_API_KEY || !env.SENDER_EMAIL) return send(res, 500, { ok: false, error: 'not_configured' });
  try {
    let d = req.body;
    if (typeof d === 'string') { try { d = JSON.parse(d); } catch { d = null; } }
    if (!d || typeof d !== 'object') return send(res, 400, { ok: false, error: 'bad_request' });
    if (d.company) return send(res, 200, { ok: true });               // honeypot filled = bot; pretend success

    const clean = (v, n = 120) => String(v ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);
    const email = clean(d.email, 254).toLowerCase();
    const name = clean(d.name, 80);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return send(res, 400, { ok: false, error: 'invalid_email' });
    if (name.length < 2) return send(res, 400, { ok: false, error: 'invalid_name' });
    const consent = d.consent === true || d.consent === 'yes';

    const attributes = {
      FIRSTNAME: name.split(/\s+/)[0],
      LASTNAME: name.split(/\s+/).slice(1).join(' '),
      FULL_NAME: name,
      PHONE: clean(d.phone, 30),
      COUNTRY: clean(d.country, 60),
      COLOUR: clean(d.colour, 40),
      SIZES: clean(d.sizes, 60),
      DESIGNS: clean(d.designs, 80),
      CONSENT: consent ? 'Yes' : 'No',
      SOURCE: clean(d.source, 120) || 'website',
    };

    // 1 · create or update the contact (201 = new, 204 = already existed and was updated)
    const contact = await brevo(env, '/v3/contacts', {
      email, attributes, updateEnabled: true,
      ...(consent && env.LIST_ID ? { listIds: [Number(env.LIST_ID)] } : {}),
    });
    if (!contact.ok) {
      console.log('brevo contact error', contact.status, await contact.text());
      return send(res, 502, { ok: false, error: 'save_failed' });
    }
    const isNew = contact.status === 201;

    // 2 · welcome email, only the first time someone registers
    if (isNew) {
      const site = (env.SITE_URL || `https://${req.headers.host}`).replace(/\/$/, '');
      const r = await brevo(env, '/v3/smtp/email', {
        sender: { email: env.SENDER_EMAIL, name: env.SENDER_NAME || 'SCUTE' },
        to: [{ email, name }],
        subject: 'Welcome to SCUTE',
        htmlContent: welcomeHtml(attributes.FIRSTNAME, site),
        textContent: welcomeText(attributes.FIRSTNAME, site),
        tags: ['scute-welcome'],
      });
      if (!r.ok) console.log('brevo welcome error', r.status, await r.text());
    }

    // 3 · alert the team
    if (env.TEAM_EMAIL) {
      const lines = [['Name', name], ['Email', email], ['Phone', attributes.PHONE], ['Country', attributes.COUNTRY],
        ['Colour', attributes.COLOUR], ['Sizes', attributes.SIZES], ['Designs', attributes.DESIGNS],
        ['Launch emails', attributes.CONSENT], ['Returning', isNew ? 'No' : 'Yes (details updated)']];
      const r = await brevo(env, '/v3/smtp/email', {
        sender: { email: env.SENDER_EMAIL, name: env.SENDER_NAME || 'SCUTE' },
        to: [{ email: env.TEAM_EMAIL }],
        subject: `${isNew ? 'New' : 'Updated'} SCUTE registration: ${name}`,
        textContent: lines.map(([k, v]) => `${k}: ${v || '-'}`).join('\n'),
        tags: ['scute-alert'],
      });
      if (!r.ok) console.log('brevo alert error', r.status, await r.text());
    }

    return send(res, 200, { ok: true, new: isNew });
  } catch (err) {
    console.log('register error', err);
    return send(res, 500, { ok: false, error: 'server_error' });
  }
};

function send(res, status, obj) {
  res.status(status).setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  return res.send(JSON.stringify(obj));
}

function brevo(env, path, body) {
  return fetch('https://api.brevo.com' + path, {
    method: 'POST',
    headers: { 'api-key': env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
  });
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function welcomeText(first, site) {
  return `Hi ${first},

You're in. Welcome to SCUTE.

SCUTE is a different kind of footwear: an open, 3D-printed lattice built around air, so your feet stay cool and comfortable in motion.

As an early-access member you'll hear before anyone else when the first release opens, and your picks help shape what we make first.

Know someone who'd want a pair? Forward them ${site || 'our site'}.

SCUTE · Engineered to breathe`;
}

function welcomeHtml(first, site) {
  const logo = site ? `${site}/assets/email-lockup.png` : '';
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"><title>Welcome to SCUTE</title></head>
<body style="margin:0;padding:0;background:#050506;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#050506;"><tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
  <tr><td align="center" style="padding:8px 0 36px;">
    ${logo ? `<img src="${esc(logo)}" width="280" alt="SCUTE · Engineered to breathe" style="display:block;width:280px;max-width:80%;height:auto;border:0;">`
           : `<div style="font:700 28px/1 Arial,sans-serif;letter-spacing:8px;color:#f1f0ec;">SCUTE</div>`}
  </td></tr>
  <tr><td style="border-top:1px solid #2a2b2d;padding:36px 8px 8px;font-family:Arial,Helvetica,sans-serif;color:#f1f0ec;">
    <p style="margin:0 0 6px;font-size:11px;letter-spacing:4px;text-transform:uppercase;color:#8d8f92;">Early access</p>
    <h1 style="margin:0 0 22px;font-size:30px;line-height:1.15;letter-spacing:1px;text-transform:uppercase;font-weight:400;color:#f1f0ec;">You're in, ${esc(first)}.</h1>
    <p style="margin:0 0 16px;font-size:16px;line-height:1.65;color:#c9c8c3;">Welcome to SCUTE, a different kind of footwear. An open, 3D-printed lattice built around air, so comfort keeps breathing while you move.</p>
    <p style="margin:0 0 28px;font-size:16px;line-height:1.65;color:#c9c8c3;">As an early-access member you'll hear before anyone else when the first release opens. The colour, sizes and designs you picked help shape what we make first.</p>
    ${site ? `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#f1f0ec;border-radius:2px;">
      <a href="${esc(site)}" style="display:inline-block;padding:15px 26px;font:12px/1 Arial,sans-serif;letter-spacing:3px;text-transform:uppercase;color:#050506;text-decoration:none;">Forward SCUTE to a friend &rarr;</a>
    </td></tr></table>` : ''}
  </td></tr>
  <tr><td style="padding:44px 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#6d6f72;">
    SCUTE &middot; Engineered to breathe
  </td></tr>
</table></td></tr></table></body></html>`;
}
