# Whatnot Connector Extension (MV3)

## Implemented

- Connect button reads live Whatnot session endpoint:
  - `GET /services/live/socket/v3/session`
- Cookie presence check:
  - `__Secure-access-token`
  - `__Secure-access-token-expiration`
  - `__Secure-refresh-token`
- Popup shows connected state + token data + copy button.
- Demo APIs:
  - GET session endpoint
  - POST `GetSellerLiveReadiness`
  - POST `UpdateProfileMutation`
- Real-time observed API capture from page `fetch`/`XMLHttpRequest` (request payload + response body/status) for:
  - `/services/graphql/`
  - `/services/live/socket/v3/session`
- Backend socket contract stubs in `background.js`:
  - extension -> backend: `auth`, `action_response`, `relogin_required`, `pong`
  - backend -> extension: `action_request`, `heartbeat`, `force_relogin`
- Automatic auth refresh before Whatnot API calls (throttled cookie/session refresh; parallel platform actions allowed).
- Fresh GraphQL headers via `buildWhatnotGraphqlHeaders` (Bearer from live cookies, not cached state).
- Per-request cookie refresh in `executeApi`; on `Invalid token` retries session refresh + reconnect before surfacing relogin.
- Proactive session refresh on backend heartbeat (~15s) while connected.
- Relogin required only after automatic refresh + reconnect both fail.

## Important security note

This implementation keeps auth in-browser. It only sends API response payloads/events outward.  
Do **not** send raw token/cookie values to your backend.

## Logos (single source of truth)

Assets live in `frontend/public/` only:

- `seller-hub-logo.png` — popup header + main Seller Hub branding
- `extension-logo.png` — Chrome toolbar / extensions page icon

From repo root, before **Load unpacked** or shipping a zip:

```powershell
.\scripts\sync-extension-logos.ps1
.\scripts\build-extension-zip.ps1
```

Do not commit copied PNGs in this folder (see `.gitignore`).

## Production endpoints

Configured in `config.js` (used by `background.js`):

| Setting | Production value |
|---------|------------------|
| Seller Hub | `https://sellerhub.wisecodestudio.com` |
| API / REST | `https://sellerhub-backend.wisecodestudio.com` |
| WebSocket | `wss://sellerhub-backend.wisecodestudio.com/ws/whatnot-extension` |

Set `WHATNOT_EXTENSION_API_KEY` in `config.js` if your backend defines `WHATNOT_EXTENSION_API_KEY` in env.

For **local dev**, copy `config.local.example.js` → `config.local.js` and point `background.js` import at `./config.local.js` instead of `./config.js`.

After changing config or `manifest.json`, **Reload** the extension in `chrome://extensions`.

## Load extension

1. Run `.\scripts\sync-extension-logos.ps1` from the repo root
2. Open Chrome `chrome://extensions`
3. Enable Developer Mode
4. Load unpacked -> select this folder
5. Open `https://www.whatnot.com/` and login
6. Open extension popup -> click **Connect Whatnot** (use your Clerk user id from production Seller Hub)

## Backend integration

Your backend should:

1. Keep a user<->extension socket session map.
2. Send `action_request` messages with payload:

```json
{
  "type": "action_request",
  "payload": {
    "url": "https://www.whatnot.com/services/graphql/?operationName=GetSellerLiveReadiness&ssr=0",
    "method": "POST",
    "headers": { "content-type": "application/json", "x-whatnot-app": "whatnot-web" },
    "body": "{\"operationName\":\"GetSellerLiveReadiness\",\"variables\":{},\"query\":\"...\"}"
  }
}
```

3. Receive `action_response` and return/store data in platform.
