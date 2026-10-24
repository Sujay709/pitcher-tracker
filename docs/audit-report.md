# Pitcher Workload Tracker Audit

Audit date: 2026-10-23

Scope: all repository source files, the existing pure logic, a browser run under
`/pitcher-tracker/`, and independent browser-side differential checks. No
application source files were changed.

## Inventory

Expected files are present. The repository also contains `.github/workflows/pages.yml`,
`manifest.webmanifest`, icons, `.vscode/settings.json`, and the existing docs.

| File | Lines |
|---|---:|
| `index.html` | 70 |
| `player.html` | 155 |
| `coach.html` | 67 |
| `css/style.css` | 1,021 |
| `css/landing.css` | 170 |
| `js/main.js` | 208 |
| `js/workload.js` | 541 |
| `js/storage.js` | 148 |
| `js/ui.js` | 548 |
| `js/coach.js` | 307 |
| `js/landing.js` | 79 |
| `js/tests.js` | 792 |
| `data/guidelines.json` | 26 |
| `manifest.webmanifest` | 20 |
| `README.md` | 113 |
| `docs/ai-disclosure.md` | 0 |
| `docs/demo-script.md` | 8 |

HTML script and asset paths:

- `index.html`: `css/style.css`, `css/landing.css`, `js/landing.js`.
- `player.html`: `css/style.css`, `manifest.webmanifest`, `icons/icon-180.png`,
  `js/main.js`.
- `coach.html`: `css/style.css`, `js/coach.js`.
- All are relative paths and worked when served at
  `http://127.0.0.1:8765/pitcher-tracker/`.

### Local-storage keys

| Key | Read/write surface |
|---|---|
| `pitcherTracker.outings` | player storage, history, status, import/export/share |
| `pitcherTracker.checkins` | player check-in, status, share |
| `pitcherTracker.ageGroup` | player age-group selector |
| `pitcherTracker.count` | player pitch counter |
| `pitcherTracker.displayName` | player share profile |
| `pitcherTracker.teamCode` | player share profile |
| `pitcherTracker.playerId` | player share identity |
| `pitcherTracker.roster` | coach board |
| `pitcherTracker.coachTeamCode` | coach board |
| `pitcherTracker.role` | landing-page remembered role |
| `pitcherTracker.theme` | player theme toggle |

Player and coach use distinct roster/team-code keys. Player outings, check-ins,
profile, age group, counter, role, and theme are shared by same-origin tabs as
intended; there is no accidental player/coach key collision.

### Event listeners

- `js/landing.js`: role-link click listeners.
- `js/ui.js`: age-group `change`; theme-toggle `click`; check-in option
  `change`; counter add/undo/save/reset clicks; document `visibilitychange`;
  date-input `focus`; outing-form `input` and `submit`; history delegated
  `click`; export `click`; share-profile `submit`; open-share `click`;
  copy `click`; native-share `click`; import-file `change`.
- `js/coach.js`: remove-player click listeners created for each card; coach-team
  form `submit`; load-snapshot click; add-snapshot click; cancel click; planner
  date `change`.

The listeners are installed once during module startup. Rendering replaces
children rather than re-running setup functions, so no duplicate listener was
found in the normal path.

## Test execution

The local shell has no `node` executable, so the requested external Node
throwaway test could not run. The same pure modules were imported in the
browser runtime instead.

Independent browser-side differential testing covered 170 required-rest cases
and 480 date/availability cases (650 total), including all requested pitch
edges, effort values, both age groups, month/year boundaries, leap day, and the
2026 DST dates. Result: **0 mismatches**. Long toss and low-effort bullpen
exclusion, multi-day latest-date selection, and Unicode snapshot round-trip also
passed.

The repository test runner is console-only and `RUN_TESTS` is `false` in
`js/main.js`; it does not fail a build or test command.

## Summary

| Severity | Count |
|---|---:|
| CRITICAL | 1 |
| HIGH | 5 |
| MEDIUM | 4 |
| LOW | 1 |

| Confidence | Count |
|---|---:|
| CONFIRMED BY EXECUTION | 4 |
| CONFIRMED BY READING | 5 |
| SUSPECTED | 2 |

## Findings

### A-001 | Corrupt stored outings crash the player screen

**A-001 | Title:** Corrupt stored outings crash the player screen | **Severity:** CRITICAL | **Confidence:** CONFIRMED BY EXECUTION | **Location:** `js/storage.js:18`, `js/workload.js:33`

