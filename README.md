# Hreyfill CLI + MCP

Command-line access to Frogne Taxi Hreyfill (`com.frogne.infinity.hreyfill`
3.8.3 / 83), not the newer `is.hreyfill.app`. This project is not affiliated
with Hreyfill. Coverage and unfinished flows are recorded in
[docs/COVERAGE.md](docs/COVERAGE.md).

## Install

With Bun 1.3.13 or newer:

```sh
bun add -g github:axelpaul/Hreyfill-cli
hreyfill --version
hreyfill --help
```

Single-file Linux, macOS and Windows binaries will be published by the release
workflow when a matching version tag is pushed. There is no release yet.
The CLI command is `hreyfill`; `--version`, help, doctor and MCP all use the
version in `package.json`.

## Authentication

Hreyfill uses a phone number and SMS code. **Fresh SMS/Firebase onboarding and
automatic refresh are not yet implemented end-to-end in this CLI.** Authenticate
normally in the Frogne Hreyfill app, then import your existing session privately:

```sh
hreyfill auth import --file <session.json>
hreyfill auth status
hreyfill doctor
hreyfill orders upcoming
```

`auth import` also accepts stdin. Session JSON contains `accessToken` and, for
quotes/bookings, the associated `phoneId`; `firebaseToken` is optional context
for operations that require it. Never share these values. The service expects
the access token verbatim in `Authorization`, without adding `Bearer`.

`doctor` and `auth status` check local storage, not network authentication; an
orders/profile read verifies service access. `auth logout` deletes the local
session, not the server session or inherited environment variables. Login,
SMS, signup, session import and logout are **CLI-only**, never MCP tools.
Raw login/SMS adapters remain available for valid existing device/Firebase
context, with `--yes --allow-auth`; they are not a promise of standalone login.
No rejected session automatically sends an SMS or retries a write.

Public contact information and transport options need no account. Quotes,
bookings and personal trip details use the imported account session.

## CLI usage

JSON output is default; `--json` is accepted. `<...>` denotes a placeholder to
replace, never a real identifier or location in this documentation.

```sh
hreyfill orders upcoming
hreyfill orders history --params '{"max":10}'
hreyfill orders get --params '<order-json>'
hreyfill profile get
hreyfill contacts
hreyfill transport-options
hreyfill schema get-quote
hreyfill quote --data @quote.json
hreyfill nearby --params '<coordinates-json>' --timeout 3
hreyfill live --params '<order-json>' --timeout 10
hreyfill receipt --params '<order-json>' --output receipt.pdf
hreyfill schema
```

`<order-json>` contains numeric `orderId`. `<coordinates-json>` contains numeric
`latitude` and `longitude`. Google address/directions tools need your own Google
Maps key and may incur charges; they never receive your Frogne session token.

Quote JSON uses `quoteType: "fixedPrice"`, `pickupTime` as a UTC ISO timestamp,
`numPassengers`, and `addresses.pickup`/`destination`. Addresses contain
`coord: [latitude, longitude]` and appropriate street/houseNum/city/zipCode/country
fields. Optional via addresses use the same coordinate order. `phoneId` is
filled from the saved session when omitted. A quote calculates a price, **does
not book a taxi**, and does not establish an arrival time. Addresses are not
geocoded implicitly.

### Writes

CLI write commands preview by default and send nothing:

```sh
hreyfill orders create --data @booking.json
hreyfill orders cancel --params '<order-json>'
```

Only add `--yes` after reviewing and explicitly authorizing that exact action.
A preview is not server-side validation. Booking can have a pickup without a
destination. If a write times out or returns an unexpected response, its outcome
may be unknown: check current state before retrying. Requests never retry
implicitly.

Four write request bodies are marked `partial-model`: `update-attributes`,
`delete-user`, `update-phone-settings`, `modify-payment`. Their exact schemas
are not fully recovered, so they accept raw JSON; do not guess fields for these
workflows. Some nested references also have incomplete schema coverage.
Payment enrollment still needs the provider/browser handoff, which this CLI
does not implement. No real booking, cancellation or payment change was used
to test this client.

Binary downloads require `--output`; files are private (0600) and existing files
are never overwritten. WebSockets are bounded to 1–30 seconds, 100 frames and
1 MiB; they never reconnect automatically. HTTP responses are bounded to
10 MiB, redirects are refused, and errors omit private response bodies.

## MCP server

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

`hreyfill serve` runs a stdio server. stdout contains protocol only. Read tools
are enabled by default. Set `HREYFILL_MCP_ENABLE_WRITES=1` to expose write tools;
login/SMS remain CLI-only. Every write call must include boolean `confirm`:
`false` previews, `true` permits execution. Missing, string or numeric confirmation
is rejected. This applies to booking, cancellation, card operations and all
other writes. Arguments use `params` and `body` according to `hreyfill schema`.

The table below mirrors a real writes-enabled `tools/list`. An automated test
compares its names and read/write classification with `mcp-catalog.json`.

