# Roster bulk importer

`sync.gs` is a Google Apps Script that mirrors two tabs of a Google Sheet into
the `users` table in Supabase — one tab for bigbros, one for lilbros. It's a
full delete-and-replace sync per usertype, triggered by checking a box.

## Setup

1. Create a new Google Sheet.
2. Add two tabs named **exactly** `Edit พี่รหัส` and `Edit น้องรหัส`.
3. Import `template-bigbro.csv` into the first tab and `template-lilbro.csv`
   into the second (File → Import → Insert new sheet(s), or paste over an
   existing tab). Data is expected to start at **row 7** — rows 1–6 are a
   free header/status area matching the templates.
4. Turn cell **A5** on each tab into an actual checkbox (Insert → Checkbox).
5. Extensions → Apps Script, paste in `sync.gs`, save.
6. Project Settings (gear icon) → Script Properties → add two properties:
   - `SUPABASE_URL` — your project's URL
   - `SUPABASE_SERVICE_KEY` — your project's **service_role** key
7. Triggers (clock icon) → Add Trigger → function `handleEdit` → event source
   "From spreadsheet" → event type "On edit". Save, authorize when prompted.
8. Fill in your roster starting at row 7, then check the box in A5 on either
   tab to push that tab's data to Supabase.

## Column layout

**Edit พี่รหัส** (bigbros, `usertype = 0`):
`A first_name · B branch · C nickname · D hint1 · E hint2 · F hint3`

**Edit น้องรหัส** (lilbros, `usertype = 1`):
`A first_name · B nickname · C branch · D linked_id`

`linked_id` on a lilbro row must exactly match a bigbro's `nickname` (or
`first_name`, either works per `get_lilbro_hints`) — that's what pairs them up.

## ⚠️ Security

`SUPABASE_SERVICE_KEY` is the **service_role** key, not the anon key used by
the website. It bypasses Row Level Security completely and has full
read/write access to every table. It belongs only in Script Properties
(server-side, never visible in the sheet, never committed to git). Never
paste it into a cell, into `sync.gs` itself, or into the frontend project.