**Steps to reproduce**

1. Open the player app.
2. In the console, run `localStorage.setItem("pitcherTracker.outings", "[null]")`.
3. Reload the player page.

**Expected:** The app rejects the bad row, preserves a usable screen, and reports
that corrupted data was ignored.

**Actual:** Browser execution produced `TypeError: Cannot read properties of
null (reading 'type')` from `countsTowardRest`; the status, availability strip,
check-in options, and history did not render.

**Root cause:** `loadOutings` checks only that the parsed top-level value is an
array. It does not validate each item before `dailyTotals` dereferences it.
The same pattern exists for check-ins and roster entries.

**Recommended fix:** Validate and normalize every stored record at the storage
boundary; skip invalid rows with an explicit console/UI warning rather than
passing them to rendering and workload logic.

**Regression test to add:** Load arrays containing `null`, primitives,
malformed objects, missing fields, bad dates, and out-of-range values for
outings, check-ins, and roster snapshots; assert no throw and a usable empty or
partially recovered result.

**Risk of the fix:** Low; valid data is unchanged, but malformed legacy data
will be discarded.

### A-002 | Same-day older snapshot can overwrite newer roster data

**A-002 | Title:** Same-day snapshot ordering is not deterministic | **Severity:** HIGH | **Confidence:** CONFIRMED BY EXECUTION | **Location:** `js/workload.js:116`

**Steps to reproduce**

1. Add a snapshot for player `p` with `asOf: "2026-10-23"` and a newer
   check-in or workload.
2. Later open an older link for the same player that also says
   `asOf: "2026-10-23"`.
3. Confirm adding it.

**Expected:** The older same-day snapshot must not replace the newer snapshot,
or the user must be shown a conflict with a reliable ordering field.

**Actual:** `upsertPlayer` replaces the existing player when
`incomingPlayer.asOf < existingPlayer.asOf` is false. A same-date incoming
snapshot always wins. Browser execution confirmed that same-date data was
replaced.

**Root cause:** Snapshots carry only a calendar date and the update rule treats
equal dates as newer.

**Recommended fix:** Add a monotonic snapshot timestamp/version or reject
same-date snapshots unless the user explicitly chooses replacement.

**Regression test to add:** Upsert newer then older snapshots with equal
`asOf`; assert the newer content remains.

**Risk of the fix:** Medium; legitimate same-day refreshes need a clear
replacement policy.

### A-003 | Invalid calendar dates are accepted and normalized

**A-003 | Title:** Outing validation accepts impossible dates | **Severity:** HIGH | **Confidence:** CONFIRMED BY EXECUTION | **Location:** `js/workload.js:77`

**Steps to reproduce**

1. Import JSON containing
   `{"date":"2026-02-30","pitchCount":1,"type":"game","effort":5}`.
2. Or call the form validation with the same date.

**Expected:** The row is rejected as an invalid calendar date.

**Actual:** Browser execution returned `null` from `validateOuting`, meaning no
validation error. `addDays` then constructs a native `Date`, which silently
normalizes February 30 into a March date.

**Root cause:** `validateOuting` checks presence and lexicographic future
ordering only; it never applies the strict calendar-date validation used by
snapshot decoding.

**Recommended fix:** Require the exact `YYYY-MM-DD` format and verify the
calendar components before accepting an outing or import row.

**Regression test to add:** Reject February 30, month 13, day 00, non-padded
dates, and valid leap-day dates.

**Risk of the fix:** Low; only malformed records are affected.

### A-004 | Daily over-max warning is incomplete and hidden in red/yellow status

**A-004 | Title:** The required max-pitch warning does not consistently reach the user | **Severity:** HIGH | **Confidence:** CONFIRMED BY READING**
| **Location:** `js/main.js:143`, `js/workload.js:489`, `js/ui.js:239`

**Steps to reproduce**

1. Log two counting outings on the same day, such as 60 game pitches and 60
   game pitches for the 15-16 group.
2. Observe the form response and status card.

**Expected:** The app clearly warns that the day's total exceeds the age-group
   maximum, regardless of which individual outing caused the total.

**Actual:** The form warning compares only `outing.pitchCount` with the maximum,
   so each 60-pitch save gives no warning even though the daily total is 120.
   `overMaxNote` computes a daily warning, but `getStatus` puts it only in
   `status.reason`; `renderStatus` does not render `reason` for yellow/red
   states. A red/yellow user therefore does not see that warning.

