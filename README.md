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

- 📝 **Document builder** — create contracts from templates, drop signature/text/date fields onto the page and assign them to signers.
- 🖊️ **Digital signature flow** — each signer gets their own link, draws or types their signature, and the document state advances (draft → viewed → signed).
- 📄 **Certified PDF output** — final documents are rendered with `pdf-lib` (+ custom fonts via fontkit) and stamped with a signature certificate page.
- ⚡ **Next.js 15 App Router end to end** — Server Components + Server Actions, no separate API layer needed.
- 🗃️ **Prisma + SQLite** — zero-config persistence, seedable for a working demo out of the box.

## 🚀 Quick start

> Requires Node 20+.

```bash
npm install
npm run db:push     # create the SQLite schema
npm run db:seed     # demo data
npm run dev         # http://localhost:3000
```

## 📸 Screens

| Field editor | Mobile |
|---|---|
| <img src="docs/screens/inner.png" alt="Inner view" width="100%" /> | <img src="docs/screens/mobile.png" alt="Mobile view" width="280" /> |

---

<p align="center">Built by <a href="https://github.com/joansaro">Andrés Santos</a> · <a href="https://joansaro.com">joansaro.com</a></p>
