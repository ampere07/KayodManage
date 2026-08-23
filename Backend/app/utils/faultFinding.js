/**
 * What an admin FOUND, as distinct from what the money did.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 *
 * A proven no-show used to produce money movement and nothing else. `no_show_payout`
 * only ever happens because an admin concluded the CLIENT did not appear, and
 * `refund_client` on an open no-show review only happens because they concluded the
 * PROVIDER did not appear — yet neither left behind a reusable record saying so.
 *
 * The restrictions that did exist keyed off entirely different things: ambiguous
 * silent lapses, provider-initiated cancellations, and losing disputes you raised.
 * None of those is a finding of fault. "This client committed a confirmed no-show"
 * had nowhere to live, so it could not drive a sanction and could not be counted.
 *
 * ── Why fault is stated, never inferred ──────────────────────────────────────
 *
 * Deriving fault from the outcome is tempting and wrong. The same `refund_client`
 * covers "the provider never arrived", "the provider arrived and the work was
 * unacceptable", and "both sides agreed to call it off" — three different findings
 * with three different consequences. An admin states which, and an unstated finding
 * stays `uncertain`, which sanctions nobody. Recording ignorance honestly beats
 * manufacturing fault from a payment code.
 *
 * The two load-bearing rules:
 *
 *   - No party named ⇒ no sanction. `none` and `uncertain` are both terminal.
 *   - `emergency` ⇒ no sanction, even with a party named. Somebody had to be absent
 *     for the money to move, but absence WITH A CAUSE is not misconduct, and a
 *     strike for it punishes the party who reported honestly.
 *
 * A non-sanctionable finding is still RECORDED. That is the point of separating the
 * two: analytics wants every finding, sanctions want a subset.
 */

/** Who the admin found at fault. Closed set. */
const FAULT_PARTIES = Object.freeze([
	"client",
	"provider",
	"both",
	"none",
	"uncertain",
]);

/** What they found happened. Closed set. */
const FINDING_REASONS = Object.freeze([
	"no_show",
	"late_cancel",
	"access_failure",
	"emergency",
	"other",
]);

/**
 * Reasons that describe conduct a party could have avoided.
 *
 * `emergency` is excluded on purpose (see header). `other` is excluded because it
 * carries no information — an admin who has actually established misconduct can
 * name which kind, and sanctioning on "other" would make the reason field
 * decorative.
 */
const SANCTIONABLE_REASONS = Object.freeze([
	"no_show",
	"late_cancel",
	"access_failure",
]);

/** Parties that name a specific side (as opposed to declining to). */
const ACCUSING_PARTIES = Object.freeze(["client", "provider", "both"]);

/**
 * Coerce whatever the caller supplied into a valid finding.
 *
 * Unknown values fall back rather than being stored: a typo'd party must not
 * become a de-facto sixth enum member that later queries silently miss.
 *
 * @param {object} [input]
 * @param {string} [input.faultParty]
 * @param {string} [input.findingReason]
 * @param {string} [input.notes] admin-facing rationale; trimmed, never required
 * @returns {{faultParty: string, findingReason: string, notes: string|null}}
 */
function normalizeFinding(input = {}) {
	const raw = input || {};

	const faultParty = FAULT_PARTIES.includes(raw.faultParty)
		? raw.faultParty
		: "uncertain";

	const findingReason = FINDING_REASONS.includes(raw.findingReason)
		? raw.findingReason
		: "other";

	const trimmed = typeof raw.notes === "string" ? raw.notes.trim() : "";

	return { faultParty, findingReason, notes: trimmed || null };
}

/**
 * The roles this finding is against, as a list a caller can iterate.
 *
 * Returning a list rather than a string is what lets `both` be handled by the same
 * code path as a single party — the caller loops instead of branching, so it cannot
 * sanction one side and forget the other.
 *
 * @param {object} finding
 * @returns {string[]} "client" and/or "provider"; empty when nobody was named
 */
function partiesAtFault(finding) {
	const party = finding?.faultParty;
	if (party === "both") return ["client", "provider"];
	if (party === "client" || party === "provider") return [party];
	return [];
}

/**
 * Whether this finding may drive a sanction.
 *
 * @param {object} finding
 * @returns {boolean}
 */
