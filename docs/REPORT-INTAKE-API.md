# Report Intake — patient self-submission, staff upload on behalf, doctor inbox

Checkpoint 19 (backend). Frontend is checkpoints 20 and 21 (below).

## Scope and checkpoints

| # | Deliverable | Status |
|---|-------------|--------|
| 19 | Backend: permissions, `submission` data model, `POST /reports/intake`, doctor inbox + review, doctor notice in messages, patients may message any active doctor | **this zip** |
| 20 | Frontend: patient "Send a report to a doctor" (photo/PDF -> OCR), staff "Upload for patient" dialog, `REPORT_NOTICE` rendering in Messages | not started |
| 21 | Frontend: doctor intake inbox + a per-patient full record timeline (all prescriptions by any doctor, all reports, recent first) | not started |

## What it reuses (nothing rebuilt)

Storage, sha256 duplicate detection, async OCR pipeline, parameter extraction, the report state machine, access logging, sensitive-record checks, the messaging conversation/message models, the notification service. Intake calls the existing `uploadReport()` with one extra option.

## Trust model

A submission is data, not verified clinical information. It enters the normal pipeline as `UPLOADED -> ... -> NEEDS_REVIEW` with `submission.intakeStatus = PENDING_REVIEW`. **Accept** means "a doctor has seen this and it belongs in the chart"; it does not verify or finalize. Verification stays on the existing per-parameter review + `REPORTS_VERIFY`. **Reject** moves the report to `REJECTED` through the existing state machine and requires a note.

## Permissions (new)

| Permission | Holders | Meaning |
|------------|---------|---------|
| `reports:submit` | PATIENT (+ owner/super-admin via all-permissions) | Submit **own** report. Patient is always resolved from the caller's identity; a client-sent `patientProfileId` is ignored. |
| `reports:upload` | DOCTOR, STAFF, RECEPTIONIST, ADMIN, DIRECTOR, owner/super-admin | Upload for **any** patient. Upload-only: does not grant report read, cancel, reject, manual entry, or verify. |

The inbox and review use the existing `reports:verify` (DOCTOR, DIRECTOR, owner/super-admin). Nurse / medical assistant / junior consultant use the `STAFF` role, so they are covered by `reports:upload`. Receptionist gets upload but still cannot read reports.

## Endpoints (`/api/v1/reports`)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/intake` | `reports:submit` or `reports:upload` | multipart: `file`, `reportType`, `title`, optional `targetDoctorId`, `patientNote`, `reportDate`, `performingFacility`, `ocrLanguage`; staff must also send `patientProfileId`. Patients: JPG/PNG/WebP/PDF only. Rate limited (60/hour/user). Returns `{ report, routing }`. |
| GET | `/intake?intakeStatus=&doctorId=&patientProfileId=&page=&limit=` | `reports:verify` | Doctor: only items routed to them. Director-tier: all (optionally by `doctorId`). List excludes extracted text. |
| GET | `/intake/summary` | `reports:verify` | `{ pending }` for a badge. |
| POST | `/intake/:id/review` | `reports:verify` | `{ decision: ACCEPT\|REJECT, note }`. Note required on REJECT. Only once; only a doctor it was routed to (else 404). |

Patient `GET /reports/me` and `GET /reports/:id` (+ `/download`) now also return the patient's own intake documents (their own submission, or one staff attached for them) in any status except `CANCELLED`, so they can see what was received. Clients must label these unverified (`verification.status`, `submission.intakeStatus`).

## Routing and the doctor notice

Routed to: the picked doctor **and** the patient's assigned `primaryCareProvider` (deduplicated). No picked doctor and no provider -> `400 NO_DOCTOR_SELECTED`.

