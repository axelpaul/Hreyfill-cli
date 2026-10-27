# Coverage — 2026-10-27

## Artifact and evidence

- Frogne Hreyfill 3.8.3 (83), package `com.frogne.infinity.hreyfill`.
- APK SHA-256: `270e6ce49632088dbc5574cc0a8c6fd319b7e2fa7ff1bb80a6c96389616f620c`.
- Saved REA class-search evidence: `ev_d78b64595d778fbe175e34e9abbc4eaf7752f67c9b040bd4cab9d02b53699e11`.
- Reused focused JADX declarations and callsites from the same retained artifact.
- Additional REA class extraction was rejected by the client; it was not retried. Four request models remain partial.

## Verification

- Current live reads: upcoming orders, history (max 1), user profile, contact list, transport options and walkthrough configuration succeeded.
- Live nearby WebSocket: one valid vehicles/dispatchArea frame received in a bounded 3-second check.
- Prior standalone quote feasibility was verified separately on the same app; not reclassified as comprehensive booking verification.
- Live order-specific route/receipt/image/status cannot be verified with an empty order history.
- No bookings, cancellations, deletions, ratings, profile/company/payment changes or SMS/auth calls were performed in this build.
- Fresh Firebase login, refresh, card enrollment browser flow and server-specific ride/payment rules remain unverified/unimplemented as documented in README.
- Schemas generated from field inventories are local validation, not proof of server-required/nullability constraints. Four direct models and some nested references accept raw JSON.

## Local verification

- TypeScript strict typecheck passed.
- 21 tests passed: transport guards, all write/auth previews, coordinate schemas, nullability/pickup-only handling, private auth storage, CLI parsing and MCP defaults.
- Compiled stdio MCP initialize/list passed: 20 default tools; 40 with writes enabled. A cancellation preview via MCP performed no request.

## Operation adapters

| Operation | Effect | Transport | Request-model coverage |
|---|---|---|---|
| `get-quote` | read | POST | static-contract |
| `cc-auth-failed` | write | POST | static-contract |
| `cc-check-auth` | write | POST | static-contract |
| `get-payment-windows` | write | POST | static-contract |
| `get-receipt` | read | GET | static-contract |
| `cancel-order` | write | POST | static-contract |
| `create-order` | write | POST | static-contract |
| `get-most-recent-order-today` | read | GET | static-contract |
| `get-order` | read | GET | static-contract |
| `get-order-history` | read | GET | static-contract |
| `get-order-upcoming` | read | GET | static-contract |
| `remove-order` | write | POST | static-contract |
| `get-address` | read | GET | static-contract |
| `get-address-details` | read | GET | static-contract |
| `get-autocompleted-addresses` | read | GET | static-contract |
| `get-autocompleted-addresses-strict` | read | GET | static-contract |
| `get-directions` | read | GET | static-contract |
| `get-places-extra-details` | read | GET | static-contract |
| `get-call-list` | read | GET | static-contract |
| `get-transportation-options` | read | GET | static-contract |
| `send-login-request` | auth | POST | static-contract |
| `send-signin-request` | auth | POST | static-contract |
| `delete-payment` | write | POST | static-contract |
| `delete-user` | write | POST | partial-model |
| `get-user` | read | GET | static-contract |
| `modify-payment` | write | POST | partial-model |
| `set-favourite-address` | write | POST | static-contract |
| `set-user-data` | write | POST | static-contract |
| `update-attributes` | write | POST | partial-model |
| `update-phone-settings` | write | POST | partial-model |
| `send-sms-validation-request` | auth | POST | static-contract |
| `send-validationcode` | auth | GET | static-contract |
| `get-walkthrough-screens-configuration` | read | GET | static-contract |
| `get-driver-image` | read | GET | static-contract |
| `get-trip-path` | read | GET | static-contract |
| `send-rating` | write | POST | static-contract |
| `remove-companyprofile` | write | POST | static-contract |
| `set-companyprofile` | write | POST | static-contract |
| `nearby` | read | WS | static-contract |
| `live` | read | WS | static-contract |

## Read/write semantics

Quote POST is read-only. SMS validation GET changes authentication. Payment-window creation and check/failure callbacks are classified write operations because the callback can finalize payment enrollment. Both WebSocket streams send the existing access token in Authorization; nearby sends `center: [latitude, longitude]` after connection. Favourite-address removal uses the same address/set route with an empty typed Address, not a made-up DELETE route.
