# SCUTE launch site (Vercel)

```
index.html          the page: scroll story, registration form, share buttons
frames/             151 animation frames for desktop (~11MB)
frames_m/           the same frames cropped for phones (~4MB), picked automatically
assets/             SCUTE marks, icons, email logo
og.jpg              preview image shown when the link is shared
api/register.js     serverless function: saves sign-ups in Brevo, sends the welcome email
vercel.json         caching for frames and assets
.env.example        the settings the function needs (never commit real values)
```

## How registration works

Form → `POST /api/register` (same site, on Vercel) → Brevo

1. Saves or updates the person as a Brevo contact (name, phone, country, colour, sizes, designs, consent).
2. Adds them to your "SCUTE early access" list if they ticked "Email me SCUTE launch news".
3. Sends "Welcome to SCUTE" the first time they register (not on repeat sign-ups).
4. Emails your team an alert.

## 1. Brevo (once)

1. **Senders, Domains & Dedicated IPs → Domains**: add your SCUTE domain and add the DNS records Brevo shows (DKIM + DMARC), so the welcome email doesn't land in spam.
2. **Senders**: add and verify the from-address, e.g. `hello@yourdomain`.
3. **Contacts → Lists**: create **SCUTE early access** and note its ID number.
4. **Contacts → Settings → Contact attributes**: add these as *Text* attributes:
   `FULL_NAME, PHONE, COUNTRY, COLOUR, SIZES, DESIGNS, CONSENT, SOURCE`
   (`FIRSTNAME` and `LASTNAME` already exist.)
5. **SMTP & API → API keys**: generate a key and copy it.

## 2. Deploy on Vercel

Either:
- **GitHub**: push this folder to a new repo, then in Vercel choose **Add New → Project → Import** that repo. Framework preset: **Other**. No build command, output directory left empty.
- **CLI**: in this folder run `npx vercel` (then `npx vercel --prod`).

Then in **Project → Settings → Environment Variables** add (for Production):

| Name | Value |
|---|---|
| `BREVO_API_KEY` | the key from step 1.5 |
| `LIST_ID` | the list ID from step 1.3 |
| `SENDER_EMAIL` | the verified sender from step 1.2 |
| `SENDER_NAME` | `SCUTE` |
| `TEAM_EMAIL` | where alerts should go |
| `SITE_URL` | your live address, e.g. `https://scute.in` |

**Redeploy** after adding the variables (Deployments → ⋯ → Redeploy), because functions only pick up variables on a new deployment.

## 3. Custom domain and link previews

1. **Project → Settings → Domains**: add your domain and follow the DNS steps.
2. In `index.html`, change `content="og.jpg"` (two places near the top) to the full address, e.g. `https://scute.in/og.jpg`, so WhatsApp shows the preview image. Optionally set `SHARE_URL` to the same address.

## 4. Test

Register with your own email on the live site. You should get the welcome email, the team address should get an alert, and the contact should appear in Brevo with colour, sizes and designs filled in. If something fails, **Vercel → Project → Logs** shows the Brevo error message.

## Following up

Use **Brevo Campaigns** on the *SCUTE early access* list. Filter by `COLOUR` / `SIZES` / `DESIGNS` to target groups. Brevo adds the unsubscribe link for you.
