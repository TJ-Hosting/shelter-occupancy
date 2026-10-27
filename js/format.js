// Formatting helpers. Numbers are shown exactly as the snapshot holds them: no rounding of
// counts, rates to one decimal as computed by scripts/fetch_data.py.

const NUM = new Intl.NumberFormat("en-CA");

export function n(value) {
	return value == null ? "—" : NUM.format(value);
}

export function pct(value) {
	return value == null ? "—" : `${value.toFixed(1)}%`;
}

function utc(iso) {
	const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
	return new Date(Date.UTC(y, m - 1, d));
}

export function isoToSeconds(iso) {
	return utc(iso).getTime() / 1000;
}

const LONG = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", weekday: "long", year: "numeric", month: "long", day: "numeric" });
const MEDIUM = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" });
const MONTH = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", month: "short", day: "numeric" });

export function dateLong(iso) { return iso ? LONG.format(utc(iso)) : "—"; }
export function dateMedium(iso) { return iso ? MEDIUM.format(utc(iso)) : "—"; }
export function dateMonthDay(iso) { return iso ? MONTH.format(utc(iso)) : "—"; }

// Today's date in Toronto, as YYYY-MM-DD.
export function torontoToday(now = new Date()) {
	const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
	const get = (t) => parts.find((p) => p.type === t).value;
	return `${get("year")}-${get("month")}-${get("day")}`;
}

export function daysBetween(fromIso, toIso) {
	return Math.round((utc(toIso) - utc(fromIso)) / 86400000);
}

// OCCUPANCY_DATE is the evening of the overnight period, counted at 4:00 am the next morning
// (City field note, docs/DATA.md §2). "Last night" only when that evening was yesterday in Toronto.
export function nightLabel(occupancyDate, now = new Date()) {
	const ago = daysBetween(occupancyDate, torontoToday(now));
	return ago === 1
		? { lastNight: true, text: `Last night (${dateLong(occupancyDate)})` }
		: { lastNight: false, text: `Latest count — night of ${dateLong(occupancyDate)}` };
}

export function css(name) {
	return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function el(tag, attrs = {}, ...children) {
	const node = document.createElement(tag);
	for (const [k, v] of Object.entries(attrs)) {
		if (v == null) continue;
		if (k === "class") node.className = v;
		else if (k === "style") node.style.cssText = v;
		else if (k === "text") node.textContent = v;
		else node.setAttribute(k, v);
	}
	for (const c of children) {
		if (c == null) continue;
		node.append(c instanceof Node ? c : document.createTextNode(String(c)));
	}
	return node;
}