Each routed doctor gets a `REPORT_NOTICE` message in their conversation with the patient (created on demand), e.g. *"Rahim Chowdhury has uploaded a new lab test report: Blood test."* or, for staff, *"Salma (Staff member) uploaded a new imaging / X-ray report for Rahim Chowdhury: Chest X-ray."* (doctor's unread count and socket `message:new` are updated), plus a generic in-app notification (`REPORT_SUBMITTED`, no names or content). The patient gets a generic `REPORT_INTAKE_REVIEWED` notification after review. Notification failures never fail the upload.

`REPORT_NOTICE` can only be written by the server; the messages API rejects it from clients.

A patient may now open a conversation with **any active doctor** (previously only the assigned provider). Doctor-initiated conversations are unchanged (assigned patients only).

## Sensitive reports (decision made, 2026-10)

Any **doctor may read any patient's reports**, including `ULTRASOUND` and `PAP_SMEAR` (list, open, download, OCR text). Every such read is still written to `report_access_logs` **and** `sensitive_record_access_logs`.

- Unchanged: **writes** (verify/amend/cancel etc.) on a sensitive report still need the patient's assigned provider or director-tier; non-doctor, non-admin roles still cannot read sensitive reports; patients only see their own.
- Unchanged: the separate gynecology-record module keeps its assigned-provider rule.
- Intake: a sensitive report now routes to the picked doctor **and** the assigned provider, with a normal (unrestricted) notice. `routing.targetRestricted` is always `false`; `NO_ASSIGNED_PROVIDER` / `RESTRICTED_REPORT` are no longer returned.
- Lab investigations (`/investigations`) follow the same read-all rule for doctors.

## Document types (`documentSubType`)

`POST /reports/intake` and `POST /reports` accept an optional `documentSubType`: `BLOOD_TEST, BIOCHEMISTRY, HORMONAL_TEST, URINE_TEST, STOOL_TEST, MICROBIOLOGY, XRAY, CT_SCAN, MRI, RADIOLOGY, ECG, ULTRASOUND, PATHOLOGY, HISTOPATHOLOGY, PAP_SMEAR, PRESCRIPTION_DOCUMENT, DISCHARGE_SUMMARY, REFERRAL_DOCUMENT, OTHER`.

- The server derives the coarse `reportType` (and so the sensitivity flag) from it. Sending both is allowed only if they agree; `reportType` alone still works.
- Stored on the report as `documentSubType` (null for older reports).
- PDFs containing `/JavaScript`, `/JS`, `/Launch`, `/EmbeddedFile` or `/RichMedia` are rejected at upload (best-effort screen, not a malware scanner).
- Patient shares are now written to `report_access_logs` (`REPORT_SHARE`); previously the action was missing from the log's enum, so shares were silently unlogged.

## What a patient receives

Patient reads (`GET /reports/me`, `GET /reports/:id`, and the `POST /reports/intake` response) return a **patient view**, not the raw document: status, `verificationStatus` (`VERIFIED`/`UNVERIFIED`), submission/intake status, the doctor's rejection reason, file name/type/size, and `ocr: { status, confidence, text, label }` where `label` is `MACHINE_EXTRACTED_UNVERIFIED` until a clinician verifies the report. `parameters` and `interpretation` appear only once the report is FINALIZED/AMENDED. Storage ids, file hash, history, amendments, routing lists, duplicate ids and the ordering doctor are never included.

`orderingDoctorId` (optional) on staff upload records who ordered the test; it is separate from `targetDoctorId` (the recipient) and is ignored for patient submissions.

## Staff upload on a patient's behalf

`POST /reports/intake` with `patientProfileId` (required for staff; ignored for patients). Allowed for any role holding `reports:upload` (doctor, staff incl. nurse/assistant/junior consultant/medical assistant, receptionist, admin, director). The uploader is recorded (`createdBy`, `submission.uploadedByRole`, and shown in the doctor inbox).

- `targetDoctorId` is optional for staff. With no doctor (and no assigned doctor) the report is filed on the patient's record, sits in no inbox, sends no notice, and the response has `routing.unrouted: true`. A patient must always choose a doctor.
- `orderingDoctorId` is optional and separate from `targetDoctorId`.
- Upload does not imply read: roles without `reports:read` (e.g. receptionist) get a receipt only (`_id, reportReference, title, reportType, documentSubType, status, uploadDate`).

## Doctor inbox

`GET /reports/intake?intakeStatus=PENDING_REVIEW|ACCEPTED|REJECTED|ALL` (default `PENDING_REVIEW`). A doctor always sees only items routed to them (`doctorId` is ignored for doctors); director-tier may pass `doctorId`. Each row adds `inboxState` (`NEW` while pending, else `REVIEWED`), `verificationStatus` (accepted is **not** verified) and `uploadedBy {name, role}`.

`POST /reports/intake/:id/review` `{ decision: ACCEPT|REJECT, note }` (note required for REJECT). A doctor the item was routed to may accept/reject it even for a sensitive report they are not the assigned provider of (audited). Verify/finalize/amend still follow the assigned-provider rule for sensitive reports.

## Choosing a doctor, messaging and notifications

- `GET /staff/doctors` (and `/staff/doctors/:id`) returns, **for patients**, a narrow entry: `userId` (the value to send as `targetDoctorId` / `doctorId`), `id`, `name`, `specialization`, `qualifications`, `yearsOfExperience`, `bio`, `department`. Other roles that hold `doctors:read` still get the full staff profile.
- `POST /conversations` `{ patientProfileId, doctorId }`: a patient may open a thread with **any active doctor** (the profile must be their own). A doctor may start one only with a patient assigned to them. Staff/receptionist cannot.
- On a routed submission each distinct recipient doctor gets one `REPORT_NOTICE` message in their thread with the patient (carrying `relatedReport`) and one in-app notification. When the target doctor is also the assigned doctor, only one is sent. Notification bodies are deliberately generic (notifications can also go out by e-mail/SMS); names and report details appear only in the secure conversation message.

## Data model

`MedicalReport.submission`: `source` (`STAFF_UPLOAD` default | `PATIENT_SUBMITTED` | `STAFF_ON_BEHALF`), `uploadedByRole`, `patientNote`, `targetDoctor`, `routedTo[]`, `intakeStatus` (`null` | `PENDING_REVIEW` | `ACCEPTED` | `REJECTED`), `reviewedBy/At`, `reviewNote`. Legacy reports need no migration. `Message.relatedReport` + `messageType REPORT_NOTICE`. New indexes on `submission.*`; run `npm run indexes` after deploy.

## Verification (this sandbox)

- `node --check` on every touched file: 0 errors.
- New `tests/unit/report-intake.test.js`: 28 tests, all pass (permissions matrix, validators, routing, sensitive handling, notices, review rules, inbox scope). DB-free: models/services are mocked or spied.
- Real `app.js` boots; all four new routes are mounted (401 unauthenticated, not 404) and registered before `/:id`.
- Existing suites `bet12*`, `bet13*`, `bet14-app-boot`: same result before and after my changes — 2 pre-existing failures that also fail on the untouched upload: `bet12-extraction-parser` (expects `12-15.5`, parser returns `12.0-15.5`) and `bet12-report-access` (`assertCanAccessAsSelf` returns `undefined`, not `false`, for an ownerless report).
- **Not verified:** no live MongoDB, Cloudinary or OCR run here (no in-process Mongo binary in this sandbox), so the end-to-end path (real upload -> OCR -> notice in a real conversation) has not been exercised.

## Known gaps (deliberately not done here)

- Client does not yet render `REPORT_NOTICE` or expose any of this (checkpoints 20-21).
- Staff uploader label uses the coarse role (`Staff member`), not the `StaffProfile.designation` (nurse / medical assistant).
- Two reviewers acting at the same instant could both pass the "not yet reviewed" check (no optimistic concurrency on `MedicalReport`); low risk, not guarded.