| Tool | Mode | Description |
|---|---|---|
| `hreyfill_get_quote` | Read | Calculate a taxi fare quote; does not book a ride or provide an arrival time. |
| `hreyfill_cc_auth_failed` | Write | Report a failed card authorization; confirm=true required. Payment flow unverified. |
| `hreyfill_cc_check_auth` | Write | Check or finalize a card authorization; confirm=true required. Payment flow unverified. |
| `hreyfill_get_payment_windows` | Write | Start card enrollment; confirm=true required. Browser handoff is not implemented. |
| `hreyfill_get_receipt` | Read | Download the PDF receipt for a booking. |
| `hreyfill_cancel_order` | Write | Preview or cancel a booking; execution requires confirm=true. Not ride-tested. |
| `hreyfill_create_order` | Write | Preview or create a taxi booking; execution requires confirm=true. Not ride-tested. |
| `hreyfill_get_most_recent_order_today` | Read | Show the most recent booking from today. |
| `hreyfill_get_order` | Read | Show the details of one booking. |
| `hreyfill_get_order_history` | Read | List past bookings, with a maximum result count. |
| `hreyfill_get_order_upcoming` | Read | List upcoming bookings. |
| `hreyfill_remove_order` | Write | Preview or remove a booking from history; requires confirm=true. Not ride-tested. |
| `hreyfill_get_address` | Read | Look up an address from coordinates using your own Google Maps key. |
| `hreyfill_get_address_details` | Read | Look up address details for a Google place ID using your own key. |
| `hreyfill_get_autocompleted_addresses` | Read | Find matching places using your own Google Maps key. |
| `hreyfill_get_autocompleted_addresses_strict` | Read | Find matching places within a search area using your own Google Maps key. |
| `hreyfill_get_directions` | Read | Get driving directions using your own Google Maps key. |
| `hreyfill_get_places_extra_details` | Read | Look up details of a Google place using your own key. |
| `hreyfill_get_call_list` | Read | List taxi service contact numbers; no login required. |
| `hreyfill_get_transportation_options` | Read | List vehicle and journey options; no login required. |
| `hreyfill_delete_payment` | Write | Preview or delete a saved payment method; requires confirm=true. Untested live. |
| `hreyfill_delete_user` | Write | Preview or delete the account; requires confirm=true. Partial request schema; unverified. |
| `hreyfill_get_user` | Read | Show the signed-in user profile. |
| `hreyfill_modify_payment` | Write | Preview or edit a saved payment method; confirm=true required. Partial schema. |
| `hreyfill_set_favourite_address` | Write | Preview or set a favourite address; confirm=true required. Untested live. |
| `hreyfill_set_user_data` | Write | Preview or change saved vehicle preferences; confirm=true required. Untested live. |
| `hreyfill_update_attributes` | Write | Preview or edit the user profile; confirm=true required. Partial request schema. |
| `hreyfill_update_phone_settings` | Write | Preview or initialize device settings; confirm=true required. Partial schema. |
| `hreyfill_get_walkthrough_screens_configuration` | Read | Read the service’s introductory information; no login required. |
| `hreyfill_get_driver_image` | Read | Download the driver image for a booking. |
| `hreyfill_get_trip_path` | Read | Get the recorded route for a booking. |
| `hreyfill_send_rating` | Write | Preview or submit a trip rating; confirm=true required. Not ride-tested. |
| `hreyfill_remove_companyprofile` | Write | Preview or remove a company account link; confirm=true required. Untested live. |
| `hreyfill_set_companyprofile` | Write | Preview or link a company account; confirm=true required. Untested live. |
| `hreyfill_nearby` | Read | Watch nearby taxi positions for a bounded interval. |
| `hreyfill_live` | Read | Watch a booking’s live status for a bounded interval. Not ride-tested. |

## Configuration

Session directory: `$XDG_CONFIG_HOME/hreyfill-cli/`, default
`~/.config/hreyfill-cli/`. Directory permissions are 0700 and `auth.json` is
0600. `HREYFILL_CONFIG_DIR` overrides that location. Older local prototypes used
`~/.config/hreyfill`; import that session or set the override to continue using it.
Neither credentials nor captured service responses belong in this repository.

- `HREYFILL_CONFIG_DIR` — Override the session directory (default $XDG_CONFIG_HOME/hreyfill-cli or ~/.config/hreyfill-cli)
- `HREYFILL_ACCESS_TOKEN` — Use an existing Frogne session token instead of the stored session
- `HREYFILL_PHONE_ID` — Device identity for the imported session; needed for quote and booking requests
- `HREYFILL_FIREBASE_TOKEN` — Existing Firebase context for requests that require it; no automatic refresh
- `HREYFILL_GOOGLE_API_KEY` — Your own Google Maps key for optional address and directions tools; may incur charges
- `HREYFILL_MCP_ENABLE_WRITES` — Set to 1 to expose MCP write tools; each call still requires explicit confirmation. Login stays CLI-only.
- `XDG_CONFIG_HOME` — Base configuration directory (default ~/.config)

## Development

```sh
git clone https://github.com/axelpaul/Hreyfill-cli.git
cd Hreyfill-cli
bun install --frozen-lockfile
bun run check
bun run build
bun run verify:mcp
```

`check` runs TypeScript plus offline tests, including a real stdio tools/list
comparison and validation against the vendored site schema (draft 2020-12).
No Hreyfill account or live booking/payment request is used by the test suite.
All fixtures are synthetic placeholders, not captured customer data.

`bun run verify:source-install` tests a real GitHub global install in temporary
isolated Bun directories, checks the installed version and MCP tool list, then
uninstalls it without touching your existing global installation.

The release and site-notification workflows are copied from the site templates.
A version tag must match `package.json`. The optional `SITE_DISPATCH_TOKEN`
secret enables immediate catalogue notification; without it, hourly discovery
uses the `mcp-axelpaul` repository topic. No tag is created by `check` or `build`.

License: [MIT](LICENSE), Axel Paul Gunnarsson.
