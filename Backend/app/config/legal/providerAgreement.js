/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Mirrored from kayod/client/src/config/legal by kayod/scripts/generate-legal-seed.js.
 * Edit the client copy and re-run the generator; CI fails if these drift.
 */

/**
 * providerAgreement.js — INDEPENDENT SERVICE PROVIDER AGREEMENT.
 *
 * Verbatim transcription of the executed source document. See ./termsOfUse.js
 * for why nothing here may be paraphrased.
 *
 * Note on the recitals: the source opens with three WHEREAS clauses and a NOW,
 * THEREFORE. They carry no section number, so they are modelled as section 0 —
 * the renderer omits the number for a zero-numbered section rather than
 * printing "0.1", which would invent a citation the document does not have.
 */

const providerAgreement = {
  id: "providerAgreement",
  route: "ProviderAgreement",
  title: "Independent Service Provider Agreement",
  shortTitle: "Provider Agreement",
  subtitle: "Provider Addendum to the Platform Terms of Use",
  icon: "gravity-ui:briefcase",
  audience: "provider",

  intro:
    "This Independent Service Provider Agreement (the “Agreement”) is between Kayod Corp. and the individual or entity who enrolls as a service provider and accepts this Agreement (the “Provider”). It supplements, and is read with, the Platform Terms of Use, the Service Categories & Payment Models, and the Privacy Policy.",

  sections: [
    {
      id: "recitals",
      number: 0,
      title: "Recitals",
      blocks: [
        {
          type: "p",
          text: "WHEREAS, the Platform operates a technology marketplace connecting independent service providers with clients, and does not itself render, supervise, or perform the services offered;",
        },
        {
          type: "p",
          text: "WHEREAS, the Provider is engaged in an independent trade, business, or profession and wishes to use the Platform to obtain client engagements while retaining full control over the manner and means of performing the services;",
        },
        {
          type: "p",
          text: "WHEREAS, the Parties intend a relationship of principal-to-independent-contractor and expressly do not intend to create any employer-employee relationship, partnership, joint venture, or agency;",
        },
        { type: "p", text: "NOW, THEREFORE, the Parties agree as follows:" },
      ],
    },
    {
      id: "definitions",
      number: 1,
      title: "Definitions",
      blocks: [
        {
          type: "clauses",
          items: [
            "“Client” means any user who requests, books, or engages a service through the Platform.",
            "“Service Request” means an engagement posted or booked by a Client which the Provider may, at the Provider’s sole discretion, accept or decline.",
            "“Services” means the work, tasks, or deliverables the Provider offers and renders directly to Clients.",
            "“Service Fee” means the platform facilitation fee described in Section 6.",
            "“Service Categories” means the Service Categories and Payment Models document, which classifies Services into Category A (outcome-based) and Category B (session-based), and sets the applicable payment model. This document forms part of this Agreement.",
            "“Payment Service Provider” means the licensed third-party payment institution engaged to hold and disburse payments.",
          ],
        },
      ],
    },
    {
      id: "natureOfRelationship",
      number: 2,
      title: "Nature of the Relationship",
      blocks: [
        {
          type: "clauses",
          items: [
            "The Provider is, and shall at all times remain, an independent contractor. Nothing in this Agreement creates an employer-employee relationship, partnership, joint venture, franchise, or agency.",
            "The Provider offers services to the public generally and is free to render similar services to others, whether or not in competition with the Platform; the Platform does not require exclusivity.",
            "Clients, not the Platform, choose Providers, and the Provider independently decides whether to accept any Service Request.",
            "The Platform does not pay wages, salary, or fixed remuneration. All amounts the Provider receives are the Provider’s own service charges collected from Clients, less the Service Fee, disbursed under Section 6 and the Service Categories document.",
            "The Platform does not exercise the power of dismissal characteristic of an employer. Access is governed by the objective eligibility standards in Section 10, not by managerial discretion or disciplinary authority.",
            "The Platform does not control or direct the means, methods, manner, sequence, or details by which the Provider performs the Services. Its interest is limited to the result contracted for by the Client and the Provider’s compliance with this Agreement and applicable law.",
          ],
        },
      ],
    },
    {
      id: "controlOverMeans",
      number: 3,
      title: "Provider’s Control Over Means and Methods",
      blocks: [
        {
          type: "p",
          text: "The Provider retains sole and exclusive control over the performance of the Services. In particular, the Provider:",
        },
        {
          type: "bullets",
          items: [
            "determines the methods, techniques, sequence, and procedures used;",
            "sets the Provider’s own working hours and days, with no obligation to be available at any particular time;",
            "may accept, decline, ignore, or cancel any Service Request, subject only to the Provider’s own commitments to Clients;",
            "supplies the Provider’s own tools, equipment, supplies, and materials, except where a Client agrees to furnish materials;",
            "performs Services at locations agreed with the Client, without direction from the Platform; and",
            "is not subject to training, supervision, performance appraisals, dress codes, or conduct rules imposed by the Platform, other than neutral, published community and safety standards applicable to all users.",
          ],
        },
      ],
    },
    {
      id: "nonExclusivity",
      number: 4,
      title: "Non-Exclusivity, Substitution, and Helpers",
      blocks: [
        {
          type: "clauses",
          items: [
            "This Agreement is non-exclusive. The Provider may engage in any other business, employment, or independent work at any time.",
            "The Provider may, at the Provider’s own cost and responsibility, engage the Provider’s own assistants, helpers, or subcontractors, provided the Provider remains fully responsible to the Client for the result and complies with Client requirements and the Platform’s safety standards.",
          ],
        },
      ],
    },
    {
      id: "pricingAndCompensation",
      number: 5,
      title: "Pricing and Compensation",
      blocks: [
        {
          type: "clauses",
          items: [
            "The consideration for the Services is a charge owed by the Client to the Provider. The Platform may provide suggested pricing tools, but the Provider is not obligated to adopt them and may set or negotiate the Provider’s own rates to the extent the Platform’s features permit.",
            "The Provider’s compensation is contingent on completion of a Service the Provider accepted. The Provider bears the ordinary business risk of profit and loss.",
          ],
        },
      ],
    },
    {
      id: "serviceFeeAndPayouts",
      number: 6,
      title: "Service Fee and Payouts",
      blocks: [
        {
          type: "clauses",
          items: [
            "In consideration of the use of the Platform, the Platform charges a Service Fee of 18% of the Client’s charge for each completed Service, or as otherwise published. The Service Fee is compensation for platform access and facilitation and is not a deduction from wages.",
            "Client payments are collected and held by the Payment Service Provider and disbursed to the Provider, net of the Service Fee and applicable disbursement charges, as the Provider’s own service charges. The Platform facilitates but does not itself pay the Provider as an employer. Disbursement charges are an ordinary business expense of the Provider and not a wage deduction.",
            "The payout schedule depends on the category of the Service under the Service Categories document: (a) for Category A (outcome-based) Services, Payment Model 1 applies – the Provider’s net proceeds are released in full, in a single disbursement, after the five (5)-day warranty period, provided no valid warranty claim remains unresolved, with no portion released beforehand; and (b) for Category B (session-based) Services, Payment Model 2 applies – the Provider’s net proceeds are released in a single disbursement twenty-four (24) hours after completion is confirmed, with no warranty hold.",
            "Disbursements are made via InstaPay or other rails offered by the Payment Service Provider to the account nominated by the Provider, who is responsible for the accuracy of those details.",
          ],
        },
      ],
    },
    {
      id: "warrantyAndRework",
      number: 7,
      title: "Service Warranty and Rework",
      blocks: [
        {
          type: "clauses",
          items: [
            "Category A Services. The Provider warrants to the Client that each completed Category A Service will conform to the accepted description and be performed in a workmanlike manner. Within the five (5)-day warranty period, upon a valid Client claim of defect or incompleteness, the Provider will remedy the deficiency at the Provider’s own cost, or agree an alternative resolution with the Client. The means and methods of any remedy remain within the Provider’s control. This is a warranty of result owed to the Client and is not supervision or control by the Platform.",
            "Category B Services. These Services carry no warranty of outcome and no rework obligation, as they are consumed at the point of performance. A Client’s remedy is limited to the complaint mechanism in the Service Categories document (refund, partial refund, or credit for non-appearance, material non-performance, misrepresentation, or misconduct).",
            "The Platform’s role in any claim is limited to facilitating communication and administering the hold, release, or refund of funds held by the Payment Service Provider under its published dispute policy.",
          ],
        },
      ],
    },
    {
      id: "taxes",
      number: 8,
      title: "Taxes, Registration, and Statutory Obligations",
      blocks: [
        {
          type: "clauses",
          items: [
            "The Provider is solely responsible for registering as a taxpayer with the Bureau of Internal Revenue, issuing official receipts where required, filing returns, and paying all taxes arising from the Provider’s receipts, and for the Provider’s own business registration where required by law.",
            "The Platform makes no withholding on behalf of the Provider as an employer. Any withholding required by law shall be made on the character of the payment as income of an independent contractor.",
            "Because the Provider is not an employee, the Provider is not entitled to, and the Platform is not obligated to provide, employee benefits of any kind, including SSS, PhilHealth, and Pag-IBIG contributions, 13th-month pay, service incentive leave, holiday or overtime premiums, separation pay, or retirement benefits. The Provider is responsible for the Provider’s own statutory contributions as a self-employed person.",
          ],
        },
      ],
    },
    {
      id: "insurance",
      number: 9,
      title: "Insurance and Assumption of Risk",
      blocks: [
        {
          type: "clauses",
          items: [
            "The Provider assumes all risks inherent in performing the Services and is responsible for obtaining any insurance the Provider deems appropriate, and for the Provider’s own occupational safety and legal compliance.",
          ],
        },
      ],
    },
    {
      id: "eligibility",
      number: 10,
      title: "Eligibility, Ratings, and Deactivation",
      blocks: [
        {
          type: "clauses",
          items: [
            "Continued access is conditioned on compliance with this Agreement, the Terms of Use, and objective published eligibility criteria (for example, verified identity, valid credentials where a trade requires them, and minimum service-quality thresholds).",
            "Client ratings are a marketplace feature. Any suspension or removal that follows from ratings is an application of objective, published eligibility standards and not an exercise of employer disciplinary authority.",
            "The Provider may deactivate at any time. The Platform may suspend or deactivate a Provider for breach, failure to meet eligibility criteria, fraud, unlawful conduct, or risk to Clients or the Platform, subject to its published process.",
          ],
        },
      ],
    },
    {
      id: "dataPrivacy",
      number: 11,
      title: "Data Privacy",
      blocks: [
        {
          type: "clauses",
          items: [
            "The Provider consents to the processing of the Provider’s personal data, including government-issued identification and payout details, for onboarding, verification, disbursement, tax and regulatory compliance, safety, and operation of the Platform, under the Data Privacy Act of 2012 and the Privacy Policy.",
            "The Provider shall handle any Client personal data obtained in rendering Services in accordance with the Data Privacy Act and solely to perform the relevant Service.",
          ],
        },
      ],
    },
    {
      id: "confidentiality",
      number: 12,
      title: "Confidentiality and Intellectual Property",
      blocks: [
        {
          type: "clauses",
          items: [
            "The Provider shall keep confidential non-public information of the Platform or Clients and use it only to perform the Services.",
            "The Platform’s trademarks, software, and content remain its property. This Agreement grants only a limited, revocable, non-transferable license to use the Platform for its intended purpose.",
          ],
        },
      ],
    },
    {
      id: "prohibitedConduct",
      number: 13,
      title: "Prohibited Conduct",
      blocks: [
        { type: "p", text: "The Provider shall not:" },
        {
          type: "bullets",
          items: [
            "use the Platform for any unlawful purpose or to defraud, harass, or endanger any person;",
            "misrepresent the Provider’s identity, qualifications, or the nature of the Services;",
            "circumvent the Platform’s payment facilities in violation of the Terms; or",
            "violate applicable law or the rights of Clients or third parties.",
          ],
        },
      ],
    },
    {
      id: "indemnification",
      number: 14,
      title: "Indemnification",
      blocks: [
        {
          type: "clauses",
          items: [
            "The Provider shall indemnify and hold free and harmless the Platform, its officers, directors, and employees from any claim, liability, loss, or expense (including reasonable attorney’s fees) arising from the Provider’s performance or non-performance of the Services, breach of this Agreement, or violation of any law or third-party right.",
          ],
        },
      ],
    },
    {
      id: "limitationOfLiability",
      number: 15,
      title: "Limitation of Liability",
      blocks: [
        {
          type: "clauses",
          items: [
            "The Platform is a venue and facilitator only, is not a party to the service contract between the Provider and the Client, and does not guarantee the volume, availability, or profitability of Service Requests. To the fullest extent permitted by law, the Platform shall not be liable for any indirect, incidental, or consequential damages arising from the Provider’s use of the Platform.",
          ],
        },
      ],
    },
    {
      id: "termAndTermination",
      number: 16,
      title: "Term and Termination",
      blocks: [
        {
          type: "clauses",
          items: [
            "This Agreement takes effect upon acceptance and continues until terminated. Either Party may terminate at any time, with or without cause, without prejudice to accrued obligations, including completion of accepted Services and resolution of pending claims.",
            "Sections on taxes, confidentiality, indemnification, limitation of liability, data privacy, and dispute resolution survive termination.",
          ],
        },
      ],
    },
    {
      id: "amendments",
      number: 17,
      title: "Amendments",
      blocks: [
        {
          type: "clauses",
          items: [
            "The Platform may amend this Agreement and the Service Categories by posting an updated version and notifying the Provider through the Platform. Continued use after the effective date constitutes acceptance; otherwise the Provider’s remedy is to cease using the Platform.",
          ],
        },
      ],
    },
    {
      id: "governingLaw",
      number: 18,
      title: "Governing Law and Dispute Resolution",
      blocks: [
        {
          type: "clauses",
          items: [
            "This Agreement is governed by the laws of the Republic of the Philippines.",
            "The Parties shall first attempt to resolve any dispute amicably. Any unresolved dispute shall be submitted to the exclusive jurisdiction of the proper courts of [City], Metro Manila, or, where the Parties so agree in writing, to arbitration under the Alternative Dispute Resolution Act of 2004.",
          ],
        },
      ],
    },
    {
      id: "miscellaneous",
      number: 19,
      title: "Miscellaneous",
      blocks: [
        {
          type: "clauses",
          items: [
            "Entire Agreement. This Agreement, together with the Terms of Use, the Service Categories & Payment Models, and the Privacy Policy, constitutes the entire agreement between the Parties on its subject matter.",
            "Severability. If any provision is held invalid, the remainder remains in force, reformed to the minimum extent necessary.",
            "No Waiver. Failure to enforce any provision is not a waiver of later enforcement.",
            "Assignment. The Provider may not assign this Agreement without the Platform’s written consent. The Platform may assign it in connection with a reorganization or transfer of its business.",
            "Independent Construction. The Parties acknowledge that the characterization of their relationship reflects their genuine intent and the actual manner in which the Services are rendered.",
          ],
        },
      ],
    },
  ],
};

module.exports = providerAgreement;