const LegalDocument = require('../models/LegalDocument');
const { LEGAL_DOCUMENTS_BY_ID, LEGAL_VERSION } = require('../config/legal');

/**
 * legalController — admin CRUD over the five Kayod legal documents.
 *
 * ── What an admin may change ─────────────────────────────────────────────────
 *
 * Content only: the title lines, the preamble, and the sections with their
 * blocks. Not the document set, not the ids, not the routes, not which role a
 * document binds. Those are structural: the client merges live content onto its
 * bundled copy keyed by id, and the Legal Center decides what to show a client
 * versus a provider from the audience in code. Letting an editor change them
 * would let a prose edit silently unroute a document or show the Provider
 * Agreement to clients as though it bound them.
 *
 * ── Why the block validation is strict ───────────────────────────────────────
 *
 * The client renders these blocks directly. A block with an unknown type
 * renders as nothing at all — which on a legal screen means a clause silently
 * disappearing between the admin saving and the user reading, with no error
 * anywhere. So an unrecognised block is a 400 here rather than a hole there.
 */

/** The five block types the client's LegalBlocks renderer knows. */
const BLOCK_TYPES = new Set(['p', 'clauses', 'bullets', 'sub', 'table']);

const isNonEmptyString = (value) =>
  typeof value === 'string' && value.trim().length > 0;

/**
 * Validate one block, recursively. Returns an error string, or null when valid.
 * `path` is carried through so the message names the offending block rather
 * than making an editor hunt for it in a nineteen-section document.
 */
function validateBlock(block, path) {
  if (!block || typeof block !== 'object') {
    return `${path} must be an object`;
  }
  if (!BLOCK_TYPES.has(block.type)) {
    return `${path} has unknown type "${block.type}". Allowed: ${[...BLOCK_TYPES].join(', ')}`;
  }

  switch (block.type) {
    case 'p':
      if (!isNonEmptyString(block.text)) return `${path} (paragraph) needs text`;
      return null;

    case 'clauses':
    case 'bullets': {
      if (!Array.isArray(block.items) || block.items.length === 0) {
        return `${path} (${block.type}) needs at least one item`;
      }
      const bad = block.items.findIndex((item) => !isNonEmptyString(item));
      if (bad !== -1) return `${path}.items[${bad}] must be non-empty text`;
      return null;
    }

    case 'sub': {
      if (!isNonEmptyString(block.title)) return `${path} (sub) needs a title`;
      if (!Array.isArray(block.blocks) || block.blocks.length === 0) {
        return `${path} (sub) needs at least one block`;
      }
      for (let i = 0; i < block.blocks.length; i += 1) {
        const error = validateBlock(block.blocks[i], `${path}.blocks[${i}]`);
        if (error) return error;
      }
      return null;
    }

    case 'table': {
      if (!Array.isArray(block.head) || block.head.length < 2) {
        return `${path} (table) needs at least two columns`;
      }
      if (!Array.isArray(block.rows) || block.rows.length === 0) {
        return `${path} (table) needs at least one row`;
      }
      // A ragged table renders cells against the wrong column headings, which
      // on a payment-model comparison means showing Category A's release timing
      // under Category B.
      const ragged = block.rows.findIndex(
        (row) => !Array.isArray(row) || row.length !== block.head.length,
      );
      if (ragged !== -1) {
        return `${path}.rows[${ragged}] must have exactly ${block.head.length} cells`;
      }
      return null;
    }

    default:
      return `${path} has unsupported type`;
  }
}

/** Validate the sections array an admin submitted. */
function validateSections(sections) {
  if (!Array.isArray(sections) || sections.length === 0) {
    return 'A document needs at least one section';
  }

  const seenIds = new Set();

  for (let i = 0; i < sections.length; i += 1) {
    const section = sections[i];
    const path = `sections[${i}]`;

    if (!section || typeof section !== 'object') return `${path} must be an object`;
    if (!isNonEmptyString(section.id)) return `${path} needs an id`;
    if (!isNonEmptyString(section.title)) return `${path} needs a title`;

    // Section ids are deep-link targets — "Cancellation Policy" links open
    // PlatformPolicies/ClientTerms at a named section. Two sections sharing an
    // id makes which one a link opens arbitrary.
    if (seenIds.has(section.id)) return `${path} duplicates the id "${section.id}"`;
    seenIds.add(section.id);

    if (section.number !== undefined) {
      const number = Number(section.number);
      if (!Number.isInteger(number) || number < 0) {
        return `${path}.number must be a non-negative integer`;
      }
    }

    if (!Array.isArray(section.blocks) || section.blocks.length === 0) {
      return `${path} needs at least one block`;
    }
    for (let b = 0; b < section.blocks.length; b += 1) {
      const error = validateBlock(section.blocks[b], `${path}.blocks[${b}]`);
      if (error) return error;
    }
  }

  return null;
}

