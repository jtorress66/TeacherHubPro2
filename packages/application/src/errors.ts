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
  | 'classroom_failed';

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
