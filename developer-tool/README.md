# Collab Deal OS Developer Tool

Internal Windows operator shell for the Collab Deal OS prototype.

## What it opens

By default the app opens:

```text
http://localhost:3000/developer
```

That route contains the actual developer dashboard and talks to Supabase from the Collab Deal OS web server. The EXE does **not** contain the Supabase service-role/secret key.

For a deployed environment, set `COLLAB_DEAL_OS_DEVELOPER_URL` before launching the app, for example:

```powershell
$env:COLLAB_DEAL_OS_DEVELOPER_URL="https://your-domain.example/developer"
```

Production access should also set `DEVELOPER_ADMIN_EMAILS` on the web server. Local `npm run dev` permits signed-in access for prototype review.

## Local run

Start Collab Deal OS first from the main repository:

```bash
npm run dev
```

Then in a second terminal:

```bash
cd developer-tool
npm install
npm start
```

## Build the Windows EXE

On Windows:

```bash
cd developer-tool
npm install
npm run dist
```

The portable EXE is written to `developer-tool/dist/`.

A GitHub Actions workflow also builds the Windows portable EXE as an artifact whenever the developer-tool files change.

## Prototype scope

The tool currently provides:

- marketplace activity counts
- recent brand campaign/deal uploads
- creator deal comments
- brand/creator conversation list
- read-only full DM history
- shared withdrawal queue
- Mark Paid / Reject withdrawal controls

`Mark paid` does not transfer money. It records that the operator has already handled the payout outside the prototype; the user's wallet then changes the withdrawal from Pending to Completed and applies the prototype balance deduction.
