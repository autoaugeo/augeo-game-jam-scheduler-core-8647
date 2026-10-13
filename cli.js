#!/usr/bin/env node
'use strict';

var core = require('./core.js');

var USAGE = [
  'Usage: node cli.js <start> <end> [--sleep-hours N] [--sleep-start H] [--tz-minutes M]',
  '',
  '  start, end       ISO 8601 date-times with a Z or a +hh:mm / -hh:mm offset,',
  '                   for example 2026-01-09T18:00:00Z',
  '  --sleep-hours    whole hours of sleep per day, 0 to 12 (default 8)',
  '  --sleep-start    local hour when sleep starts, 0 to 23 (default 23)',
  '  --tz-minutes     offset of the local clock from UTC in minutes (default 0)'
].join('\n');

var ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

function fail(messages, code) {
  process.stderr.write(messages.map(function (m) { return 'Error: ' + m; }).join('\n') + '\n');
  process.exit(code);
}

function main(argv) {
  var positional = [];
  var opts = { sleepHoursPerDay: 8, sleepStartLocalHour: 23, tzOffsetMinutes: 0 };
  var names = { '--sleep-hours': 'sleepHoursPerDay', '--sleep-start': 'sleepStartLocalHour', '--tz-minutes': 'tzOffsetMinutes' };
  var i;
  for (i = 0; i < argv.length; i++) {
    var a = argv[i];
    if (a === '--help' || a === '-h') {
      process.stdout.write(USAGE + '\n');
      return;
    }
    if (Object.prototype.hasOwnProperty.call(names, a)) {
      var raw = argv[i + 1];
      i++;
      if (raw === undefined || !/^-?\d+$/.test(raw)) {
        fail(['The value after ' + a + ' must be a whole number.'], 1);
      }
      opts[names[a]] = parseInt(raw, 10);
    } else if (a.indexOf('--') === 0) {
      fail(['Unknown option ' + a + '.', USAGE], 2);
    } else {
      positional.push(a);
    }
  }
  if (positional.length !== 2) {
    fail(['Give exactly two arguments: the jam start and the jam end.', USAGE], 2);
  }
  var bad = [];
  if (!ISO.test(positional[0])) { bad.push('The jam start is missing or is not a valid date and time.'); }
  if (!ISO.test(positional[1])) { bad.push('The jam end is missing or is not a valid date and time.'); }
  if (bad.length) { fail(bad, 1); }
  opts.startUtc = positional[0];
  opts.endUtc = positional[1];

  var plan;
  try {
    plan = core.buildPlan(opts);
  } catch (err) {
    fail(err.errors || [err.message], 1);
  }
  var tz = opts.tzOffsetMinutes;
  var sum = core.summarizePlan(plan);
  var out = [];
  out.push('Jam plan: ' + core.formatLocal(plan[0].startUtc, tz) + ' to ' +
    core.formatLocal(plan[plan.length - 1].endUtc, tz) + ' (' + core.formatOffset(tz) + ')');
  out.push('Total ' + sum.totalHours + ' h: work ' + sum.workHours + ' h, sleep ' + sum.sleepHours + ' h');
  plan.forEach(function (b) {
    out.push(core.formatLocal(b.startUtc, tz) + ' -> ' + core.formatLocal(b.endUtc, tz) + ' | ' +
      b.hours + ' h | ' + b.phaseLabel + ' | ' + core.teamFocus(b));
  });
  process.stdout.write(out.join('\n') + '\n');
}

main(process.argv.slice(2));