**Root cause:** The form uses a per-row value, while the status logic uses
daily totals, and the UI drops the computed reason on non-green statuses.

**Recommended fix:** Calculate the warning from the saved daily total and expose
it as a separately rendered status message for every status level.

**Regression test to add:** Assert a warning after two same-day outings whose
sum exceeds the age max, including when the status is green after the rest date.

**Risk of the fix:** Low; this adds safety messaging without changing dates.

### A-005 | Coach board treats old arm concerns as current forever

**A-005 | Title:** Stale Sore/Pain check-ins permanently force “Check arm first” | **Severity:** HIGH | **Confidence:** CONFIRMED BY READING**
| **Location:** `js/workload.js:145`

**Steps to reproduce**

1. Share a snapshot with `checkin: { date: "2026-10-01", feeling: 5 }`.
2. Open it on the coach board weeks later.
3. Refresh or view the roster.

**Expected:** The board shows the age of the check-in and does not present an
old pain report as the player's current condition; a current safety policy
should be explicit.

**Actual:** `groupRoster` checks only the feeling value, not its age. The player
is always placed in “Check arm first.” The card labels it “Arm check-in” but
does not distinguish current from stale. `staleDays` is calculated for the
snapshot update, not used to expire the check-in.

**Root cause:** The snapshot has a check-in date, but the grouping rule ignores
that date.

**Recommended fix:** Define a current-check-in window and display stale status
explicitly; only apply the safety grouping within that policy.

**Regression test to add:** Assert that yesterday's Sore/Pain is safety-grouped
and an out-of-window check-in is marked stale rather than current.

**Risk of the fix:** Medium; the product must choose a conservative safety
window.

### A-006 | Open tabs can show yesterday’s rest status after midnight

**A-006 | Title:** No background return or midnight refresh | **Severity:** HIGH | **Confidence:** CONFIRMED BY READING**
| **Location:** `js/main.js:102`

**Steps to reproduce**

1. Leave the player page open across local midnight.
2. Do not interact with the page.
3. Read the status, seven-day total, and availability strip before any later
   action.

**Expected:** The page uses the current local date after midnight and when
returning from the background.

**Actual:** `todayLocal()` is called only when `refresh()` runs. The only
document visibility listener is in `setupCounter` for wake-lock management; it
does not refresh workload UI. A tab can retain yesterday's status and
seven-day total until a separate action happens.

**Root cause:** There is no page-visibility/pageshow or midnight refresh path.

**Recommended fix:** Refresh date-dependent state on `visibilitychange`,
`pageshow`, and a bounded next-midnight timer; update the date input max at the
same time.

**Regression test to add:** Mock the clock across midnight while a page remains
mounted and assert status, strip, total, check-in, and date max update.

**Risk of the fix:** Low to medium; timer lifecycle must be cleaned up.

### A-007 | `daysBetween` silently truncates large date gaps

**A-007 | Title:** Coach day counts become wrong after 60 days | **Severity:** MEDIUM | **Confidence:** CONFIRMED BY EXECUTION**
| **Location:** `js/workload.js:66`

**Steps to reproduce**

1. Use a valid roster snapshot with `availableDate: "2027-01-01"`.
2. View it on `2026-10-23`.

**Expected:** The displayed days short and stale age reflect the actual calendar
gap.

**Actual:** Browser execution returned `daysShort: 60` for a gap of 70 days.
The function stops at its hard cap and does not report truncation.

**Root cause:** `daysBetween` loops while `count < 60`.

**Recommended fix:** Compute calendar-day difference directly with validated
calendar dates, or reject dates outside a defined supported range rather than
silently returning 60.

**Regression test to add:** Test 61, 90, 365, and cross-year gaps for both
`daysBetween` and stale roster rendering.

**Risk of the fix:** Low; valid app-generated outings have short rest periods,
but imported or shared snapshots can expose the issue.

### A-008 | Stored future or malformed rows are accepted by loaders

**A-008 | Title:** Loaders do not enforce the outing/check-in/roster schemas | **Severity:** MEDIUM | **Confidence:** CONFIRMED BY READING**
| **Location:** `js/storage.js:13`

**Steps to reproduce**

