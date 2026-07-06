<h1 align="center">✍️ Joansaro Contratos</h1>

<p align="center"><strong>Contract e-signature platform — visual field editor, digital signatures and certified PDFs.</strong></p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js_15-000000?style=flat-square&logo=nextdotjs&logoColor=white" alt="Next.js 15" />
  <img src="https://img.shields.io/badge/Server_Actions-000000?style=flat-square&logo=react&logoColor=61DAFB" alt="Server Actions" />
  <img src="https://img.shields.io/badge/Prisma-2D3748?style=flat-square&logo=prisma&logoColor=white" alt="Prisma" />
  <img src="https://img.shields.io/badge/SQLite-003B57?style=flat-square&logo=sqlite&logoColor=white" alt="SQLite" />
  <img src="https://img.shields.io/badge/pdf--lib-B30B00?style=flat-square&logo=adobeacrobatreader&logoColor=white" alt="pdf-lib" />
</p>

<p align="center">
  <img src="docs/screens/home.png" alt="Joansaro Contratos — dashboard" width="100%" />
</p>

## ✨ What's inside

- 📝 **Document builder** — create contracts from scratch, templates or uploaded PDFs; drop signature/text/date/checkbox fields onto any page and assign each one to a signer.
- 👥 **Multi-signer routing** — up to 5 signers per document, **sequential** (turn-based, next invite goes out automatically) or **parallel** signing order, with per-signer status tracking.
- 🖊️ **Digital signature flow** — each signer gets a personal tokenized link, draws or types their signature, and the document advances (draft → sent → partially signed → signed).
- 🔄 **Full lifecycle** — expiration dates, void, duplicate, decline with reason, per-signer reminders and link re-issue. Every action lands in the audit trail.
- 📧 **Email outbox** — invites, reminders, completion and void notices are generated for every event and browsable in a built-in demo outbox (swap one function for real SMTP).
- 📇 **Contacts directory** — signers are auto-saved as contacts with signing history, and autocomplete into the send dialog.
- 🧩 **Template variables** — `{{client_name}}`-style placeholders are detected in templates and filled through a form before the document is created.
- 📄 **Certified PDF output** — final documents are rendered with `pdf-lib` (+ custom fonts via fontkit) and stamped with a Certificate of Completion: signer identities, IPs, devices, timestamps and full audit trail.
- 🔍 **Public verification page** — anyone can check a document's status and SHA-256 fingerprint at `/verify/:id` without seeing its contents.
- 📊 **Dashboard analytics** — status filters, search across signers, completion rate and average time-to-sign.
- ⚡ **Next.js 15 App Router end to end** — Server Components + Server Actions, no separate API layer needed.
- 🗃️ **Prisma + SQLite** — zero-config persistence, seedable for a working demo out of the box.

## 🚀 Quick start

> Requires Node 20+.

```bash
npm install
npm run db:push     # create the SQLite schema
npm run db:seed     # demo data
npm run dev         # http://localhost:3010
```

Demo login: `demo@joansaro.dev` / `Demo1234!`

## 📸 Screens

| Field editor | Mobile |
|---|---|
| <img src="docs/screens/inner.png" alt="Inner view" width="100%" /> | <img src="docs/screens/mobile.png" alt="Mobile view" width="280" /> |

---

<p align="center">Built by <a href="https://github.com/joansaro">Andrés Santos</a> · <a href="https://joansaro.com">joansaro.com</a></p>
