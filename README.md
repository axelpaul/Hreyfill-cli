# Hreyfill CLI + MCP

Unofficial local TypeScript/Bun client for **Frogne Taxi Hreyfill**
(`com.frogne.infinity.hreyfill` 3.8.3 / 83). This is **not** the newer
`is.hreyfill.app`, and backend compatibility with that app is not assumed.

## Install / build

```sh
git clone https://github.com/axelpaul/Hreyfill-cli.git
cd Hreyfill-cli
bun install --frozen-lockfile
bun run check
bun run build
./hreyfill --version
./hreyfill help
```

No extracted APKs, private sessions or keys belong in this repository.

## Current coverage

40 operation adapters: 38 HTTP method variants (36 unique method/URL combinations)
and two bounded WebSocket feeds. Includes orders/history/cancellation/removal,
quotes, trip route/image/rating/receipt, profile and favourite-address settings,
company accounts, payment workflows, public configuration, Google Maps and
Frogne SMS/login/signup. Every adapter is listed by `hreyfill schema`.

This is an **implementation and static contract inventory, not a claim that every
workflow has succeeded live**. Six read endpoints and the nearby feed were checked
separately; see [coverage](docs/COVERAGE.md). No taxi was booked or cancelled and no
payment/account modification was executed during development.

Four request models are not fully recovered (`update-attributes`, `delete-user`,
`update-phone-settings`, `modify-payment`). Their bodies are explicitly marked
`partial-model` and accept caller-supplied JSON. Other nested references also have
incomplete schema coverage. Use the app for these workflows until their exact
payloads are established; do not guess at fields for destructive actions.

## Authentication

A valid existing Frogne session can be imported from a private file or stdin:

```sh
hreyfill auth import --file /secure/path/session.json
hreyfill doctor
hreyfill orders upcoming
```

Session shape: `accessToken` (required), `phoneId` and `firebaseToken` (optional,
needed by some request bodies). The Frogne access token is sent **verbatim** in
`Authorization`, without adding `Bearer`. Storage is `~/.config/hreyfill/auth.json`
(or `$XDG_CONFIG_HOME/hreyfill`, or `$HREYFILL_CONFIG_DIR`), mode 0600 in a 0700
directory. `auth status`/`doctor` inspect local storage only; an orders/profile
read verifies service access. `auth logout` removes the local file; it does not
revoke a server session. Environment overrides: `HREYFILL_ACCESS_TOKEN`,
`HREYFILL_PHONE_ID`, `HREYFILL_FIREBASE_TOKEN`. Logout cannot clear inherited env.

The raw Frogne `login`/signup/SMS adapters are available, but **fresh Firebase
onboarding and automatic refresh are not implemented**. They require valid
Firebase/device context obtained through normal app authentication. No app-bundled
Google/Firebase API key is copied or reused. Session rejection never triggers an
automatic login, SMS or retry.

## Usage

JSON output is default; `--json` is accepted. Arguments are strict:

```sh
hreyfill orders upcoming
hreyfill orders history --params '{"max":10}'
hreyfill orders get --params '{"orderId":123}'
hreyfill profile get
hreyfill contacts
hreyfill transport-options
hreyfill nearby --params '{"latitude":64.1417,"longitude":-21.9266}' --timeout 3
hreyfill live --params '{"orderId":123}' --timeout 10
hreyfill receipt --params '{"orderId":123}' --output receipt.pdf
hreyfill schema get-quote
hreyfill quote --data @quote.json
```

Quote JSON uses `quoteType: "fixedPrice"`, `pickupTime` as UTC ISO timestamp,
`numPassengers`, `addresses.pickup`/`destination` and optional `attributes`.
Addresses contain `coord: [latitude, longitude]`, street/houseNum/city/zipCode and
country code. `phoneId` is filled from the saved session if omitted. The quote
endpoint calculates a price; it **does not book a taxi or establish an ETA**.
Optional via addresses also use latitude/longitude. Booking supports a pickup
without a destination. Request schemas describe recovered field types and local
validation choices, not all of the backend’s undocumented rules.

Google Maps adapters need **your own** `HREYFILL_GOOGLE_API_KEY`; requests may be
billable. No Frogne token is forwarded to Google. Address lookup is not performed
implicitly when quoting or booking.

### Writes and auth actions

Every non-read operation defaults to a **redacted preview with no request**:

```sh
hreyfill orders create --data @booking.json
hreyfill orders cancel --params '{"orderId":123}'
```

Only add `--yes` after reviewing and explicitly authorizing that exact action.
Authentication operations additionally require `--allow-auth`. SMS validation is
classified as auth-changing despite its GET method; all payment handoff/check/fail
operations are write-gated. A preview is not server-side validation. After a
mutation timeout or unexpected response, check current state before retrying;
the server may have applied the change. Requests never automatically retry.

Payment card enrollment requires the payment-provider/browser handoff. Raw card
numbers/CVV are not accepted by a dedicated command, and no complete payment
browser automation is implemented. Credential-bearing fields are redacted.

Binary outputs require `--output`, mode 0600, and refuse to overwrite an existing
file. WebSockets are bounded to 1–30 seconds, 100 frames and 1 MiB; they never
reconnect automatically. HTTP responses are bounded to 10 MiB and redirects are
not followed. API errors never echo private response bodies.

## MCP

```json
{
  "mcpServers": {
    "hreyfill": {
      "command": "/absolute/path/to/hreyfill",
      "args": ["serve"]
    }
  }
}
```

Read tools are enabled by default. To expose write/auth tools, set
`HREYFILL_MCP_ENABLE_WRITES=1` in the server environment. Exposed write tools still
require `confirm: true`; without it they only preview. Auth tools also require
`allowAuth: true`. Tools use `params` and `body` objects matching `hreyfill schema`.
The stdio MCP server uses the official MCP SDK; stdout is protocol-only. Credential
import/logout are CLI-only and not exposed as MCP tools.

## Evidence boundaries

[Coverage and operation inventory](docs/COVERAGE.md) distinguishes static APK
observations, local design choices, mocks and live reads. Source contracts were
recovered from the specified app; this cannot establish all private backend
endpoints, server-side business rules or future versions. Keep the official app
available for login, account/payment changes and unverified workflows.
