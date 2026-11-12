import { err, type Err, type SubmissionError, type ValidationError } from '@thp/domain';

export type ApplicationErrorCode =
  | 'email_taken'
  | 'invalid_credentials'
  | 'unauthenticated'
  | 'session_expired'
  | 'google_failed'
  | 'google_email_unverified'
  | 'forbidden'
  | 'not_found'
  | 'below_minimum_seats'
  | 'already_subscribed'
  | 'subscription_ended'
  | 'billing_failed'
  | 'invalid_signature'
  | 'unknown_subscription'
  | 'class_archived'
  | 'duplicate_student_number'
  | 'semester_in_use'
  | 'categories_exist'
  | 'category_in_use'
  | 'storage_unavailable'
  | 'subscription_required'
  | 'has_submissions'
  | 'too_many_attachments'
  | 'already_submitted'
  | 'not_shareable'
  | 'classroom_not_connected'
  | 'classroom_failed'
  | 'canva_not_connected'
  | 'canva_failed'
  | 'microsoft_not_connected'
  | 'microsoft_failed'
  | 'microsoft_admin_approval'
  | 'teams_not_allowed'
  | 'teams_admin_approval'
  | 'teams_school_account'
  | 'teams_declined'
  | 'teams_failed'
  | 'grading_off'
  | 'name_taken'
  | 'email_failed'
  | 'google_reconnect'
  | 'google_api_disabled'
  | 'own_account'
  | 'has_classes'
  | 'in_use'
  | 'invalid_link'
  | 'setup_unavailable'
  | 'already_set_up'
  | 'rate_limited'
  | 'adult_required'
  | 'throwaway_email'
  | 'blocked_domain'
  | 'email_unconfirmed'
  | 'resend_limit'
  | 'account_suspended';

/**
 * What a use case can report: a broken validation rule (with its field) or an application-level
 * refusal. Codes only: the web app turns them into Spanish or English messages.
 */
export type UseCaseError = ValidationError | { readonly code: ApplicationErrorCode };

/** A submission rule broken: its field error, or a step out of order as a status error. */
export const submissionFailure = (error: SubmissionError): Err<UseCaseError> =>
  err('field' in error ? error : { field: 'status', code: 'not_allowed' });

export const fail = (code: ApplicationErrorCode): Err<{ readonly code: ApplicationErrorCode }> =>
  err({ code });
