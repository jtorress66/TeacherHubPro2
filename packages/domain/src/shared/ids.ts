declare const brand: unique symbol;

/** A string id that the compiler keeps apart from other kinds of id. */
export type Id<Kind extends string> = string & { readonly [brand]: Kind };

export type SchoolId = Id<'School'>;
export type UserId = Id<'User'>;
export type ClassId = Id<'Class'>;
export type StudentId = Id<'Student'>;
export type SemesterId = Id<'Semester'>;
export type LessonPlanId = Id<'LessonPlan'>;
export type PlanFolderId = Id<'PlanFolder'>;
export type GradeCategoryId = Id<'GradeCategory'>;
export type AssignmentId = Id<'Assignment'>;
export type QuestionId = Id<'Question'>;
export type GradeId = Id<'Grade'>;
export type ReportCardCommentId = Id<'ReportCardComment'>;
export type SubmissionId = Id<'Submission'>;
export type AttendanceSessionId = Id<'AttendanceSession'>;
export type GameId = Id<'Game'>;
export type GameModeId = Id<'GameMode'>;
export type SubscriptionId = Id<'Subscription'>;
export type JobId = Id<'Job'>;
export type PlanTemplateId = Id<'PlanTemplate'>;
