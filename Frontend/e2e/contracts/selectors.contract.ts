/**
 * The ONLY place data-testid strings may be declared for KayodManage e2e —
 * mirrors kayod/client/e2e/contracts/selectors/*.contract.ts's rule. Modules
 * and specs import from here; never hard-code a testid string elsewhere.
 */
export const selectors = {
  login: {
    username: 'admin-login-username',
    password: 'admin-login-password',
    submit: 'admin-login-submit',
  },
  jobs: {
    search: 'admin-jobs-search',
    row: (jobId: string) => `admin-job-row-${jobId}`,
    forceCancelButton: 'admin-force-cancel-job-btn',
  },
  support: {
    resolveDisputePayProvider: 'resolve-dispute-pay-provider',
    resolveDisputeRefundClient: 'resolve-dispute-refund-client',
    resolveDisputeRebook: 'resolve-dispute-rebook',
    internalNoteInput: 'internal-note-input',
    internalNoteSubmit: 'internal-note-submit',
  },
};
