const mongoose = require('mongoose');
const {
	LEGAL_DOCUMENTS,
	LEGAL_DOCUMENTS_BY_ID,
	LEGAL_VERSION,
	LEGAL_LAST_UPDATED,
} = require('../config/legal');

/**
 * LegalDocument — the admin-editable store for the five Kayod legal documents.
 *
 * ── What is stored, and what deliberately is not ─────────────────────────────
 *
 * Only the CONTENT is stored: titles, the preamble, and the sections. The facts
 * that make a document routable and role-scoped — its navigator route, its
 * icon, whether it binds clients or providers — stay in code, in
 * client/src/config/legal. An admin editing the Provider Agreement's prose
 * should not be able to reassign it to clients, unroute it, or rename its id;
 * those are code changes with code review, not content edits.
 *
 * ── Seeding ──────────────────────────────────────────────────────────────────
 *
 * getDocuments() seeds from src/config/legal on first read, which is generated
 * from the client copy by kayod/scripts/generate-legal-seed.js. So a fresh
 * deployment and an untouched one hold byte-identical text, and the app's
 * bundled fallback is the same text the API serves.
 *
 * ── Versioning ───────────────────────────────────────────────────────────────
 *
 * Every save stamps `version` and bumps `revision`. Clickwrap consent is only
 * evidence if it records WHICH text was accepted, so these are the values a
 * recorded acceptance must carry. `sourceVersion` keeps the shipped version the
 * record was seeded from, so an admin edit is always distinguishable from the
 * text counsel executed.
 */

// Blocks are free-form by design: the five block types are described in
// config/legal/blocks.js and validated at the controller, not by a Mongoose
// sub-schema. Encoding the union here would mean editing the schema (and a
// migration) every time a document needs a structure it does not yet use.
const sectionSchema = new mongoose.Schema(
	{
		id: { type: String, required: true, trim: true },
		number: { type: Number, default: 0 },
		title: { type: String, required: true, trim: true },
		blocks: { type: [mongoose.Schema.Types.Mixed], default: [] },
	},
	{ _id: false },
);

const legalDocumentSchema = new mongoose.Schema({
	// Matches the id in config/legal — the key the client merges live content
	// onto its bundled copy by.
	documentId: {
		type: String,
		required: true,
		unique: true,
		trim: true,
	},
	title: { type: String, required: true, trim: true },
	shortTitle: { type: String, required: true, trim: true },
	subtitle: { type: String, trim: true, default: '' },
	intro: { type: String, required: true },
	sections: { type: [sectionSchema], default: [] },

	// The version an acceptance of this text should be recorded against.
	version: { type: String, default: LEGAL_VERSION },
	// The shipped version this record was seeded from. Diverges from `version`
	// once an admin edits, which is exactly the signal "this is no longer the
	// text that was reviewed by counsel".
	sourceVersion: { type: String, default: LEGAL_VERSION },
	// Monotonic per-document counter. Cheap way to tell two edits apart on the
	// same day without depending on clock precision.
	revision: { type: Number, default: 1 },
	lastUpdatedLabel: { type: String, default: LEGAL_LAST_UPDATED },

	updatedAt: { type: Date, default: Date.now },
	// uid/email of the admin who last saved. Legal text edits are the kind of
	// change that gets asked about months later.
	updatedBy: { type: String, trim: true },
});

legalDocumentSchema.pre('save', function (next) {
	this.updatedAt = new Date();
	next();
});

/** Shape one seed document from config/legal into a storable record. */
function toRecord(doc) {
	return {
		documentId: doc.id,
		title: doc.title,
		shortTitle: doc.shortTitle,
		subtitle: doc.subtitle || '',
		intro: doc.intro,
		sections: doc.sections,
		version: LEGAL_VERSION,
		sourceVersion: LEGAL_VERSION,
		revision: 1,
		lastUpdatedLabel: LEGAL_LAST_UPDATED,
	};
}

/**
 * Every document, seeding any that are missing.
 *
 * Seeds per-document rather than all-or-nothing so that adding a sixth document
 * to the corpus in a later release seeds just that one, leaving admin edits to
 * the other five untouched.
 */
legalDocumentSchema.statics.getDocuments = async function () {
	const existing = await this.find().lean();
	const existingIds = new Set(existing.map((doc) => doc.documentId));

	const missing = LEGAL_DOCUMENTS.filter((doc) => !existingIds.has(doc.id));
	if (missing.length > 0) {
		await this.insertMany(missing.map(toRecord), { ordered: false }).catch(
			// A concurrent boot seeding the same document is a duplicate-key
			// error, not a failure: the document exists either way.
			(error) => {
				if (error?.code !== 11000) throw error;
			},
		);
		return this.find().lean();
	}

	return existing;
};

/** One document by id, seeded if missing. Returns null for an unknown id. */
legalDocumentSchema.statics.getDocument = async function (documentId) {
	const seed = LEGAL_DOCUMENTS_BY_ID[documentId];
	if (!seed) return null;

	const existing = await this.findOne({ documentId }).lean();
	if (existing) return existing;

	await this.create(toRecord(seed));
	return this.findOne({ documentId }).lean();
};

/** Discard admin edits and restore the text that shipped with the build. */
legalDocumentSchema.statics.resetDocument = async function (documentId, updatedBy) {
	const seed = LEGAL_DOCUMENTS_BY_ID[documentId];
	if (!seed) return null;

	const current = await this.findOne({ documentId });
	const record = toRecord(seed);

	if (!current) {
		await this.create({ ...record, updatedBy });
		return this.findOne({ documentId }).lean();
	}

	Object.assign(current, record, {
		// A reset is an edit like any other — the revision keeps climbing so the
		// history reads as a sequence rather than appearing to rewind.
		revision: (current.revision || 1) + 1,
		updatedBy,
	});
	await current.save();
	return this.findOne({ documentId }).lean();
};

/**
 * The corpus in the shape the client app consumes.
 *
 * `id` rather than `documentId`, because that is the key the client's bundled
 * copy is indexed by and the merge in legalStore.getDocument() keys off it.
 */
legalDocumentSchema.statics.getPublicDocuments = async function () {
	const documents = await this.getDocuments();

	// Presentation order comes from the code-side corpus, not from Mongo's
	// natural order, so the Legal Center lists them the same way every time.
	const order = LEGAL_DOCUMENTS.map((doc) => doc.id);
	const byId = new Map(documents.map((doc) => [doc.documentId, doc]));

	return order
		.map((id) => byId.get(id))
		.filter(Boolean)
		.map((doc) => ({
			id: doc.documentId,
			title: doc.title,
			shortTitle: doc.shortTitle,
			subtitle: doc.subtitle,
			intro: doc.intro,
			sections: doc.sections,
			version: doc.version,
			revision: doc.revision,
			lastUpdatedLabel: doc.lastUpdatedLabel,
			updatedAt: doc.updatedAt,
		}));
};

module.exports = mongoose.model(
	'LegalDocument',
	legalDocumentSchema,
	'legaldocuments',
);
