/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Mirrored from kayod/client/src/config/legal by kayod/scripts/generate-legal-seed.js.
 * Edit the client copy and re-run the generator; CI fails if these drift.
 */

/**
 * termsOfUse.js — KAYOD PLATFORM TERMS OF USE (Common Core).
 *
 * Verbatim transcription of the executed source document. Do not paraphrase,
 * shorten, or "improve" the wording here: this is the text users are shown when
 * they accept, and the app's copy of an agreement has to match the agreement.
 * Substantive edits belong to counsel, and every one of them must bump
 * LEGAL_VERSION in ./blocks.js.
 *
 * Bracketed placeholders (e.g. "[City]") are reproduced as they appear in the
 * source. They are unresolved in the document itself and must be filled in by
 * counsel before launch — see LEGAL_PLACEHOLDERS in ./index.js.
 */

const termsOfUse = {
  id: "termsOfUse",
  route: "TermsOfService",
  title: "Kayod Platform Terms of Use",
  shortTitle: "Terms of Use",
  subtitle: "Common Core – Applicable to All Users",
  icon: "gravity-ui:file-text",
  audience: "all",

  intro:
    "These Terms of Use (the “Terms”) govern access to and use of the Kayod platform and application (the “Platform”), operated by Kayod Corp. (“Kayod”, “we”, “us”). They apply to every user, whether acting as a Client or a Provider. Providers are additionally bound by the Independent Service Provider Agreement; Clients are additionally bound by the Client Terms; and all users are bound by the Service Categories & Payment Models and the Privacy Policy.",

  sections: [
    {
      id: "acceptance",
      number: 1,
      title: "Acceptance and Eligibility",
      blocks: [
        {
          type: "clauses",
          items: [
            "By creating an account or using the Platform, you agree to these Terms, the Privacy Policy, the Service Categories & Payment Models, and the role-specific terms applicable to you. If you do not agree, do not use the Platform.",
            "You must be at least eighteen (18) years old and legally capable of contracting under Philippine law. If you use the Platform for an entity, you represent that you are authorized to bind it.",
          ],
        },
      ],
    },
    {
      id: "definitions",
      number: 2,
      title: "Definitions",
      blocks: [
        {
          type: "clauses",
          items: [
            "“Client” means a user who requests, books, or engages services through the Platform.",
            "“Provider” means a user who offers or renders services to Clients through the Platform.",
            "“Payment Service Provider” means the licensed third-party payment institution engaged to collect, hold, and disburse payments.",
            "“Service Categories” means the Service Categories and Payment Models document, which classifies services and sets the payment model applicable to each, and which forms part of these Terms and the role-specific terms.",
            "“Content” means any text, images, ratings, reviews, or other materials submitted through the Platform.",
          ],
        },
      ],
    },
    {
      id: "natureOfPlatform",
      number: 3,
      title: "Nature of the Platform",
      blocks: [
        {
          type: "clauses",
          items: [
            "The Platform is a neutral technology venue and facilitator that connects Clients and Providers. Kayod is not a party to the service contract between a Client and a Provider, does not employ Providers, and does not perform, supervise, or guarantee the services offered by Providers.",
            "Kayod’s role is limited to providing the marketplace technology, facilitating communication, and facilitating payment through the Payment Service Provider.",
          ],
        },
      ],
    },
    {
      id: "accounts",
      number: 4,
      title: "Accounts and Security",
      blocks: [
        {
          type: "clauses",
          items: [
            "You are responsible for maintaining the confidentiality of your account credentials and for all activity under your account. Notify us promptly of any unauthorized use.",
            "You agree to provide accurate, current, and complete information and to keep it updated. We may verify your identity and may suspend accounts with inaccurate or fraudulent information.",
          ],
        },
      ],
    },
    {
      id: "acceptableUse",
      number: 5,
      title: "Acceptable Use and Prohibited Conduct",
      blocks: [
        { type: "p", text: "You agree not to:" },
        {
          type: "bullets",
          items: [
            "use the Platform for any unlawful, fraudulent, harassing, or harmful purpose;",
            "impersonate any person or misrepresent your identity, affiliation, or qualifications;",
            "post false, misleading, defamatory, or infringing Content;",
            "interfere with, disrupt, reverse-engineer, or gain unauthorized access to the Platform or its systems;",
            "circumvent the Platform’s payment facilities in violation of these Terms; or",
            "collect other users’ data except as necessary to perform or receive a service.",
          ],
        },
      ],
    },
    {
      id: "payments",
      number: 6,
      title: "Payments",
      blocks: [
        {
          type: "clauses",
          items: [
            "Payments through the Platform are processed by the Payment Service Provider. By transacting, you authorize the collection, holding, and disbursement of funds in accordance with these Terms and the applicable role-specific terms.",
            "The timing of payment release, and whether a warranty hold applies, depend on the category of service under the Service Categories document. For outcome-based services, the Provider is paid in full after a five-day warranty period; session-based services are settled in a single release shortly after completion, without a warranty hold. Kayod may charge fees, disclosed before a transaction is completed, which are non-refundable except as stated or required by law.",
          ],
        },
      ],
    },
    {
      id: "contentAndIp",
      number: 7,
      title: "Content and Intellectual Property",
      blocks: [
        {
          type: "clauses",
          items: [
            "The Platform, including its software, design, trademarks, and content, is owned by Kayod or its licensors. We grant you a limited, revocable, non-exclusive, non-transferable license to use the Platform for its intended purpose.",
            "You retain ownership of Content you submit but grant Kayod a non-exclusive, worldwide, royalty-free license to host, display, and use that Content to operate and promote the Platform. You are responsible for having the rights to any Content you submit.",
          ],
        },
      ],
    },
    {
      id: "ratingsAndReviews",
      number: 8,
      title: "Ratings and Reviews",
      blocks: [
        {
          type: "clauses",
          items: [
            "Ratings and reviews reflect user feedback and are a marketplace feature. They must be honest and lawful. Kayod may remove Content that violates these Terms but does not endorse user Content.",
          ],
        },
      ],
    },
    {
      id: "disclaimers",
      number: 9,
      title: "Disclaimers",
      blocks: [
        {
          type: "clauses",
          items: [
            "The Platform is provided on an “as is” and “as available” basis. To the fullest extent permitted by law, Kayod disclaims all warranties, express or implied, regarding the Platform and the services rendered by Providers, including as to quality, safety, legality, or fitness for a particular purpose.",
            "Kayod does not guarantee the availability of Providers, Clients, or service requests, or uninterrupted or error-free operation.",
          ],
        },
      ],
    },
    {
      id: "limitationOfLiability",
      number: 10,
      title: "Limitation of Liability",
      blocks: [
        {
          type: "clauses",
          items: [
            "To the fullest extent permitted by law, Kayod shall not be liable for any indirect, incidental, special, or consequential damages, or for any loss arising from the acts or omissions of Clients or Providers. Kayod’s aggregate liability for any claim relating to the Platform shall not exceed the total fees Kayod earned from your transactions in the three (3) months preceding the event giving rise to the claim. Nothing here excludes liability that cannot be excluded under Philippine law.",
          ],
        },
      ],
    },
    {
      id: "indemnification",
      number: 11,
      title: "Indemnification",
      blocks: [
        {
          type: "clauses",
          items: [
            "You agree to indemnify and hold harmless Kayod, its officers, directors, and employees from any claim, liability, loss, or expense (including reasonable attorney’s fees) arising from your use of the Platform, your Content, your breach of these Terms, or your violation of any law or third-party right.",
          ],
        },
      ],
    },
    {
      id: "dataPrivacy",
      number: 12,
      title: "Data Privacy",
      blocks: [
        {
          type: "clauses",
          items: [
            "Kayod processes personal data in accordance with Republic Act No. 10173 (the Data Privacy Act of 2012), its Implementing Rules and Regulations, and the Kayod Privacy Policy, incorporated by reference. By using the Platform, you consent to such processing as described in the Privacy Policy.",
          ],
        },
      ],
    },
    {
      id: "suspensionAndTermination",
      number: 13,
      title: "Suspension and Termination",
      blocks: [
        {
          type: "clauses",
          items: [
            "You may stop using the Platform and close your account at any time. We may suspend or terminate access for breach of these Terms, failure to meet published eligibility criteria, fraud, unlawful conduct, or risk to other users or the Platform, subject to our published process and applicable law.",
            "Provisions that by their nature should survive termination – including intellectual property, disclaimers, limitation of liability, indemnification, data privacy, and dispute resolution – shall survive.",
          ],
        },
      ],
    },
    {
      id: "amendments",
      number: 14,
      title: "Amendments",
      blocks: [
        {
          type: "clauses",
          items: [
            "We may amend these Terms and the Service Categories by posting an updated version and notifying users through the Platform. Continued use after the effective date constitutes acceptance. If you do not agree, your remedy is to stop using the Platform and close your account.",
          ],
        },
      ],
    },
    {
      id: "governingLaw",
      number: 15,
      title: "Governing Law and Dispute Resolution",
      blocks: [
        {
          type: "clauses",
          items: [
            "These Terms are governed by the laws of the Republic of the Philippines.",
            "The Parties shall first attempt in good faith to resolve any dispute amicably. Any unresolved dispute shall be submitted to the exclusive jurisdiction of the proper courts of [City], Metro Manila, to the exclusion of all other venues.",
          ],
        },
      ],
    },
    {
      id: "miscellaneous",
      number: 16,
      title: "Miscellaneous",
      blocks: [
        {
          type: "clauses",
          items: [
            "Entire Agreement. These Terms, together with the Privacy Policy, the Service Categories & Payment Models, and the applicable role-specific terms, constitute the entire agreement between you and Kayod regarding the Platform.",
            "Severability. If any provision is held invalid, the remaining provisions remain in force, and the invalid provision shall be reformed to the minimum extent necessary.",
            "Assignment. You may not assign these Terms without our written consent. We may assign these Terms in connection with a reorganization or transfer of our business.",
            "No Waiver. Our failure to enforce any provision is not a waiver of the right to enforce it later.",
            "Force Majeure. Kayod is not liable for any delay or failure caused by events beyond its reasonable control.",
          ],
        },
      ],
    },
    {
      id: "acknowledgment",
      number: 17,
      title: "Acknowledgment",
      blocks: [
        {
          type: "p",
          text: "By tapping “I have read and agree” (or an equivalent affirmation) during enrollment, you acknowledge that you have read, understood, and agreed to these Terms, the Privacy Policy, the Service Categories & Payment Models, and the role-specific terms applicable to you.",
        },
      ],
    },
  ],
};

module.exports = termsOfUse;