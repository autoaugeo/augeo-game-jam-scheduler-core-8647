# Game-jam scheduler core

Turns a game jam's start and end into an hourly plan. The plan splits the work hours into five phases (concept and scope, prototype, production, polish and bugfix, build and submit buffer), leaves out sleep hours, and always ends with a submit block. `core.js` also builds `.ics` calendar text and CSV text from a plan. It has no dependencies and runs in node or in a browser.

This project is built and maintained by an automated agent system.

The plan comes from a deterministic algorithm: the same input always gives the same plan. It is not coaching and it does not guarantee a finished game.

Live tool in the browser: https://augeo-game-jam-team-scheduler-hourly-jam-plan-8647.pages.dev/

## Command line

```
node cli.js <start> <end> [--sleep-hours N] [--sleep-start H] [--tz-minutes M]
```

- `start`, `end`: ISO 8601 date-times with `Z` or a `+hh:mm` / `-hh:mm` offset.
- `--sleep-hours`: whole hours of sleep per day, 0 to 12 (default 8).
- `--sleep-start`: local hour when sleep starts, 0 to 23 (default 23).
- `--tz-minutes`: offset of the local clock from UTC in minutes, -720 to 840 (default 0).

Invalid input prints `Error: <message>` to stderr and exits with code 1 (code 2 for a wrong number of arguments or an unknown option). `cli.js` pre-checks the two ISO dates itself (format, and `Z` or an offset). `core.js` reports the rest, for example `The jam end must be after the jam start.` and `The jam is longer than 31 days. Enter a jam of 31 days or less.`

Example, a 3 hour jam. This is what `core.js` returns for that input, shown through `cli.js`:

```
$ node cli.js 2026-01-09T18:00:00Z 2026-01-09T21:00:00Z
Jam plan: 2026-01-09 18:00 to 2026-01-09 21:00 (UTC+00:00)
Total 3 h: work 3 h, sleep 0 h
2026-01-09 18:00 -> 2026-01-09 19:00 | 1 h | Prototype | Get the core loop playable with placeholder assets. Test it every hour.
2026-01-09 19:00 -> 2026-01-09 20:00 | 1 h | Production | Build the content: levels, art, sound and features from the scope list. No new ideas.
2026-01-09 20:00 -> 2026-01-09 21:00 | 1 h | Submit | Submit now: upload the build, open the entry page as a visitor and confirm it is published.
```

## Library

```js
const core = require('./core.js');
const plan = core.buildPlan({
  startUtc: '2026-01-09T12:00:00Z',
  endUtc: '2026-01-11T12:00:00Z',
  sleepHoursPerDay: 8,
  sleepStartLocalHour: 23,
  tzOffsetMinutes: 0
});
const ics = core.toIcs(plan, { calName: 'My jam' });
```

`buildPlan` throws an `Error` with an `errors` array when the input is invalid. `validateInput` returns the same messages without throwing.

## Tests

```
node tests/run_fixtures.js
```

The fixtures cover 48 h, 72 h, 9-day and 3 h jams, invalid input and determinism. They use only `node:assert`, with no network and no packages. The script exits non-zero if any check fails.

## License

MIT, see `LICENSE`.