1. Hand-edit `pitcherTracker.outings`, `pitcherTracker.checkins`, or
   `pitcherTracker.roster` to contain objects with missing fields, future dates,
   wrong types, or invalid nested values.
2. Reload the relevant page.

**Expected:** Invalid individual records are ignored or repaired, with the
remaining valid records usable.

**Actual:** The loaders return any array unchanged. Future outings can affect
`availableDate`; malformed records can crash consumers as shown in A-001.
Check-ins and roster snapshots have the same top-level-only validation.

**Root cause:** Array validation is confused with item/schema validation.

**Recommended fix:** Reuse strict record validators at every load boundary and
drop invalid records with an explicit diagnostic.

**Regression test to add:** Property-style malformed-row cases for each storage
key, including future dates and missing nested fields.

**Risk of the fix:** Medium; old hand-edited data may be intentionally
nonconforming and will be skipped.

### A-009 | Player outing saves depend on unguarded `crypto.randomUUID`

**A-009 | Title:** Outing save can fail in contexts without `crypto.randomUUID` | **Severity:** MEDIUM | **Confidence:** CONFIRMED BY READING**
| **Location:** `js/storage.js:140`

**Steps to reproduce**

1. Run the app in a browser/context where `crypto.randomUUID` is absent.
2. Submit an otherwise valid outing.

**Expected:** The app uses its documented fallback identity behavior or reports
a recoverable save error.

**Actual:** `addOuting` calls `crypto.randomUUID()` directly, unlike the guarded
fallbacks in `loadOrCreatePlayerId` and `workload.js`. The resulting
`ReferenceError` is caught by `main.js`, so the outing is not saved.

**Root cause:** The fallback was implemented for player IDs but not for outing
IDs.

**Recommended fix:** Use one guarded ID helper for all generated IDs, or make
the failure explicit before the user enters data.

**Regression test to add:** Stub an unavailable `crypto.randomUUID` and assert
that a valid outing still saves with a nonempty unique ID.

**Risk of the fix:** Low.

### A-010 | Storage-write failures are not handled consistently

**A-010 | Title:** Some private-mode/quota failures become uncaught UI errors | **Severity:** MEDIUM | **Confidence:** SUSPECTED**
| **Location:** `js/main.js:134`, `js/coach.js:256`

**Steps to reproduce**

1. Use a browser/private context that throws from `localStorage.setItem`.
2. Change age group, save a profile/team code, or save a coach snapshot.

**Expected:** The user gets an explicit recoverable error and the UI remains
consistent.

**Actual:** `saveAgeGroup`, `saveProfile`, `saveCoachTeamCode`, and
`saveRoster` do not catch or return write failures. Outing and check-in writes
are wrapped by callers, but these paths are not. Device-specific execution was
not possible in this environment, so the exception behavior is marked
suspected.

**Root cause:** Storage reads have local catches, but write handling is
inconsistent.

**Recommended fix:** Centralize safe writes that return success/failure and
surface a user-facing error at every caller.

**Regression test to add:** Mock `setItem`/`removeItem` to throw for every
storage operation and assert no uncaught exception plus an error message.

**Risk of the fix:** Low.

### A-011 | Export has no fallback for iOS standalone/webview download behavior

**A-011 | Title:** Export behavior in iOS Home Screen and embedded browsers is
not verified | **Severity:** LOW | **Confidence:** SUSPECTED**
| **Location:** `js/ui.js:391`

**Steps to reproduce**

1. Add the app to an iOS Home Screen or open it in an in-app browser.
2. Tap Export data.

**Expected:** A usable save/share destination is provided.

**Actual:** The implementation creates a blob URL, clicks a synthetic anchor,
and immediately revokes the URL. Desktop Chromium was not used to verify a
download here, and iPhone standalone/in-app behavior was not available, so
this remains suspected rather than confirmed.

**Root cause:** The export path assumes browser download support.

**Recommended fix:** Verify supported iOS behavior and provide a native share,
new-tab, or visible fallback when direct downloads are unavailable.

**Regression test to add:** Browser/device smoke tests for normal Safari,
standalone Safari, Android Chrome, and embedded webviews.

**Risk of the fix:** Medium; platform-specific fallbacks can change download
UX.

## Design limitations (not bugs)

- The app is localStorage-only and intentionally has no accounts, backend, or
  cross-device synchronization.
- A share URL intentionally exposes a snapshot in the URL hash to the recipient;
  it is not server transmission or encryption.
