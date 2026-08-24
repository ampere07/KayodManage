/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Mirrored from kayod/client/src/config/legal by kayod/scripts/generate-legal-seed.js.
 * Edit the client copy and re-run the generator; CI fails if these drift.
 */

/**
 * blocks.js — the shape every Kayod legal document is written in.
 *
 * ── Why a data format and not JSX, and not locale strings ────────────────────
 *
 * These five documents are the executed text of agreements users are asked to
 * accept. Two properties matter more than anything else about how they are
 * stored:
 *
 *   1. They must be transcribed *verbatim*. A paraphrase in the app is not the
 *      agreement the user accepted, and a summary that drifts from the source
 *      is worse than no text at all. So the content lives as data, one file per
 *      source document, and no screen is allowed to rewrite it in passing.
 *
 *   2. They must not be translated. The locale files (en/es/fil/zh) previously
 *      carried a paraphrased Terms and Privacy Policy in four languages, which
 *      means four subtly different contracts. Legal text is authored in one
 *      language and stays there; only the *chrome* around it (screen titles,
 *      "Last updated", button labels) is translatable. That is why these
 *      documents deliberately sit in config/ and not in locales/.
 *
 * ── The block types ──────────────────────────────────────────────────────────
 *
 * A document is a list of sections; a section is a list of blocks. There are
 * only five block types, chosen because they are the only structures the source
 * documents actually use:
 *
 *   { type: "p", text }
 *       A plain paragraph. Used for lead-ins ("You agree not to:") and for
 *       recitals and preambles that carry no clause number.
 *
 *   { type: "clauses", items: [string] }
 *       The numbered sub-clauses of a section. Rendered "3.1", "3.2", … from
 *       the section's own number, so renumbering a section can never desync the
 *       clause numbers from it.
 *
 *   { type: "bullets", items: [string] }
 *       An unnumbered enumeration under a lead-in paragraph — the prohibited-
 *       conduct lists, the definition lists, the data-subject rights. These are
 *       sub-items of a single clause in the source, not clauses in their own
 *       right, so numbering them would invent citations that do not exist.
 *
 *   { type: "sub", title, blocks: [...] }
 *       A titled sub-part carrying its own blocks — Schedule A's "3.1 Category
 *       A", the Privacy Policy's "2.1 Information all users provide".
 *
 *   { type: "table", head: [string], rows: [[string]] }
 *       Schedule A's category-to-model mapping. The only table in the corpus.
 *
 * @typedef {{ type: "p", text: string }} ParagraphBlock
 * @typedef {{ type: "clauses", items: string[] }} ClausesBlock
 * @typedef {{ type: "bullets", items: string[] }} BulletsBlock
 * @typedef {{ type: "sub", title: string, blocks: LegalBlock[] }} SubBlock
 * @typedef {{ type: "table", head: string[], rows: string[][] }} TableBlock
 * @typedef {ParagraphBlock|ClausesBlock|BulletsBlock|SubBlock|TableBlock} LegalBlock
 *
 * @typedef {object} LegalSection
 * @property {string} id      Stable slug. Used as the deep-link target, so it
 *                            must not change when a document is renumbered.
 * @property {number} number  The section number as printed in the source.
 * @property {string} title   The section heading, without its number.
 * @property {string} [icon]  Optional icon for the section's accordion row.
 * @property {LegalBlock[]} blocks
 *
 * @typedef {object} LegalDocument
 * @property {string} id
 * @property {string} route         Navigator route that renders this document.
 * @property {string} title         Full title, as printed.
 * @property {string} shortTitle    Title for list rows and links.
 * @property {string} subtitle      The document's own subtitle line, if any.
 * @property {string} icon
 * @property {"all"|"client"|"provider"} audience
 * @property {string} intro         The unnumbered preamble.
 * @property {LegalSection[]} sections
 * @property {string} [closing]     Trailing unnumbered text (acknowledgments).
 */

const BLOCK = {
  PARAGRAPH: "p",
  CLAUSES: "clauses",
  BULLETS: "bullets",
  SUB: "sub",
  TABLE: "table",
};

/**
 * The version stamp shown on every document and — once acceptance is recorded
 * server-side — the value that must be stored alongside a user's consent.
 *
 * Bump this whenever any document in this folder changes in substance. It is
 * deliberately one stamp for the whole corpus rather than one per document:
 * the documents incorporate each other by reference, so accepting the Terms on
 * one date means accepting the Schedule A that was in force on that date, and a
 * single version is the only honest way to record that.
 */
const LEGAL_VERSION = "2026.08";

/** Human-readable form of LEGAL_VERSION, for the "Last updated" line. */
const LEGAL_LAST_UPDATED = "Last updated: August 2026";

module.exports = { BLOCK, LEGAL_VERSION, LEGAL_LAST_UPDATED };