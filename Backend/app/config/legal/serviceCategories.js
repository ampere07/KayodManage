/**
 * GENERATED FILE — DO NOT EDIT.
 *
 * Mirrored from kayod/client/src/config/legal by kayod/scripts/generate-legal-seed.js.
 * Edit the client copy and re-run the generator; CI fails if these drift.
 */

/**
 * serviceCategories.js — Service Categories and Payment Models.
 *
 * Transcribed from the executed source document with table formatting replaced
 * by mobile-friendly comparison blocks.
 *
 * ── The one document the app has to keep honest ──────────────────────────────
 *
 * Its Category A / Category B split is the same split the running product implements
 * as SERVICE_CLASS.STANDARD (120-hour hold) and SERVICE_CLASS.IMMEDIATE in
 * src/config/serviceClass.js, and the same split the server snapshots onto every job.
 */

const serviceCategories = {
  id: "serviceCategories",
  route: "ServiceCategories",
  title: "Service Categories",
  shortTitle: "Service Categories",
  subtitle: "Service Categories and Payment Models",
  icon: "gravity-ui:list-ul",
  audience: "all",

  intro:
    "This Service Categories and Payment Models document forms part of, and is incorporated by reference into, the Kayod Platform Terms of Use, the Client Terms, and the Independent Service Provider Agreement. It classifies services offered through the Kayod Platform into categories and sets out the payment model that applies to each. Capitalized terms not defined here have the meaning given in those documents.",

  sections: [
    {
      id: "purpose",
      number: 1,
      title: "Purpose, Incorporation, and Precedence",
      blocks: [
        {
          type: "clauses",
          items: [
            "The Platform facilitates different kinds of services that carry different risks and require different payment handling. This document establishes a service taxonomy and two payment models so that each booking is settled in a manner appropriate to the nature of the service.",
            "This document is incorporated into the Client Terms and the Independent Service Provider Agreement. Clients and Providers agree to it when they accept those documents or transact through the Platform.",
            "On any matter of service classification, payment timing, warranty, or remedies, this document controls over the general provisions of the Client Terms and the Provider Agreement. The Platform Terms of Use continue to govern all other matters (including governing law, limitation of liability, and dispute resolution).",
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
            "“Category A Services” (Outcome-Based Services) means Services where the Provider is engaged to produce a specific, tangible, and inspectable result that persists after the Provider finishes work and is capable of evaluation against an agreed scope.",
            "“Category B Services” (Session- or Time-Based Services) means Services where the Provider is engaged to deliver effort, time, skill, or presence over a defined period or session, and where the value of the Service is consumed as it is performed.",
            "“Completion Confirmation” means the Client’s affirmative confirmation through the Platform that a booked Service has been completed, or the automatic confirmation by the Platform if the Client does not report an issue within [__] hours after the Provider marks the booking complete.",
            "“Complaint Window” means the [24]-hour period following completion of a Category B Service during which a Client may raise a service-quality complaint through the Platform.",
            "“Dispute Policy” means the Platform’s dispute resolution and refund policy published at https://kayod.ph/disputes, as updated from time to time.",
            "“Payment Model 1” (Warranty-Backed Settlement) means the payment model described in Section 5.",
            "“Payment Model 2” (Immediate Settlement) means the payment model described in Section 6.",
            "“Warranty Period” means the five (5)-calendar-day period that begins immediately upon Completion Confirmation for a Category A Service.",
          ],
        },
      ],
    },
    {
      id: "categories",
      number: 3,
      title: "Service Categories",
      blocks: [
        {
          type: "p",
          text: "Services available on the Platform are classified into two categories. The Platform assigns each listed service type to a category. In case of ambiguity, the Platform’s classification governs.",
        },
        {
          type: "sub",
          title: "Category A: Outcome-Based Services",
          blocks: [
            {
              type: "p",
              text: "Characteristics: The booking is made for an identifiable end result; the result can be inspected, tested, or verified after completion; defects in workmanship or materials may not be immediately apparent; and rework or correction is feasible if the outcome is defective.",
            },
            {
              type: "p",
              text: "Examples: Appliance repair and maintenance, plumbing repairs and installations, electrical repairs and installations, carpentry and furniture assembly/repair, masonry, painting, and general handyman repairs, auto and motorcycle repair, and electronics and computer repair.",
            },
            {
              type: "p",
              text: "Applicable Payment Model: Payment Model 1 (Section 5).",
            },
          ],
        },
        {
          type: "sub",
          title: "Category B: Session- or Time-Based Services",
          blocks: [
            {
              type: "p",
              text: "Characteristics: The booking is made for the Provider’s time, presence, labor, or personal service; performance is evaluated during or immediately at the end of the session; the service cannot be undone or returned once rendered; and rework is generally not meaningful because the time has already been expended.",
            },
            {
              type: "p",
              text: "Examples: General cleaning and housekeeping, laundry and ironing, moving assistance and heavy lifting, personal care and grooming (haircut, massage, makeup), tutoring, coaching, and lessons, event assistance and catering help, photography and videography sessions, pet sitting and dog walking, and courier and errand services.",
            },
            {
              type: "p",
              text: "Applicable Payment Model: Payment Model 2 (Section 6).",
            },
          ],
        },
      ],
    },
    {
      id: "escrow",
      number: 4,
      title: "Escrow and Booking Payment (All Services)",
      blocks: [
        {
          type: "clauses",
          items: [
            "Full Payment into Escrow. For every booking—regardless of category—the Client pays the total agreed amount at the time of booking. The funds are held in escrow by the Payment Service Provider until released under the applicable Payment Model.",
            "Service Fee Deduction. The Platform’s Service Fee is calculated on the total booking amount and is deducted by the Payment Service Provider before disbursement to the Provider.",
            "Cancellation. Cancellation by either party is governed by the cancellation policy in the Client Terms and Provider Agreement. Refund of escrowed funds upon cancellation follows that policy.",
          ],
        },
      ],
    },
    {
      id: "paymentModel1",
      number: 5,
      title: "Payment Model 1: Warranty-Backed Settlement (Category A Services)",
      blocks: [
        {
          type: "clauses",
          items: [
            "Trigger. Payment Model 1 applies to all Category A (Outcome-Based) Services.",
            "Single Release After Warranty Period. When Completion Confirmation occurs, the funds remain in escrow for the duration of the Warranty Period. Upon expiry of the five (5)-day Warranty Period—provided no valid warranty claim has been submitted by the Client—the Payment Service Provider releases 100% of the Provider’s net proceeds (the agreed price less the Service Fee) in a single disbursement to the Provider’s payout account. No portion is released beforehand.",
            "Warranty Claim During the Warranty Period. If a defect in the completed work arises during the Warranty Period, the Client may submit a warranty claim through the Platform with supporting details (such as photographs or description of the defect). Submitting a claim pauses the automatic release of funds.",
            "Provider’s Right to Remedy. The Provider must be given a reasonable opportunity (not to exceed two (2) business days from notice) to inspect the issue and perform necessary rework at no additional charge to the Client. If the Provider successfully remedies the defect, the Client confirms completion of the rework and the remaining funds are released. If the Provider fails or refuses to remedy the defect within the allotted time, or the rework is unsatisfactory, the matter is referred for dispute resolution under Section 8, and the Payment Service Provider may disburse a full or partial refund to the Client or release funds to the Provider as determined under the Dispute Policy.",
          ],
        },
      ],
    },
    {
      id: "paymentModel2",
      number: 6,
      title: "Payment Model 2: Immediate Settlement (Category B Services)",
      blocks: [
        {
          type: "clauses",
          items: [
            "Trigger. Payment Model 2 applies to all Category B (Session- or Time-Based) Services.",
            "Single Release on Completion. Upon Completion Confirmation, the Payment Service Provider releases 100% of the Provider’s net proceeds (the agreed price less the Service Fee) in a single disbursement to the Provider’s payout account twenty-four (24) hours after completion is confirmed. There is no warranty hold and no rework obligation.",
            "Category B Services carry no warranty of outcome. The Provider does not guarantee any particular result, and no claim may be made on the basis that a Service failed to achieve a desired outcome.",
            "Within the Complaint Window, a Client may raise a service-quality complaint. Remedies for a valid complaint are limited to a full or partial refund or Platform credit, administered through the Payment Service Provider under the Platform’s dispute policy, and are available only where the Provider failed to appear, materially cut short or failed to perform the booked Service, misrepresented the Service or the Provider’s qualifications, or committed misconduct. Remedies do not include re-performance of a consumed Service.",
          ],
        },
      ],
    },
    {
      id: "mapping",
      number: 7,
      title: "Category-to-Model Summary",
      blocks: [
        {
          type: "sub",
          title: "Category A: Outcome-Based",
          blocks: [
            {
              type: "bullets",
              items: [
                "Nature: Inspectable, persistent result (e.g. Auto Mechanic, Carpentry, Plumbing, Electrical)",
                "Payment Model: Model 1 – Warranty-backed settlement",
                "Release Timing: 100% in a single release after the 5-day warranty period",
                "Warranty & Rework: 5-day warranty window; provider remedies defects",
                "Client Remedy: Rework or agreed alternative",
              ],
            },
          ],
        },
        {
          type: "sub",
          title: "Category B: Session- or Time-Based",
          blocks: [
            {
              type: "bullets",
              items: [
                "Nature: Consumed at point of performance (e.g. Cleaning, Tutoring, Event Help, Moving)",
                "Payment Model: Model 2 – Immediate settlement",
                "Release Timing: 100% in a single release 24 hours after completion",
                "Warranty & Rework: None – no outcome warranty, no rework obligation",
                "Client Remedy: Refund, partial refund, or credit for non-performance or misconduct",
              ],
            },
          ],
        },
      ],
    },
    {
      id: "complaints",
      number: 8,
      title: "Complaints, Disputes, and Fund Handling",
      blocks: [
        {
          type: "clauses",
          items: [
            "All claims, complaints, and disputes are handled under the Platform’s published dispute and refund policy. The Platform facilitates communication and administers the hold, release, or refund of funds held by the Payment Service Provider in accordance with that policy.",
            "The Platform’s administration of funds does not make it a party to the service contract between the Client and the Provider, nor does it transfer to the Platform any responsibility for the underlying Service.",
          ],
        },
      ],
    },
    {
      id: "amendment",
      number: 9,
      title: "Amendment of Terms",
      blocks: [
        {
          type: "clauses",
          items: [
            "The Platform may amend these categories, examples, timing parameters, and the Complaint Window by posting an updated version and notifying users through the Platform. Continued use after the effective date constitutes acceptance.",
          ],
        },
      ],
    },
  ],
};

module.exports = serviceCategories;