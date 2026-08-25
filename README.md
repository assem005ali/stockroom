# Stockroom — Warehouse Management PWA (shared, real-time)

A warehouse inventory app: track products, multi-brand references, storage locations (Warehouse → Shelf → Column → Part), sales history, and low-stock alerts — shared live across everyone who has the password.

## How sharing works

- **Data**: stored in Firebase Firestore. Every connected user reads and writes the same database in real time — when one person adds a product or records a sale, everyone else sees it update immediately, no refresh needed.
- **Access**: a single shared password screen (`src/App.jsx` → `PasswordGate`). Anyone who knows the password gets full read/write access to everything. This is a lightweight team gate, not individual accounts — see the security note below.

## 1. Set up Firebase (one-time)

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and create a project (or reuse your existing `asm-stor` project).
2. **Project settings → General → Your apps → Add app → Web**. Copy the config object it gives you.
3. Paste those values into `src/firebaseConfig.js`, replacing the `YOUR_...` placeholders.
4. In the left sidebar: **Build → Firestore Database → Create database**. Start in test mode to get going quickly.
5. Set `SHARED_PASSWORD` in `src/firebaseConfig.js` to whatever passcode your team should use.
6. Before sharing the URL widely, tighten your Firestore rules — see the comment block at the bottom of `src/firebaseConfig.js` for a starting point and what it does and doesn't protect against.

## 2. Local development

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`. The first person to open the app seeds the shared database with sample data — after that, everyone sees the same live inventory.

## 3. Build for production

```bash
npm run build
npm run preview   # sanity-check the production build locally
```

Output goes to `dist/`.

## 4. Deploy to Netlify

### Option A — connect a Git repo (recommended, auto-deploys on push)

1. Push this project to a GitHub/GitLab/Bitbucket repo.
2. In Netlify: **Add new site → Import an existing project** → pick the repo.
3. Build command: `npm run build`. Publish directory: `dist`. (Already set in `netlify.toml`.)
4. Click **Deploy**.

### Option B — drag and drop (quick, no Git needed)

1. Run `npm install && npm run build` locally.
2. Go to [app.netlify.com/drop](https://app.netlify.com/drop).
3. Drag the generated `dist/` folder onto the page.

Share the resulting `*.netlify.app` URL plus the shared password with your team — everyone opens the same link and sees the same live data.

## Verifying the PWA

After deploying, open the live URL in Chrome or mobile Safari:

- Chrome desktop: an install icon appears in the address bar.
- Android Chrome: an "Add to Home screen" / "Install app" banner appears.
- iOS Safari: use Share → "Add to Home Screen" (iOS doesn't show an automatic install prompt).
- DevTools → Application → Service Workers / Manifest to confirm registration.

## Security note (read this before sharing widely)

This uses **one shared password**, checked in the browser, not per-user Firebase Authentication. That means:

- Anyone with the password has full access to add, edit, and delete everything.
- The Firebase config values in `src/firebaseConfig.js` are visible to anyone who views your site's source — that's normal for Firebase web apps, but it means your **Firestore security rules**, not this file, are what actually stops a stranger from reading/writing your data if they somehow get your config. Don't skip locking those down (see `src/firebaseConfig.js`).
- If you later want individual logins (so you can see *who* changed what, or restrict certain people to read-only), that means adding Firebase Authentication — happy to help wire that in when you're ready.

## Replacing the icons

Swap `public/icon-192.png` and `public/icon-512.png` with your own square PNGs at the same filenames and dimensions — no other config changes needed.