/** All five documents, for the admin editor. */
exports.getLegalDocuments = async (req, res) => {
  try {
    const documents = await LegalDocument.getDocuments();

    res.status(200).json({
      success: true,
      documents,
      // What the shipped build carries, so the editor can show which documents
      // have been edited away from the version counsel executed.
      sourceVersion: LEGAL_VERSION,
    });
  } catch (error) {
    console.error('Error fetching legal documents:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch legal documents',
      error: error.message,
    });
  }
};

exports.updateLegalDocument = async (req, res) => {
  try {
    const { documentId } = req.params;

    if (!LEGAL_DOCUMENTS_BY_ID[documentId]) {
      return res.status(404).json({
        success: false,
        message: `Unknown legal document "${documentId}"`,
      });
    }

    const document = await LegalDocument.getDocument(documentId);
    if (!document) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    const record = await LegalDocument.findOne({ documentId });

    const { title, shortTitle, subtitle, intro, sections, version } = req.body;

    if (title !== undefined) {
      if (!isNonEmptyString(title)) {
        return res.status(400).json({ success: false, message: 'title cannot be empty' });
      }
      record.title = title.trim();
    }

    if (shortTitle !== undefined) {
      if (!isNonEmptyString(shortTitle)) {
        return res.status(400).json({ success: false, message: 'shortTitle cannot be empty' });
      }
      record.shortTitle = shortTitle.trim();
    }

    // Subtitle is the one optional line — clearing it is a legitimate edit.
    if (subtitle !== undefined) {
      record.subtitle = typeof subtitle === 'string' ? subtitle.trim() : '';
    }

    if (intro !== undefined) {
      if (!isNonEmptyString(intro)) {
        return res.status(400).json({ success: false, message: 'intro cannot be empty' });
      }
      record.intro = intro;
    }

    if (sections !== undefined) {
      const error = validateSections(sections);
      if (error) {
        return res.status(400).json({ success: false, message: error });
      }
      record.sections = sections;
    }

    // An explicit version is how an admin marks an amendment: the Terms say
    // amendments take effect on posting with notice, and a consent record is
    // only meaningful if it names the text it covers. Left alone, the version
    // stays put and the revision still climbs, which is the right behaviour for
    // a typo fix.
    if (version !== undefined) {
      if (!isNonEmptyString(version)) {
        return res.status(400).json({ success: false, message: 'version cannot be empty' });
      }
      record.version = version.trim();
    }

    record.revision = (record.revision || 1) + 1;
    record.updatedBy = req.session?.email || req.session?.uid || 'admin';

    await record.save();

    // Live clients poll rather than subscribe, so this only refreshes any admin
    // browser with the editor open; the app picks the change up on its next
    // fetch. Mirrors how job-posting settings are broadcast.
    req.app?.get?.('io')?.emit?.('configuration:updated', { type: 'legal-documents', documentId });

    res.status(200).json({
      success: true,
      document: await LegalDocument.findOne({ documentId }).lean(),
    });
  } catch (error) {
    console.error('Error updating legal document:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update legal document',
      error: error.message,
    });
  }
};

/**
 * Restore a document to the text that shipped with the build.
 *
 * The escape hatch for an edit that went wrong. Legal text is the content most
 * costly to get wrong and least amenable to being fixed by re-typing it from
 * memory, so there is always a way back to the executed version.
 */
exports.resetLegalDocument = async (req, res) => {
  try {
    const { documentId } = req.params;

    if (!LEGAL_DOCUMENTS_BY_ID[documentId]) {
      return res.status(404).json({
        success: false,
        message: `Unknown legal document "${documentId}"`,
      });
    }

    const document = await LegalDocument.resetDocument(
      documentId,
      req.session?.email || req.session?.uid || 'admin',
    );

    req.app?.get?.('io')?.emit?.('configuration:updated', { type: 'legal-documents', documentId });

    res.status(200).json({ success: true, document });
  } catch (error) {
    console.error('Error resetting legal document:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset legal document',
      error: error.message,
    });
  }
};

// Exported for the controller's unit tests — the block validator is the only
// thing standing between an admin typo and a clause vanishing from the app.
exports._validateSections = validateSections;
exports._validateBlock = validateBlock;
