/**
 * Schedules are entered as a repeat rule plus a start time, not as a cron
 * expression.
 *
 * - daily   : every day at the given time
 * - weekly  : on the selected weekdays (Mon-Fri, Mon+Thu, just Sunday, ...)
 * - monthly : on the day of month taken from the chosen date
 * - once    : on the chosen date only
 *
 * A cron pattern is derived from that for croner, which also applies the
 * timezone.
 */

const REPEATS = ['once', 'daily', 'weekly', 'monthly'];
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// Weeks are shown starting on Monday; cron itself still numbers Sunday as 0.
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

function parseTime(time) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(time || '').trim());
  if (!match) return null;
  const hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

function parseDate(date) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || '').trim());
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  // Interpreted as a plain calendar date; only the weekday is read from it.
  const probe = new Date(year, month - 1, day, 12, 0, 0);
  if (probe.getMonth() !== month - 1 || probe.getDate() !== day) return null;
  return { year, month, day, weekday: probe.getDay() };
}

/** Accept [1,2,3], ["1","2"] or {1:true}; return sorted unique 0-6 values. */
function parseDays(value) {
  const raw = Array.isArray(value)
    ? value
    : value && typeof value === 'object'
      ? Object.keys(value).filter((k) => value[k])
      : [];
  const days = [];
  for (const item of raw) {
    const day = parseInt(item, 10);
    if (Number.isInteger(day) && day >= 0 && day <= 6 && !days.includes(day)) days.push(day);
  }
  return days.sort((a, b) => a - b);
}

function todayIso() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function defaultSchedule(timezone) {
  return {
    enabled: false,
    repeat: 'daily',
    days: [1, 2, 3, 4, 5],
    date: todayIso(),
    time: '03:00',
    timezone: timezone || 'Europe/London',
  };
}

/** "Mon-Fri", "Mon, Thu", "Every Sunday" — whichever reads best. */
function describeDays(days) {
  if (days.length === 7) return 'Every day';
  if (days.length === 1) return `Every ${WEEKDAY_NAMES[days[0]]}`;

  const ordered = DISPLAY_ORDER.filter((day) => days.includes(day));
  const groups = [];
  for (const day of ordered) {
    const current = groups[groups.length - 1];
    const isNext =
      current &&
      DISPLAY_ORDER.indexOf(day) === DISPLAY_ORDER.indexOf(current[current.length - 1]) + 1;
    if (isNext) current.push(day);
    else groups.push([day]);
  }

  return groups
    .map((group) =>
      group.length >= 3
        ? `${WEEKDAY_SHORT[group[0]]}-${WEEKDAY_SHORT[group[group.length - 1]]}`
        : group.map((day) => WEEKDAY_SHORT[day]).join(', ')
    )
    .join(', ');
}

/**
 * Translate a schedule into what croner needs.
 * @returns {{valid:boolean, error?:string, cron?:string, maxRuns?:number, description?:string}}
 */
function toCron(schedule) {
  const input = schedule || {};

  // Spiders created before the date/time editor may still carry a raw pattern.
  if (!input.time && input.cron) {
    return { valid: true, cron: input.cron, description: `cron: ${input.cron}` };
  }

  const repeat = REPEATS.includes(input.repeat) ? input.repeat : 'daily';
  const time = parseTime(input.time);
  if (!time) return { valid: false, error: 'time must look like 03:00' };

  const date = parseDate(input.date);
  if (!date && (repeat === 'monthly' || repeat === 'once')) {
    return { valid: false, error: 'choose a date' };
  }

  const { hour, minute } = time;
  const at = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

  switch (repeat) {
    case 'daily':
      return { valid: true, cron: `${minute} ${hour} * * *`, description: `Every day at ${at}` };
    case 'weekly': {
      // Schedules saved before multi-day support carried their single weekday
      // in `date` and have no `days` at all. An empty `days` is different: it
      // means the days were deliberately cleared, and must not silently fall
      // back to the date's weekday.
      const days =
        input.days === undefined ? (date ? [date.weekday] : []) : parseDays(input.days);
      if (!days.length) return { valid: false, error: 'choose at least one day of the week' };
      return {
        valid: true,
        cron: `${minute} ${hour} * * ${days.join(',')}`,
        description: `${describeDays(days)} at ${at}`,
      };
    }
    case 'monthly':
      return {
        valid: true,
        cron: `${minute} ${hour} ${date.day} * *`,
        description: `Day ${date.day} of every month at ${at}`,
      };
    case 'once':
      return {
        valid: true,
        cron: `${minute} ${hour} ${date.day} ${date.month} *`,
        maxRuns: 1,
        description: `Once on ${input.date} at ${at}`,
      };
    default:
      return { valid: false, error: `unknown repeat: ${repeat}` };
  }
}

/** Normalise whatever the UI sent, keeping the previous value where omitted. */
function normalise(incoming, current, fallbackTimezone) {
  const base =
    current && (current.time || current.cron) ? current : defaultSchedule(fallbackTimezone);

  // An older weekly schedule stored its single weekday in `date`; keep it.
  const baseDays = parseDays(base.days).length
    ? parseDays(base.days)
    : base.repeat === 'weekly' && parseDate(base.date)
      ? [parseDate(base.date).weekday]
      : [1, 2, 3, 4, 5];

  const next = {
    enabled: incoming.enabled !== undefined ? !!incoming.enabled : !!base.enabled,
    repeat: incoming.repeat !== undefined ? String(incoming.repeat) : base.repeat || 'daily',
    days: incoming.days !== undefined ? parseDays(incoming.days) : baseDays,
    date: incoming.date !== undefined ? String(incoming.date).trim() : base.date || todayIso(),
    time: incoming.time !== undefined ? String(incoming.time).trim() : base.time || '03:00',
    // Timezone is a single platform-wide setting, not a per-spider choice.
    timezone: fallbackTimezone || base.timezone || 'Europe/London',
  };
  if (!REPEATS.includes(next.repeat)) next.repeat = 'daily';
  return next;
}

function describe(schedule) {
  if (!schedule || !schedule.enabled) return 'manual only';
  const result = toCron(schedule);
  return result.valid ? result.description : `invalid: ${result.error}`;
}

module.exports = {
  REPEATS,
  WEEKDAY_SHORT,
  toCron,
  normalise,
  describe,
  describeDays,
  defaultSchedule,
  todayIso,
  parseDays,
};