function isSanctionable(finding) {
	if (!finding) return false;
	return (
		ACCUSING_PARTIES.includes(finding.faultParty) &&
		SANCTIONABLE_REASONS.includes(finding.findingReason)
	);
}

const REASON_PHRASES = Object.freeze({
	no_show: "committed a confirmed no-show",
	late_cancel: "cancelled too late to be reassigned",
	access_failure: "prevented access to the job location",
	emergency: "was absent for a documented emergency",
	other: "was found at fault",
});

/**
 * The finding as a readable clause, for the record and for admin-facing lists.
 *
 * @param {object} finding
 * @returns {string}
 */
function describeFinding(finding) {
	const parties = partiesAtFault(finding);
	if (parties.length === 0) return "no fault established";

	const subject = parties.length === 2 ? "both parties" : parties[0];
	return `${subject} ${REASON_PHRASES[finding.findingReason] || REASON_PHRASES.other}`;
}

/**
 * The record row for one party, or null when nothing should be recorded.
 *
 * A builder rather than a mutator on purpose: the only writer is KayodManage, and
 * a User there cannot be `.save()`d — the schema requires `name`/`email`/`phone`
 * fields an app-created account does not reliably have, so a full-document save
 * throws and the write silently never lands. (That exact bug disabled the
 * dispute-abuse restriction; see app/utils/disputeAbuse.js.) The caller pushes
 * this row with `$push` instead, and idempotency is a filter on the query rather
 * than a scan of an array held in memory.
 *
 * Returns null in the two cases that would put a false accusation on a permanent
 * record: the finding names nobody, or it names the OTHER party.
 *
 * @param {object} args
 * @param {string} args.jobId
 * @param {"client"|"provider"} args.role which side this user was on
 * @param {object} args.finding as produced by normalizeFinding
 * @param {string} [args.decidedBy] admin id
 * @param {Date} [args.decidedAt]
 * @returns {object|null}
 */
function buildFaultRow({ jobId, role, finding, decidedBy = null, decidedAt = null } = {}) {
	if (!jobId || !finding) return null;
	if (!partiesAtFault(finding).includes(role)) return null;

	return {
		jobId,
		role,
		faultParty: finding.faultParty,
		findingReason: finding.findingReason,
		notes: finding.notes || null,
		// Stored, not recomputed on read: whether a finding was actionable is a fact
		// about the rules AT THE TIME. If the sanctionable set is ever widened, old
		// rows must not retroactively become strikes nobody was told about.
		sanctioned: isSanctionable(finding),
		decidedBy,
		decidedAt: decidedAt || new Date(),
	};
}
/**
 * How many SANCTIONABLE findings this user has picked up in a rolling window.
 *
 * Non-sanctionable rows are excluded here rather than at write time, because the
 * record wants them (an emergency absence is real history) and the sanction does
 * not.
 *
 * @param {object} user
 * @param {object} args
 * @param {"client"|"provider"} args.role
 * @param {string} [args.reason] narrow to one findingReason
 * @param {number} [args.sinceDays=30]
 * @param {Date} [args.now] injectable for tests
 * @returns {number}
 */
function countRecentFaultFindings(user, { role, reason = null, sinceDays = 30, now = null } = {}) {
	const rows = user?.faultFindings;
	if (!Array.isArray(rows) || rows.length === 0) return 0;

	const end = now ? new Date(now).getTime() : Date.now();
	const start = end - sinceDays * 24 * 60 * 60 * 1000;

	return rows.filter((row) => {
		if (row.role !== role) return false;
		if (!row.sanctioned) return false;
		if (reason && row.findingReason !== reason) return false;
		const when = new Date(row.decidedAt).getTime();
		// Inclusive at both ends: a row landing exactly on the boundary is inside
		// the window, not silently dropped by a strict comparison.
		return Number.isFinite(when) && when >= start && when <= end;
	}).length;
}

module.exports = {
	FAULT_PARTIES,
	FINDING_REASONS,
	SANCTIONABLE_REASONS,
	normalizeFinding,
	partiesAtFault,
	isSanctionable,
	describeFinding,
	buildFaultRow,
	countRecentFaultFindings,
};
