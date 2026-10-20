# Sites: personal website dashboard

React + TypeScript + Vite + Tailwind, Firebase Realtime Database and Authentication, Cloudinary. No Cloud Functions and no paid plan needed.

## Deploy anywhere

The app is a static site (no server, no router, no Cloud Functions). The build output is the `dist/` folder.

- Build command: `npm run build` (Node 18 or newer; `.nvmrc` pins 20). Output directory: `dist`.
- Environment variables are **optional**. The public Firebase and Cloudinary values are built in as defaults; set the `VITE_*` variables from `.env.example` only to point at a different Firebase/Cloudinary project.
- Asset paths are relative (`base: './'`), so the same build works at a domain root, in a sub-folder, and on GitHub Pages project sites.

| Platform | How |
| --- | --- |
| Vercel | Import the repo. `vercel.json` is included. |
| Netlify | Import the repo. `netlify.toml` is included. Or drag the `dist/` folder into Netlify Drop. |
| Cloudflare Pages | Build command `npm run build`, output `dist`. `_headers` and `_redirects` are included. |
| Firebase Hosting | `npm run build && firebase deploy --only hosting,database` |
| GitHub Pages | Push to `main`; `.github/workflows/deploy-pages.yml` builds and publishes. Set Settings > Pages > Source to GitHub Actions. |
| Render | New Static Site; `render.yaml` is included. |
| Docker / VPS / Fly.io / Railway / Coolify / Cloud Run | `docker build -t sites . && docker run -p 8080:8080 sites` (nginx, honors `$PORT`). |
| Any static host, cPanel, Nginx, Apache | Run `npm run build` and upload the contents of `dist/`. `.htaccess` is included for Apache. |

**One required step on every new domain:** Firebase Console > Authentication > Settings > Authorized domains > add your domain (for example `my-site.vercel.app`). Without it admin sign-in fails with "This site domain is not authorized". Reads (the public dashboard) work without it.

Notes: embedded websites need `https` when the dashboard itself is on `https`. `npm run build:check` runs the TypeScript check before building.

## Updating the Realtime Database rules (required once)

Site ordering stores an `order` number on every site, so the rules in `database.rules.json` must be published once. Without this, dragging in admin shows "Could not save the new order".

```bash
firebase deploy --only database
```

Or paste the contents of `database.rules.json` into Firebase Console > Realtime Database > Rules and Publish.

## Features worth knowing

- Admin > Websites: drag the grip handle to reorder (mouse, touch, or keyboard arrow up/down on the handle). The dashboard follows the same order in real time. New sites are added at the end.
- Opening a site shows it full size with only a back button. The frame is unrestricted (downloads, pop-ups, fullscreen, camera, clipboard and file access work as on the original site). Sites that forbid being framed (X-Frame-Options or CSP frame-ancestors) get an "Open site" button that opens them directly in the same tab.
- Intro: a cinematic night-sea scene (moon, drifting cloud, swell, a tall ship, a lighthouse with a rotating beam) drawn on a canvas. On the last sweep the beam points at the viewer, its light fills the whole screen and then opens outward from the lamp onto the site. Tap, Enter, Space or Esc skips ahead to that moment; reduced motion gets a still frame and a short fade. Code: `src/features/intro/` (`scene.ts` draws, `Splash.tsx` runs the timeline).
- The database connection status is the badge in the top right of the admin area.

## Setup

```bash
npm install
npm run dev
```
`.env` is already filled for project `pdfuploader-49bb0`.

### Firebase console (one time)
1. Build > Authentication > Sign-in method: enable **Email/Password**.
2. Build > Realtime Database > Rules: paste the contents of `database.rules.json` and publish (or run `firebase deploy --only database`).
3. Open the app, press Ctrl+Q or hold the top-left logo icon, then enter `0706`. The first sign-in creates the admin account. Do this yourself right after enabling Email/Password, then change the code in Security.

### Cloudinary
Settings > Upload > Upload presets: `Orujov_Presents` must be **Unsigned**, with allowed formats `jpg, png, webp, svg, gif, mp3` and a file size limit. The app sends folders `site-dashboard/logos` and `site-dashboard/playlist-N`. Deleting items in the app removes the database record only; remove old files in the Cloudinary media library.

## Access

- PC: Ctrl+Q. Or hold the top-left logo icon.
- The admin session is remembered: after signing in once you are not asked again, even after closing the site. The code is requested again only after it is changed (or after signing out).
- The code is the password of a shared Firebase account (`admin@sites-dashboard.app`). Change it in Admin > Security (current code, new code, confirmation, at least 4 characters).
- Database rules allow public read and write only for that account. Hidden entry is a convenience, not security.
- Firebase Authentication throttles repeated wrong attempts; the dialog adds its own cooldown.
- `0706` is only valid until you change it. Anyone who knows the current code can administer the site.

## Shortcuts (user view, everything happens in the background and playback starts)
- Alt+1 / Alt+2 / Alt+3: playlist 1 / 2 / 3 (first track, or a random one in random mode). Ctrl+M and Ctrl+/ do nothing. Playlist 3 is the default on load.
- Admin > Music: drag the grip handle (or arrow up/down on it) to reorder tracks. The first track plays first, then the rest in order, looping back to the first. The player's options menu has an In order / Random switch (In order is the default and the choice is remembered on that device). Tracks never cross playlists.
- Browsers may reserve some combinations (Ctrl+Q quits Firefox on Linux); use the logo hold there.

## Appearance
Use the theme button in the header to choose Day, Black, Red or Blue. The selection is saved in this browser and synchronized to other open tabs.

## Embedded websites
Dashboard cards show only each site's logo and name, with a 1.8:1 image area and a 54px title row. Selecting a card opens the site in a full-viewport sandboxed iframe in the same page; the overlay contains only a back button and site logo. Sites that send `X-Frame-Options` or CSP `frame-ancestors` refuse to be embedded, and frontend code cannot detect or bypass that; the viewer shows a notice after a slow load. No proxy is included. `http` sites cannot be embedded in an `https` deployment.
In Admin > Websites, the logo editor provides the same user-panel preview. Drag the image or adjust zoom and horizontal/vertical framing, then Save to confirm the crop; Firebase Realtime Database syncs it to the user panel immediately. Cancel discards the framing changes.

## Deploy
```bash
npm run build
firebase deploy --only hosting,database
```
Add your domain under Authentication > Settings > Authorized domains.

## Structure
`src/app` shell and data, `src/components/ui`, `src/features/{dashboard,admin,websites,music,settings}`, `src/hooks`, `src/lib` (firebase, auth, cloudinary, config), `src/services`, `src/types`, `src/utils`, `src/styles`.
