# SVL-SMS — Installation & Activation Guide (Windows)

Thank you for choosing SVL-SMS. This guide walks you through installing the
app on a Windows PC and activating your license. It takes about 3 minutes.

---

## 1. Download the installer

You received a Google Drive link from your consultant. Download the file:

```
SVL-SMS-Setup-1.0.0.exe
```

Save it somewhere convenient, e.g. your **Downloads** folder.

> 💡 The installer is about 88 MB. You do **not** need to unzip it — just
> double-click the `.exe`.

---

## 2. Run the installer (and the Windows security prompt)

Windows may show a **"Windows protected your PC"** screen the first time you
run the installer. This is normal for software from a new publisher and does
**not** mean the file is unsafe.

To continue:

1. On the blue SmartScreen window, click **"More info"**.
2. Click **"Run anyway"**.
3. If Windows asks "Do you want to allow this app to make changes?", click
   **"Yes"**.

> If you ever see a different warning, just reply to your consultant — don't
> click "Don't run".

---

## 3. Install

A setup wizard opens:

- Click **Next**.
- Choose where to install (the default is fine for most users) → **Next**.
- Click **Install**.
- When it finishes, click **Finish**.

This creates:
- A **SVL-SMS** shortcut on your **Desktop**, and
- A **SVL-SMS** entry in your **Start Menu**.

---

## 4. First launch — choose a mode

Open the app (double-click the Desktop icon). The first time, a **Setup
Wizard** appears and asks you to choose:

### Option A — Demo Mode (try it free for 30 days)
- Click **DEMO MODE**.
- Click **Start Testing**.
- You get full features for 30 days. Great for a trial.
- *Note:* demo data is for evaluation and is not carried into a paid license.

### Option B — Production Mode (enter your license key)
Choose this if your consultant gave you a license key.

1. Click **PRODUCTION MODE**.
2. Paste your license key (it looks like `SVL-XXXX-XXXX-XXXX-XXXX`).
3. Click **Activate**.
4. You'll see **"License Activated"** with your plan and expiry date.
5. Click **Start Using**.

That's it — the app is ready.

---

## 5. Opening the app later

Just double-click the **SVL-SMS** icon on your Desktop, or find it in the
**Start Menu**. No server or internet connection is required — everything
runs on your own PC and your data stays on your machine.

---

## Important notes

- **One license key = one computer.** Your key is locked to the first PC you
  activate it on. If you need to run SVL-SMS on a second computer, ask your
  consultant for an additional key.
- **Keep your key safe.** You'll only need to enter it once; after that the app
  remembers the activation on that PC.
- **No internet needed** for daily use or activation — the key is verified on
  your machine.

## Need help?

Reply to your consultant and include:
- the exact text of any error message, and
- a screenshot of the screen you're stuck on.

---

<!--
====================================================================
INTERNAL NOTES — FOR THE CONSULTANT ONLY (delete before sending)
====================================================================

FILE LOCATION
  Local build artifact:
    out/SVL-SMS-Setup-1.0.0.exe   (88 MB)
  Share via Google Drive link (Anyone-with-link / Viewer).

ISSUING A LICENSE KEY FOR THIS CLIENT
  node tools/generate-license.js generate \
    --institution "Client Name" \
    --expiry YYYY-MM-DD \
    --plan standard        # demo | standard | premium | enterprise
  → prints the SVL-... key and appends it to tools/licenses/generated-keys.json
  Validate/re-issue later:
    node tools/generate-license.js validate --key "SVL-..."
    node tools/generate-license.js list
    node tools/generate-license.js revoke  --key "SVL-..."

BEHAVIOR THAT MATTERS
  • Activation is fully offline (ELECTRON_MODE=true → auto-creates a local
    license for a validly-signed key). No server needed at the client.
  • A key binds to the first machine's fingerprint (machine_fingerprint).
    Reusing the same key on a different PC → 403 "Machine ID does not match".
    Issue one key per machine.
  • Demo mode = 30 days, no key, data not persisted past the demo period.

CODE SIGNING (to remove the SmartScreen warning for clients)
  Local signed build:
    set CSC_LINK=<path-or-base64 .pfx>
    set CSC_KEY_PASSWORD=<pfx password>
    set CSC_NAME="Your Publisher Name"
    npm run electron-build:win
  CI (build-windows.yml): add repo secrets CSC_LINK (base64 .pfx),
    CSC_KEY_PASSWORD, CSC_NAME. electron-builder reads them natively; the
    config no longer gates on fs.existsSync, so base64 works in CI too.

    Note: an OV/IV cert still needs Microsoft SmartScreen reputation to build
    up; an EV (Extended Validation) cert gets immediate SmartScreen trust.
====================================================================
-->