- Confirm dialogs are a deliberately simple safety/confirmation mechanism.
- Rest guidance is not medical advice and the extra effort-9/10 day is an
  application rule, not Pitch Smart guidance.
- The console-only test runner and `RUN_TESTS = false` are weak CI integration,
  but are quality/tooling limitations rather than a runtime defect by
  themselves.

## Known suspicion status

| # | Status | Evidence |
|---:|---|---|
| 1 | **Confirmed** | `upsertPlayer` replaces equal-`asOf` snapshots; see A-002. |
| 2 | **Confirmed** | Form checks one outing; daily status totals by date; see A-004. |
| 3 | **Confirmed** | Loaders validate only arrays; null outing crashed in browser; see A-001/A-008. |
| 4 | **Confirmed by reading** | Refresh computes today only when called; no page-return refresh; see A-006. |
| 5 | **Confirmed** | `validateOuting` lacks strict date validation and `addDays` normalizes; see A-003. |
| 6 | **Confirmed** | Browser call `daysBetween("2020-01-01","2020-04-01")` returned 60; see A-007. |
| 7 | **Refuted for normal startup** | Setup listeners run once; no setup call occurs inside refresh/render. |
| 8 | **Partly confirmed** | Outing ID uses unguarded `crypto.randomUUID`; confirm behavior on target webviews was not verified; see A-009. |
| 9 | **Refuted for tested cases** | Base64url padding, Unicode, tampering, and size checks passed browser execution. |
| 10 | **Confirmed** | Coach grouping checks feeling without check-in age; see A-005. |
| 11 | **Refuted** | Player/coach keys are distinct; shared player data is intentional same-origin state. |
| 12 | **Refuted** | Label and note both describe the same counting types, and differential totals passed. |
| 13 | **Refuted for normal save failures** | Failed validation returns before clearing counter; successful save clears it; storage failure is handled for outing saves. |
| 14 | **Confirmed as a quality limitation** | `RUN_TESTS` is false and tests only log strings; not a runtime data bug. |
| 15 | **Unverified** | iOS standalone export was unavailable; see A-011. |

## Not verified

- The requested external Node test script, because `node` is not installed in
  the shell.
- Real iPhone Safari at 375px and 320px, Android Chrome, standalone Home Screen
  mode, safe-area/status-bar overlap, keyboard behavior, and in-app webviews.
- Native share and clipboard permissions on target mobile browsers.
- iOS standalone export behavior.
- Quota/private-mode storage exceptions on real devices.
- Browser back/forward behavior across remembered-role redirects on target
  browsers.
- Network caching with mixed module versions during a GitHub Pages deployment.
- A real hosted GitHub Pages console/network trace for favicon 404s and all
  cache headers.
- Large system text, landscape, and assistive-technology announcements.

## Suggested fix order

1. Fix A-001/A-008 so corrupted local data cannot blank the player or coach
   board.
2. Fix A-003 and A-004 so invalid dates and over-max daily totals cannot
   produce misleading safety output.
3. Fix A-006 and A-005 so date freshness and arm-condition freshness are
   explicit.
4. Fix A-002 to prevent same-day stale snapshots from replacing newer data.
5. Fix A-009 and A-010 for resilient storage/ID behavior.
6. Verify and, if needed, address A-011 on iOS standalone and embedded
   browsers.

## Looks correct

- Guideline bands, edge values, effort 9/10 addition, counting-type rules,
  multi-outing daily totals, and latest available date matched an independent
  implementation across 650 cases.
- Dates are formatted and compared as local `YYYY-MM-DD` strings for valid
  inputs; month boundaries, year boundaries, leap day, and the tested 2026 DST
  dates passed.
- Long toss, catch, and low-effort bullpens are excluded from rest and seven-day
  totals while remaining loggable.
- Normal history ordering is newest date first and preserves later-logged order
  for equal dates.
- User-controlled names and snapshot values are rendered with `textContent`,
  not `innerHTML`; no tested XSS path was found.
- Snapshot decoding enforces size, version, field ranges, strict dates, and
  base64url characters; Unicode round-trip passed.
- Sore/Pain players are not placed in plain Available when a snapshot is
  current enough to be considered by the current grouping rule.
- Relative asset paths work under the GitHub Pages subpath.
- The theme, role selection, pitch counter persistence, import validation,
  delete confirmation, planner, roster removal, and empty states are wired.
