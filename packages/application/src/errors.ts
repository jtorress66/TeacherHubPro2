import { err, type Err, type ValidationError } from '@thp/domain';

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
  | 'storage_unavailable';

/**
 * What a use case can report: a broken validation rule (with its field) or an application-level
 * refusal. Codes only: the web app turns them into Spanish or English messages.
 */
export type UseCaseError = ValidationError | { readonly code: ApplicationErrorCode };

export const fail = (code: ApplicationErrorCode): Err<{ readonly code: ApplicationErrorCode }> =>
  err({ code });
