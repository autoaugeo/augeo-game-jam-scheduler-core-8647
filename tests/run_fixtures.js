'use strict';

var assert = require('node:assert');
var core = require('../core.js');

var HOUR = 3600000;
var failed = 0;
var count = 0;

function base(startIso, hours) {
  var s = Date.parse(startIso);
  return {
    startUtc: s,
    endUtc: s + hours * HOUR,
    sleepHoursPerDay: 8,
    sleepStartLocalHour: 23,
    tzOffsetMinutes: 0
  };
}

function check(name, fn) {
  count++;
  try {
    fn();
    console.log('ok ' + count + ' ' + name);
  } catch (e) {
    failed++;
    console.log('not ok ' + count + ' ' + name + '\n  ' + (e && e.message));
  }
}

function invariants(opts, plan) {
  assert.strictEqual(plan[0].startUtc, opts.startUtc);
  assert.strictEqual(plan[plan.length - 1].endUtc, opts.endUtc);
  for (var i = 1; i < plan.length; i++) {
    assert.strictEqual(plan[i].startUtc, plan[i - 1].endUtc, 'contiguous at ' + i);
  }
  var last = plan[plan.length - 1];
  assert.strictEqual(last.kind, 'work');
  assert.strictEqual(last.phase, 'submit');
  assert.strictEqual(last.final, true);
  var sum = core.summarizePlan(plan);
  assert.strictEqual(sum.totalHours, (opts.endUtc - opts.startUtc) / HOUR);
  assert.strictEqual(sum.workHours + sum.sleepHours, sum.totalHours);
  var order = core.PHASES.map(function (p) { return p.id; });
  var seen = -1;
  plan.forEach(function (b) {
    if (b.kind === 'sleep') { return; }
    var idx = order.indexOf(b.phase);
    assert.ok(idx >= 0, 'known phase');
    assert.ok(idx >= seen, 'phases never go backwards');
    seen = idx;
  });
  return sum;
}

check('48h jam: contiguous, 16 sleep hours, five phases, ends in submit', function () {
  var o = base('2026-01-09T12:00:00Z', 48);
  var plan = core.buildPlan(o);
  assert.strictEqual(plan.length, 48);
  var sum = invariants(o, plan);
  assert.strictEqual(sum.sleepHours, 16);
  core.PHASES.forEach(function (p) { assert.ok(sum.phases[p.id] > 0, p.id + ' has hours'); });
});

check('72h jam: 24 sleep hours and invariants', function () {
  var o = base('2026-01-09T12:00:00Z', 72);
  var plan = core.buildPlan(o);
  assert.strictEqual(plan.length, 72);
  var sum = invariants(o, plan);
  assert.strictEqual(sum.sleepHours, 24);
});

check('9-day jam: 72 sleep hours and invariants', function () {
  var o = base('2026-01-09T12:00:00Z', 216);
  var plan = core.buildPlan(o);
  assert.strictEqual(plan.length, 216);
  var sum = invariants(o, plan);
  assert.strictEqual(sum.sleepHours, 72);
});

check('3h micro-jam: no sleep, ends in submit', function () {
  var o = base('2026-01-09T18:00:00Z', 3);
  var plan = core.buildPlan(o);
  assert.strictEqual(plan.length, 3);
  var sum = invariants(o, plan);
  assert.strictEqual(sum.sleepHours, 0);
  assert.deepStrictEqual(plan.map(function (b) { return b.phase; }), ['prototype', 'production', 'submit']);
});

check('invalid input is reported and buildPlan throws the documented error', function () {
  var good = base('2026-01-09T12:00:00Z', 48);
  var cases = [
    { startUtc: 'nonsense', endUtc: good.endUtc },
    { startUtc: good.endUtc, endUtc: good.startUtc },
    { startUtc: good.startUtc, endUtc: good.startUtc + 32 * 24 * HOUR },
    { startUtc: good.startUtc, endUtc: good.startUtc + HOUR / 2 },
    { sleepHoursPerDay: 13 },
    { sleepStartLocalHour: 24 },
    { tzOffsetMinutes: 900 }
  ];
  cases.forEach(function (patch) {
    var o = {};
    Object.keys(good).forEach(function (k) { o[k] = good[k]; });
    Object.keys(patch).forEach(function (k) { o[k] = patch[k]; });
    var v = core.validateInput(o);
    assert.strictEqual(v.ok, false);
    assert.ok(v.errors.length > 0);
    assert.throws(function () { core.buildPlan(o); }, function (err) {
      return err instanceof Error && Array.isArray(err.errors) && err.errors.length === v.errors.length;
    });
  });
  assert.strictEqual(core.validateInput(undefined).ok, false);
});

check('determinism: same input gives the same plan', function () {
  var o = base('2026-03-14T09:30:00Z', 60);
  var a = JSON.stringify(core.buildPlan(o));
  var b = JSON.stringify(core.buildPlan(o));
  assert.strictEqual(a, b);
});

if (failed) {
  console.log(failed + ' of ' + count + ' fixture groups failed');
  process.exit(1);
}
console.log('all ' + count + ' fixture groups passed');
