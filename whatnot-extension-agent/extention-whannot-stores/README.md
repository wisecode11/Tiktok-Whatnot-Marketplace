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
- Retry-on-auth-failure once, then relogin required event.

## Important security note

This implementation keeps auth in-browser. It only sends API response payloads/events outward.  
Do **not** send raw token/cookie values to your backend.

## Load extension

1. Open Chrome `chrome://extensions`
2. Enable Developer Mode
3. Load unpacked -> select this folder
4. Open `https://www.whatnot.com/` and login
5. Open extension popup -> click **Connect Whatnot**

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
