export * from './errors.ts';
export { SignUp, type SignUpDeps, type SignUpInput, type SignedIn } from './accounts/sign-up.ts';
export { LogIn, type LogInDeps, type LoggedIn } from './accounts/log-in.ts';
export { LogOut } from './accounts/log-out.ts';
export {
  AuthenticateSession,
  type Access,
  type Authenticated,
  type AuthenticateSessionDeps,
} from './accounts/authenticate-session.ts';
export {
  SignInWithGoogle,
  type GoogleSignedIn,
  type GoogleSignInInput,
  type SignInWithGoogleDeps,
} from './accounts/sign-in-with-google.ts';
export { UpdateProfile } from './settings/update-profile.ts';
export {
  UpdateSchoolDetails,
  type UpdateSchoolDetailsDeps,
} from './settings/update-school-details.ts';
export {
  StartCheckout,
  type CheckoutInput,
  type StartCheckoutDeps,
} from './billing/start-checkout.ts';
export {
  HandleBillingWebhook,
  type HandleBillingWebhookDeps,
} from './billing/handle-billing-webhook.ts';
export { SchoolManagementPolicy } from './policies/school-management.ts';
export { canManageClass } from './policies/class-access.ts';
export {
  ArchiveClass,
  CreateClass,
  GetClass,
  ListClasses,
  RestoreClass,
  UpdateClass,
} from './classes/class-use-cases.ts';
export {
  AddStudent,
  DeleteStudent,
  ListStudents,
  UpdateStudent,
} from './students/student-use-cases.ts';
export {
  ImportStudents,
  RosterImporter,
  type ImportError,
  type ImportStudentsDeps,
  type RowError,
} from './students/import-students.ts';
export {
  maxRosterRows,
  parseRosterCsv,
  type RosterCsvError,
  type RosterRow,
} from './students/roster-csv.ts';
export {
  CreateSemester,
  DeleteSemester,
  ListSemesters,
  SetActiveSemester,
  UpdateSemester,
} from './semesters/semester-use-cases.ts';
export {
  DismissOnboarding,
  GetOnboarding,
  defaultOnboardingItems,
  firstClassItem,
  schoolInfoItem,
  type OnboardingContext,
  type OnboardingItem,
  type OnboardingState,
} from './onboarding/onboarding-use-cases.ts';
export {
  GetAttendanceSheet,
  ListAttendanceDays,
  ReopenAttendance,
  SaveAttendance,
  SubmitAttendance,
  type AttendanceDeps,
  type AttendanceSheet,
  type AttendanceUseCaseError,
  type SheetRow,
} from './attendance/attendance-sheet.ts';
export {
  GetAttendanceReport,
  defaultReportDays,
  type AttendanceReport,
  type AttendanceReportRow,
  type GetAttendanceReportDeps,
} from './attendance/attendance-report.ts';
export {
  GetAttendanceOverview,
  type ClassDay,
  type DayStatus,
} from './attendance/attendance-overview.ts';
export {
  AddGradeCategory,
  AddStandardCategories,
  DeleteGradeCategory,
  ListGradeCategories,
  UpdateGradeCategory,
} from './gradebook/categories.ts';
export {
  CreateAssignment,
  DeleteAssignment,
  ListAssignments,
  UpdateAssignment,
} from './gradebook/assignments.ts';
export {
  GetGradeEntry,
  SaveGrades,
  type GradeEntry,
  type GradeEntryError,
  type GradeEntryRow,
  type GradeRowInput,
  type InvalidGrades,
} from './gradebook/grade-entry.ts';
export {
  GetGradebook,
  GetGradebookReport,
  type Gradebook,
  type GradebookReport,
  type GradebookRow,
} from './gradebook/gradebook.ts';
export {
  GetReportCards,
  SaveReportCardComment,
  type ReportCard,
  type ReportCards,
} from './gradebook/report-cards.ts';
export { GetSchoolLogo, RemoveSchoolLogo, UploadSchoolLogo } from './settings/school-logo.ts';
export {
  GetJob,
  JobHandlerRegistry,
  RunNextJob,
  SweepStaleJobs,
  type JobHandler,
  type JobRun,
} from './jobs/jobs.ts';
export {
  CreatePlan,
  DeletePlan,
  DuplicatePlan,
  GetPlan,
  ListPlans,
  MovePlan,
  UpdatePlan,
  type PlanContent,
  type PlanFilter,
} from './lesson-plans/plans.ts';
export {
  CreateFolder,
  DeleteFolder,
  ListFolders,
  UpdateFolder,
  type FolderWithCount,
} from './lesson-plans/folders.ts';
export {
  DeleteTemplate,
  ListTemplates,
  SaveAsTemplate,
  StartFromTemplate,
  type TemplateList,
  type TemplateSource,
} from './lesson-plans/templates.ts';
export {
  GetDraftedPlan,
  LessonPlanDraftHandler,
  RequestLessonPlanDraft,
  draftJobKind,
} from './lesson-plans/drafts.ts';
export { checkAiAccess } from './accounts/ai-access.ts';
export {
  RequestGeneration,
  GenerationHandler,
  ListGenerations,
  GetGeneration,
  DeleteGeneration,
  generationJobKind,
  type GenerationJobResult,
} from './assistant/assistant.ts';
export {
  RequestPresentationDraft,
  PresentationDraftHandler,
  CreatePresentation,
  ListPresentations,
  GetPresentation,
  UpdatePresentation,
  DeletePresentation,
  presentationDraftJobKind,
  type NewPresentation,
} from './presentations/presentations.ts';
export {
  RequestSpeech,
  SpeechHandler,
  GetSpeechClip,
  speechJobKind,
  type SpeechOutcome,
} from './speech/speech.ts';
export { GetSubPacket, SaveSubPacket, type SubPacketView } from './substitutes/sub-packets.ts';
export { SaveQuestions, SaveInstructions } from './assignments/questions.ts';
export {
  UploadAttachment,
  DeleteAttachment,
  ListAttachments,
  GetAttachmentFile,
} from './assignments/attachments.ts';
export {
  RequestPdfImport,
  PdfImportHandler,
  GetImportedTest,
  pdfImportJobKind,
  type ImportedTest,
} from './assignments/pdf-import.ts';
export {
  IssueLinks,
  ListLinks,
  RevokeLink,
  ReissueLink,
  type IssuedLink,
} from './assignments/student-links.ts';
export {
  OpenStudentLink,
  GetStudentAssignment,
  SubmitAnswers,
  GetStudentAttachment,
  type StudentPortal,
  type StudentAssignmentView,
  type StudentAssignmentStatus,
} from './assignments/student-portal.ts';
export {
  ListSubmissions,
  RequestAiGrading,
  GradingHandler,
  ConfirmGrade,
  GradeByHand,
  gradingJobKind,
} from './assignments/grading.ts';
export {
  StartClassroomConnect,
  FinishClassroomConnect,
  DisconnectClassroom,
  ListClassroomCourses,
  ImportClassroomRoster,
  ShareAssignment,
} from './assignments/classroom.ts';
export { PostWordToClassroom } from './assignments/word-to-classroom.ts';
export { MakeFormsQuiz, FindFormsQuiz } from './assignments/forms-quiz.ts';
export { findOwnGame, type GameRef } from './games/game-access.ts';
export {
  CreateGame,
  UpdateGame,
  ListGames,
  GetGame,
  DeleteGame,
  type CreateGameInput,
  type GameDetails,
} from './games/games.ts';
export {
  RequestGameDraft,
  GameDraftHandler,
  GetGameDraft,
  gameDraftJobKind,
  type GameDraft,
  type GameDraftInput,
} from './games/game-drafts.ts';
export { SaveGameGrading, type GameGradingInput } from './games/grade-settings.ts';
export {
  StartGameRound,
  FinishGameRound,
  StartPreviewRound,
  FinishPreviewRound,
  type GameRound,
  type RoundResult,
} from './games/play.ts';
export {
  GetGameLeaderboard,
  GetGameResults,
  ConfirmGameGrades,
  type GameResults,
  type StudentGameResult,
  type StudentLeaderboardRow,
} from './games/results.ts';
export {
  hostTicket,
  playerTicket,
  readTicket,
  liveTicketLifetimeMs,
  type LiveActor,
} from './live/live-tickets.ts';
export {
  StartLiveSession,
  ListLiveSessions,
  OpenLiveHost,
  DeleteLiveSession,
  GetLiveInsights,
  findOwnLiveSession,
  type LiveHost,
  type StartLiveInput,
} from './live/live-sessions.ts';
export {
  FindLiveSessionByPin,
  JoinLiveSession,
  VerifyLiveTicket,
  type LiveJoin,
  type LiveLobby,
} from './live/live-join.ts';
export {
  StartLiveGame,
  NextLiveQuestion,
  EndLiveSession,
  RevealLiveAnswer,
  RemoveLivePlayer,
  SubmitLiveAnswer,
  StartSelfPacedRound,
  FinishSelfPacedRound,
  type SubmittedAnswer,
} from './live/live-game.ts';
export { GetLiveView, type LiveView, type LiveBoardRow } from './live/live-view.ts';
export {
  ArchiveLearningPath,
  AssignLearningPath,
  DeleteLearningPath,
  GetClassLearning,
  GetLearningPath,
  GetStudentLearning,
  LearningPathHandler,
  learningPathJobKind,
  RequestLearningPath,
  UpdateLearningPath,
  type ClassLearning,
  type LearningPathInput,
  type StudentLearning,
  type StudentLearningRow,
} from './learning/learning-paths.ts';
export {
  ListStudentPaths,
  OpenLearnerLesson,
  SubmitLessonCheck,
  type CheckResult,
  type LearnerLessonView,
  type StudentPathSummary,
} from './learning/student-learning.ts';
export {
  EmailPortalLink,
  IssuePortalLink,
  ListPortalLinks,
  RevokePortalLink,
  type IssuedPortalLink,
  type PortalLinkRow,
} from './portals/portal-links.ts';
export { OpenFamilyPortal, type FamilyPortal } from './portals/family-portal.ts';
export { SendTrialReminders } from './billing/trial-reminders.ts';
export {
  GetCommandCenter,
  type CommandCenter,
  type TodayAttendance,
} from './command-center/command-center.ts';
export {
  GetStudent360,
  AddStudentNote,
  DeleteStudentNote,
  RequestStudentInsight,
  StudentInsightHandler,
  studentInsightJobKind,
  type StudentView,
} from './students/student-360.ts';
export {
  StartPrepBatch,
  PrepStepHandler,
  ResumePrepBatch,
  GetPrepBatch,
  ListPrepBatches,
  CountReadyPrepBatches,
  UpdatePrepSelection,
  DeletePrepBatch,
  prepStepJobKind,
  maxListedPrepBatches,
  type PrepBatchView,
} from './prep/prep-batches.ts';
export { makePrepRunners, type PrepItemRunner, type PrepRunners } from './prep/prep-runners.ts';
export { PublishPrepBatch } from './prep/publish-prep.ts';
export { SendPresentationToClassroom } from './presentations/presentation-to-classroom.ts';
export { adminSchool, requireSuperAdmin } from './admin/admin-access.ts';
export {
  PasswordLinks,
  RequestPasswordReset,
  SendPasswordLink,
  SetPassword,
  SetUpFirstSuperAdmin,
} from './admin/passwords.ts';
export {
  ChangeUserRole,
  ListSchoolUsers,
  TransferClasses,
  type SchoolUserRow,
} from './admin/school-admin.ts';
export {
  CreateSchool,
  CreateUser,
  DeleteSchool,
  DeleteUser,
  GetPlatformOverview,
  ListAllUsers,
  ListSchoolClasses,
  ListSchools,
  UpdateSchool,
  UpdateUser,
  maxListedUsers,
  type NewUserDetails,
  type PlatformOverview,
  type SchoolRow,
  type UserRow,
} from './admin/super-admin.ts';
export { ImportSchoolStudents, ImportTeachers, maxTeacherRows } from './admin/imports.ts';
export {
  GetChat,
  RunNextChatTurn,
  SendChatMessage,
  StartChat,
  SweepOldChats,
  type ChatRun,
} from './marketing/chat.ts';
export {
  CaptureLead,
  ListLeads,
  UpdateLeadStatus,
  maxListedLeads,
  type LeadList,
} from './marketing/leads.ts';
export {
  ImportLegacyData,
  leftOutCollections,
  type ImportLegacyDataDeps,
} from './migration/import-legacy-data.ts';
