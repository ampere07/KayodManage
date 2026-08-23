/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Mirrored from kayod/client/src/config/legal by kayod/scripts/generate-legal-seed.js.
 * Edit the client copy and re-run the generator; CI fails if these drift.
 */

const { LEGAL_VERSION, LEGAL_LAST_UPDATED } = require("./blocks");
const termsOfUse = require("./termsOfUse");
const clientTerms = require("./clientTerms");
const providerAgreement = require("./providerAgreement");
const serviceCategories = require("./serviceCategories");
const privacyPolicy = require("./privacyPolicy");

/** The corpus in presentation order, matching the client. */
const LEGAL_DOCUMENTS = [termsOfUse, clientTerms, providerAgreement, serviceCategories, privacyPolicy];

const LEGAL_DOCUMENTS_BY_ID = LEGAL_DOCUMENTS.reduce((acc, doc) => {
  acc[doc.id] = doc;
  return acc;
}, {});

const LEGAL_DOCUMENT_IDS = LEGAL_DOCUMENTS.map((doc) => doc.id);

module.exports = {
  LEGAL_VERSION,
  LEGAL_LAST_UPDATED,
  LEGAL_DOCUMENTS,
  LEGAL_DOCUMENTS_BY_ID,
  LEGAL_DOCUMENT_IDS,
  termsOfUse,
  clientTerms,
  providerAgreement,
  serviceCategories,
  privacyPolicy,
};
