(function (root) {
  'use strict';

  var HOUR = 3600000;
  var DAY = 86400000;
  var MAX_DAYS = 31;

  var PHASES = [
    { id: 'concept', label: 'Concept and scope', share: 10, focus: 'Agree one core idea, write the scope down and cut everything that is not essential.' },
    { id: 'prototype', label: 'Prototype', share: 25, focus: 'Get the core loop playable with placeholder assets. Test it every hour.' },
    { id: 'production', label: 'Production', share: 40, focus: 'Build the content: levels, art, sound and features from the scope list. No new ideas.' },
    { id: 'polish', label: 'Polish and bugfix', share: 15, focus: 'Fix bugs, tune difficulty, add feedback effects and clean up the first minute of play.' },
    { id: 'submit', label: 'Build and submit buffer', share: 10, focus: 'Freeze features. Build, test the exported game on a clean machine and fill in the entry page.' }
  ];

  var FINAL_FOCUS = 'Submit now: upload the build, open the entry page as a visitor and confirm it is published.';
  var SLEEP_FOCUS = 'Sleep. Nothing is planned.';

  function toMs(v) {
    if (typeof v === 'number') { return v; }
    if (typeof v === 'string') { return Date.parse(v); }
    return NaN;
  }

  function isInt(v) {
    return typeof v === 'number' && isFinite(v) && Math.floor(v) === v;
  }

  function validateInput(opts) {
    var errors = [];
    var o = opts || {};
    var s = toMs(o.startUtc);
    var e = toMs(o.endUtc);
    if (!isFinite(s)) { errors.push('The jam start is missing or is not a valid date and time.'); }
    if (!isFinite(e)) { errors.push('The jam end is missing or is not a valid date and time.'); }
    if (isFinite(s) && isFinite(e)) {
      if (e <= s) {
        errors.push('The jam end must be after the jam start.');
      } else if (e - s > MAX_DAYS * DAY) {
        errors.push('The jam is longer than ' + MAX_DAYS + ' days. Enter a jam of ' + MAX_DAYS + ' days or less.');
      } else if (e - s < HOUR) {
        errors.push('The jam must last at least 1 hour.');
      }
    }
    if (!isInt(o.sleepHoursPerDay) || o.sleepHoursPerDay < 0 || o.sleepHoursPerDay > 12) {
      errors.push('Sleep hours per day must be a whole number from 0 to 12.');
    }
    if (!isInt(o.sleepStartLocalHour) || o.sleepStartLocalHour < 0 || o.sleepStartLocalHour > 23) {
      errors.push('The sleep start hour must be a whole number from 0 to 23.');
    }
    if (!isInt(o.tzOffsetMinutes) || o.tzOffsetMinutes < -720 || o.tzOffsetMinutes > 840) {
      errors.push('The timezone offset must be a whole number of minutes between -720 and 840.');
    }
    return { ok: errors.length === 0, errors: errors };
  }

  function localHour(ms, tz) {
    var t = (((ms + tz * 60000) % DAY) + DAY) % DAY;
    return Math.floor(t / HOUR);
  }

  function isSleepHour(h, start, len) {
    return ((h - start + 24) % 24) < len;
  }

  function buildPlan(opts) {
    var v = validateInput(opts);
    if (!v.ok) {
      var err = new Error(v.errors.join(' '));
      err.errors = v.errors;
      throw err;
    }
    var start = toMs(opts.startUtc);
    var end = toMs(opts.endUtc);
    var n = Math.max(1, Math.floor((end - start) / HOUR));
    var blocks = [];
    var i;
    for (i = 0; i < n; i++) {
      var bs = start + i * HOUR;
      var be = (i === n - 1) ? end : bs + HOUR;
      var lh = localHour(bs, opts.tzOffsetMinutes);
      var sleep = i !== n - 1 && isSleepHour(lh, opts.sleepStartLocalHour, opts.sleepHoursPerDay);
      blocks.push({
        index: i,
        startUtc: bs,
        endUtc: be,
        hours: (be - bs) / HOUR,
        localHour: lh,
        kind: sleep ? 'sleep' : 'work',
        phase: sleep ? 'sleep' : '',
        phaseLabel: sleep ? 'Sleep' : '',
        final: i === n - 1
      });
    }
    var last = blocks[n - 1];
    last.kind = 'work';
    last.phase = 'submit';
    last.phaseLabel = 'Submit';

    var work = [];
    for (i = 0; i < n - 1; i++) {
      if (blocks[i].kind === 'work') { work.push(blocks[i]); }
    }
    var total = work.length;
    var bounds = [];
    var cum = 0;
    var p;
    for (p = 0; p < PHASES.length; p++) {
      cum += PHASES[p].share;
      bounds.push(Math.round(total * cum / 100));
    }
    bounds[PHASES.length - 1] = total;
    var j;
    for (j = 0; j < total; j++) {
      var k = 0;
      while (j >= bounds[k]) { k++; }
      work[j].phase = PHASES[k].id;
      work[j].phaseLabel = PHASES[k].label;
    }
    return blocks;
  }

  function teamFocus(block) {
    if (block.kind === 'sleep') { return SLEEP_FOCUS; }
    if (block.final) { return FINAL_FOCUS; }
    var p;
    for (p = 0; p < PHASES.length; p++) {
      if (PHASES[p].id === block.phase) { return PHASES[p].focus; }
    }
    return '';
  }

  function summarizePlan(plan) {
    var s = { totalHours: 0, workHours: 0, sleepHours: 0, phases: {} };
    var p;
    for (p = 0; p < PHASES.length; p++) { s.phases[PHASES[p].id] = 0; }
    plan.forEach(function (b) {
      s.totalHours += b.hours;
      if (b.kind === 'sleep') {
        s.sleepHours += b.hours;
      } else {
        s.workHours += b.hours;
        s.phases[b.phase] += b.hours;
      }
    });
    return s;
  }

  function buildRolePlan(plan, roles, roleTemplates) {
    var table = roleTemplates && roleTemplates.roles;
    if (!table) { throw new Error('Role templates are missing.'); }
    return roles.map(function (r) {
      var id = typeof r === 'string' ? r : r.id;
      var names = (typeof r === 'string' || !r.names) ? [] : r.names.slice();
      var tpl = table[id];
      if (!tpl || !tpl.phases) { throw new Error('No template for role ' + id + '.'); }
      var counters = {};
      var out = plan.map(function (b) {
        var copy = {};
        Object.keys(b).forEach(function (key) { copy[key] = b[key]; });
        if (b.kind === 'sleep') {
          copy.task = 'Sleep';
          return copy;
        }
        var list = tpl.phases[b.phase];
        if (!list || !list.length) { throw new Error('Role ' + id + ' has no tasks for phase ' + b.phase + '.'); }
        if (b.final) {
          copy.task = list[list.length - 1];
          return copy;
        }
        var pool = list.length > 1 && b.phase === 'submit' ? list.slice(0, -1) : list;
        var c = counters[b.phase] || 0;
        counters[b.phase] = c + 1;
        copy.task = pool[c % pool.length];
        return copy;
      });
      return { role: id, label: tpl.label || id, names: names, blocks: out };
    });
  }

  function pad(n, w) {
    var s = String(n);
    while (s.length < w) { s = '0' + s; }
    return s;
  }

  function formatLocal(ms, tz) {
    var d = new Date(ms + tz * 60000);
    return pad(d.getUTCFullYear(), 4) + '-' + pad(d.getUTCMonth() + 1, 2) + '-' + pad(d.getUTCDate(), 2) +
      ' ' + pad(d.getUTCHours(), 2) + ':' + pad(d.getUTCMinutes(), 2);
  }

  function parseLocal(str, tz) {
    var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(str || ''));
    if (!m) { return NaN; }
    return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - tz * 60000;
  }

  function formatOffset(min) {
    var sign = min < 0 ? '-' : '+';
    var a = Math.abs(min);
    return 'UTC' + sign + pad(Math.floor(a / 60), 2) + ':' + pad(a % 60, 2);
  }

  function icsDate(ms) {
    return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  }

  function icsEscape(text) {
    return String(text)
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\r\n|\r|\n/g, '\\n');
  }

  function utf8Len(cp) {
    if (cp < 0x80) { return 1; }
    if (cp < 0x800) { return 2; }
    if (cp < 0x10000) { return 3; }
    return 4;
  }

  function foldLine(line) {
    var out = [];
    var cur = '';
    var len = 0;
    for (var ch of line) {
      var l = utf8Len(ch.codePointAt(0));
      if (len + l > 75) {
        out.push(cur);
        cur = ' ';
        len = 1;
      }
      cur += ch;
      len += l;
    }
    out.push(cur);
    return out.join('\r\n');
  }

  function fnv(str, seed) {
    var h = seed >>> 0;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return ('00000000' + h.toString(16)).slice(-8);
  }

  function uidFor(text) {
    return fnv(text, 2166136261) + fnv(text, 84696351) + '@jam-scheduler';
  }

  function mergeContiguous(blocks) {
    var events = [];
    blocks.forEach(function (b) {
      var title = b.title || b.task || b.label || b.phaseLabel || 'Jam';
      var prev = events[events.length - 1];
      if (prev && prev.title === title && prev.endUtc === b.startUtc) {
        prev.endUtc = b.endUtc;
      } else {
        events.push({ startUtc: b.startUtc, endUtc: b.endUtc, title: title, phaseLabel: b.phaseLabel || '' });
      }
    });
    return events;
  }

  function toIcs(blocks, opts) {
    var calName = (opts && opts.calName) || 'Game jam plan';
    var events = mergeContiguous(blocks);
    var stamp = events.length ? icsDate(events[0].startUtc) : '19700101T000000Z';
    var lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Jam Scheduler//Hourly plan//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:' + icsEscape(calName)
    ];
    events.forEach(function (ev) {
      var seed = calName + '|' + ev.startUtc + '|' + ev.endUtc + '|' + ev.title;
      lines.push('BEGIN:VEVENT');
      lines.push('UID:' + uidFor(seed));
      lines.push('DTSTAMP:' + stamp);
      lines.push('DTSTART:' + icsDate(ev.startUtc));
      lines.push('DTEND:' + icsDate(ev.endUtc));
      lines.push('SUMMARY:' + icsEscape(ev.title));
      if (ev.phaseLabel) { lines.push('DESCRIPTION:' + icsEscape('Phase: ' + ev.phaseLabel)); }
      lines.push('END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    return lines.map(foldLine).join('\r\n') + '\r\n';
  }

  function csvCell(v) {
    var s = v === null || v === undefined ? '' : String(v);
    if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) { s = "'" + s; }
    if (/[",\r\n]/.test(s)) { s = '"' + s.replace(/"/g, '""') + '"'; }
    return s;
  }

  function toCsv(rows, columns) {
    var out = [columns.map(csvCell).join(',')];
    rows.forEach(function (r) {
      out.push(columns.map(function (c) { return csvCell(r[c]); }).join(','));
    });
    return out.join('\r\n') + '\r\n';
  }

  var CSV_COLUMNS = ['role', 'members', 'start_local', 'end_local', 'start_utc', 'end_utc', 'phase', 'task'];

  function planToRows(rolePlans, tz) {
    var rows = [];
    rolePlans.forEach(function (rp) {
      rp.blocks.forEach(function (b) {
        rows.push({
          role: rp.label,
          members: rp.names.join('; '),
          start_local: formatLocal(b.startUtc, tz),
          end_local: formatLocal(b.endUtc, tz),
          start_utc: icsDate(b.startUtc),
          end_utc: icsDate(b.endUtc),
          phase: b.phaseLabel,
          task: b.task
        });
      });
    });
    return rows;
  }

  var api = {
    PHASES: PHASES,
    CSV_COLUMNS: CSV_COLUMNS,
    validateInput: validateInput,
    buildPlan: buildPlan,
    buildRolePlan: buildRolePlan,
    summarizePlan: summarizePlan,
    teamFocus: teamFocus,
    toIcs: toIcs,
    toCsv: toCsv,
    planToRows: planToRows,
    foldLine: foldLine,
    formatLocal: formatLocal,
    parseLocal: parseLocal,
    formatOffset: formatOffset
  };

  if (typeof module !== 'undefined' && module.exports) { module.exports = api; }
  if (typeof window !== 'undefined') { window.JamCore = api; }
})(this);
