# `modules/invoices/` — intentionally empty

This folder is leftover scaffolding from before BET-15 was implemented. It is
**not** a gap — `Invoice` is real, complete, and mounted, but lives at
`modules/billing/models/invoice.model.js` / `modules/billing/services/invoice.service.js`
/ `modules/billing/routes/billing.routes.js` (`/api/v1/billing/invoices*`)
instead of here.

This mirrors an established convention elsewhere in this project: BET-05's
`modules/users/` (the admin CRUD layer) coexists with the flat `users/`
directory (`user.model.js`, the actual schema) without either being a
duplicate of the other — see `SESSION_HANDOFF.md`'s "Current Architecture"
section for the full explanation of that split. Here, the equivalent split
is simpler: `Invoice` never needed a *separate* module from `Fee`, since
both are inherently the same "billing" domain (a fee is what something
costs; an invoice is what a specific patient was actually charged for it,
optionally referencing a `Fee`) — so `Invoice` was built directly inside
`modules/billing/` rather than getting its own top-level module.

Do not add invoice code here. If a future task genuinely needs to split
`Invoice` out of `modules/billing/` into its own module, that is a deliberate
architectural change to flag and design, not something to do by accident
because this folder already exists.
