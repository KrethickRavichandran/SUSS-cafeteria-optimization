# SUSS FoodLoop — Beyond the Queue (v2)

A SUSS campus dining website with its own email/password accounts, a Google Identity Services integration, a twelve-second flower video introduction and an original music loop. The cafeteria crowd checker, menu, basket, demo checkout, delivery tracking and feedback flows are preserved.

Live website: https://suss-foodloop.ravichandrankrethick.chatgpt.site

## Try the downloaded website

Extract the ZIP completely and double-click `index.html`, or `START-WINDOWS.bat`. The website source is under `public/`. The offline preview runs the cafeteria demo and video/music without installing packages. Account sign-in uses the live website or the full server described below; it is never simulated using browser-stored passwords.

You can also use `node serve.mjs` for a static guest preview at http://localhost:8080. This optional server serves the frontend only.

## Run the full website with email accounts locally

Use Node.js 22.13 or newer. From the project folder:

```bash
npm install
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_great_gladiator.sql
npm start
```

Open the localhost URL printed by Wrangler. These commands install the framework, build the site, apply the supplied account schema to the local database, and start the local Worker. Your local database is separate from the hosted database. Keep `.wrangler/` out of source control and shared ZIPs.

## Sign-up and sign-in

- Email/password registration accepts Gmail and other email addresses.
- Passwords must be 12–128 characters. Server records contain per-user salted PBKDF2 hashes, never plaintext passwords.
- Sessions use random tokens, with only their hashes stored in the database. HTTPS session cookies are HTTP-only, Secure and SameSite=Lax, with seven-day expiry.
- Authentication writes check the request origin and a same-origin JSON request header. Login and registration attempts are rate limited.
- Email-only registration does not verify mailbox ownership or SUSS student status. This version does not send verification or password-reset emails.
- Google tokens are verified for signature, issuer, audience, expiry, email verification and nonce. Existing email accounts are not automatically linked; sign in with the password first and explicitly link the matching Google account.
- Visitors may explore the cafeteria as guests. Account profiles are stored on the server; basket, feedback and demo order history remain browser-local and are not synced to accounts.

## Enable the Google button

The integration is complete, but the live Google button remains unavailable until the owner supplies a real **Google OAuth web client ID**. A client ID is public configuration; it is not your password or a client secret.

1. Follow Google's official setup guide: https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid
2. Create or select your own Google Cloud project and configure the OAuth branding/audience required by Google.
3. Create an OAuth client of type **Web application**.
4. Add this exact authorized JavaScript origin: `https://suss-foodloop.ravichandrankrethick.chatgpt.site`
5. Add your localhost origin as well if testing Google locally.
6. Copy the web client ID ending in `.apps.googleusercontent.com`.
7. Supply that public ID so the hosted `GOOGLE_CLIENT_ID` runtime value can be configured and deployed. No Google client secret is needed for this ID-token callback flow.

The frontend loads the official Google Identity Services library only when a configured sign-in panel is opened. It does not use a made-up client ID or a fake Google sign-in screen. Development/testing audiences must follow Google's test-user rules. Any domain or branding verification required by Google is managed in your Google Cloud project.

## Video and music

- `public/assets/flower-smooth-60fps.mp4`: a seamless twelve-second 1920×1080 H.264 cinematic camera animation at 60 frames per second of our generated glass-flower artwork.
- `public/assets/campus-bloom.mp3`: an original 48-second stereo instrumental loop composed for this site.
- Enter with sound starts both; Enter without sound starts the muted intro.
- The intro can be skipped, and the header control plays or pauses music on desktop and mobile.
- Subpixel camera interpolation avoids stepped motion; matching position and velocity at the loop boundary avoid a jump. The intro crossfades into an aligned hero frame.
- The hero keeps a muted looping video backdrop. Reduced-motion preferences skip the intro and use the still artwork.
- Video failures fall back to the still image; the site is not blocked by a failed media load.

No video, soundtrack, logo or code from the reference site is redistributed. Its warm flower aesthetic, pill navigation and editorial layout informed this version.

## Project files

| Location | Purpose |
| --- | --- |
| `public/index.html` | Cafeteria website structure |
| `public/styles.css` | Responsive style, account panels and intro |
| `public/data.js` | Editable menus, prices, cafeterias and FAQs |
| `public/core.js` | Basket arithmetic, room checks and demo tracking |
| `public/app.js` | Ordering, navigation, video, music and feedback |
| `public/auth.js` | Email account UI and official Google button integration |
| `public/assets/` | Bundled artwork, video, music and favicon |
| `app/api/auth/[action]/route.ts` | Hosted account API routes |
| `lib/auth-core.ts` | Password hashing, cookie and input helpers |
| `lib/auth-service.ts` | Registration, sign-in, sessions, limits and Google verification |
| `db/schema.ts`, `drizzle/` | Account schema and migration |
| `.env.example` | Google client configuration key, without credentials |
| `vite.config.ts`, `build/`, `scripts/` | Retained Sites/Vinext build integration |

The ZIP contains a sanitized hosting manifest without the hosted project's identity. Source contains no account passwords, session tokens, live user database, Google secret or developer credentials.

## Menu and demo data

Crowd snapshot: Food Clique **94%**, Food Gallery **55%**, Food Fest / Subway **23%**, at **11:34 AM**. These remain sample data, with no occupancy sensors connected. Local scenarios can be tried and reset.

Demo menu prices: Salted Crispy Chicken S$4/S$5, Sesame Crispy Chicken S$4/S$5, Mala Dry Yong Tau Foo S$6.80, Tom Yum Yong Tau Foo S$6.80, Udon S$7, Dry Ramen S$8, Chicken Caesar Salad S$9 and Avocado Salad S$9. Tom Yum uses a nominal price matching the comparable Mala bowl. Every listed dish is orderable. Other venue menus are marked coming soon; dietary information needs confirmation with the stall.

The ordering experience uses a **15-minute estimate** and delivery-room format **C.7.15**. Checkout payments and order tracking are demos: no real charge, cafeteria order or delivery is created. Delivery preview runs for about 90 seconds; pickup becomes ready after 30 seconds and waits for collection.

## Verification

The project was built successfully and checked with 17 ordering/content checks, 16 server authentication checks, and eight account/media UI checks. Google verification was tested with local test keys, not a live Google account. Media codec, duration and bundled assets were inspected. Visual browser QA was unavailable in the authoring environment.
