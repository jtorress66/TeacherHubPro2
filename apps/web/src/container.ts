import { createHash } from 'node:crypto';
import {
  CanvaConnectAuthorization,
  CanvaConnectDesigns,
  DocxDocumentWriter,
  LocalCanvaAuthorization,
  LocalCanvaDesigns,
  LocalMicrosoftAuthorization,
  LocalOneDriveFiles,
  MicrosoftIdentityAuthorization,
  OneDriveGraphFiles,
  PptxPresentationWriter,
  LocalMailer,
  loggedMailer,
  ResendMailer,
  AesGcmCipher,
  CryptoSeedSource,
  HmacTicketSigner,
  GoogleClassroom,
  GoogleClassroomAuthorization,
  GoogleDriveApi,
  GoogleFormsApi,
  LocalClassroom,
  LocalDrive,
  LocalSlides,
  GoogleSlidesApi,
  LocalForms,
  LocalClassroomAuthorization,
  createDatabase,
  createPostgresRepositories,
  createStripeClient,
  GoogleOAuthIdentity,
  issueLocalGoogleCode,
  LocalBillingEvents,
  LocalCheckoutSessions,
  LocalCheckoutSimulator,
  LocalGoogleIdentity,
  NodeRandomTokenGenerator,
  PostgresJobQueue,
  PdfLibReportCardRenderer,
  PostgresFileStore,
  ScryptPasswordHasher,
  Sha256TokenHasher,
  StripeBillingEvents,
  StripeCheckoutSessions,
  SystemClock,
  UuidIdGenerator,
} from '@thp/adapters';
import {
  CreateGame,
  StartLiveSession,
  ListLiveSessions,
  OpenLiveHost,
  DeleteLiveSession,
  GetLiveInsights,
  FindLiveSessionByPin,
  JoinLiveSession,
  StartSelfPacedRound,
  FinishSelfPacedRound,
  VerifyLiveTicket,
  IssuePortalLink,
  EmailPortalLink,
  ListPortalLinks,
  RevokePortalLink,
  OpenFamilyPortal,
  RequestLearningPath,
  GetClassLearning,
  GetLearningPath,
  UpdateLearningPath,
  AssignLearningPath,
  ArchiveLearningPath,
  DeleteLearningPath,
  GetStudentLearning,
  ListStudentPaths,
  OpenLearnerLesson,
  SubmitLessonCheck,
  UpdateGame,
  ListGames,
  GetGame,
  DeleteGame,
  RequestGameDraft,
  GetGameDraft,
  SaveGameGrading,
  StartGameRound,
  FinishGameRound,
  StartPreviewRound,
  FinishPreviewRound,
  GetGameLeaderboard,
  GetGameResults,
  ConfirmGameGrades,
  SaveQuestions,
  SaveInstructions,
  UploadAttachment,
  DeleteAttachment,
  ListAttachments,
  GetAttachmentFile,
  RequestPdfImport,
  GetImportedTest,
  IssueLinks,
  ListLinks,
  RevokeLink,
  ReissueLink,
  OpenStudentLink,
  GetStudentAssignment,
  SubmitAnswers,
  GetStudentAttachment,
  ListSubmissions,
  GetAssignmentOverview,
  RequestAiGrading,
  ConfirmGrade,
  GradeByHand,
  StartClassroomConnect,
  FinishClassroomConnect,
  DisconnectClassroom,
  ListClassroomCourses,
  ImportClassroomRoster,
  ShareAssignment,
  PostWordToClassroom,
  SendPresentationToClassroom,
  StartCanvaConnect,
  FinishCanvaConnect,
  DisconnectCanva,
  CanvaConnected,
  SendPresentationToCanva,
  SendGenerationToCanva,
  StartMicrosoftConnect,
  FinishMicrosoftConnect,
  DisconnectMicrosoft,
  MicrosoftConnected,
  SavePresentationToOneDrive,
  SaveGenerationToOneDrive,
  DownloadPresentationFile,
  StartChat,
  SendChatMessage,
  GetChat,
  CaptureLead,
  ListLeads,
  UpdateLeadStatus,
  Throttle,
  CopyStudents,
  RecordActivity,
  ListActivity,
  SetUpFirstSuperAdmin,
  RequestPasswordReset,
  SetPassword,
  SendPasswordLink,
  ListSchoolUsers,
  ChangeUserRole,
  TransferClasses,
  GetPlatformOverview,
  ListSchools,
  CreateSchool,
  UpdateSchool,
  DeleteSchool,
  ListSchoolClasses,
  ListAllUsers,
  CreateUser,
  UpdateUser,
  DeleteUser,
  ImportTeachers,
  ImportSchoolStudents,
  GetCommandCenter,
  GetStudent360,
  AddStudentNote,
  DeleteStudentNote,
  RequestStudentInsight,
  StartPrepBatch,
  ResumePrepBatch,
  GetPrepBatch,
  ListPrepBatches,
  CountReadyPrepBatches,
  UpdatePrepSelection,
  PublishPrepBatch,
  DeletePrepBatch,
  MakeFormsQuiz,
  FindFormsQuiz,
  CreatePresentation,
  CreateRubric,
  DeleteRubric,
  GetRubric,
  ListRubrics,
  RequestRubricDraft,
  UpdateRubric,
  DeleteGeneration,
  DeletePresentation,
  GetGeneration,
  GetPresentation,
  GetSpeechClip,
  GetSubPacket,
  ListGenerations,
  ListPresentations,
  RequestGeneration,
  RequestPresentationDraft,
  RequestSpeech,
  SaveSubPacket,
  UpdatePresentation,
  CreateFolder,
  CreatePlan,
  DeleteFolder,
  DeletePlan,
  DeleteTemplate,
  DuplicatePlan,
  GetDraftedPlan,
  GetJob,
  GetPlan,
  ListFolders,
  ListPlans,
  ListTemplates,
  MovePlan,
  RequestLessonPlanDraft,
  SaveAsTemplate,
  StartFromTemplate,
  UpdateFolder,
  UpdatePlan,
  AddGradeCategory,
  AddStandardCategories,
  AddStudent,
  ArchiveClass,
  CreateAssignment,
  DeleteAssignment,
  DeleteGradeCategory,
  GetGradebook,
  GetGradebookReport,
  GetGradeEntry,
  GetReportCards,
  GetSchoolLogo,
  ListAssignments,
  ListGradeCategories,
  RemoveSchoolLogo,
  SaveGrades,
  SaveReportCardComment,
  UpdateAssignment,
  UpdateGradeCategory,
  UploadSchoolLogo,
  AuthenticateSession,
  CreateClass,
  CreateSemester,
  DeleteSemester,
  DeleteStudent,
  DismissOnboarding,
  GetAttendanceOverview,
  GetAttendanceReport,
  GetAttendanceSheet,
  GetClass,
  GetOnboarding,
  ListAttendanceDays,
  ReopenAttendance,
  SaveAttendance,
  SubmitAttendance,
  HandleBillingWebhook,
  ImportStudents,
  ListClasses,
  ListSemesters,
  ListStudents,
  RestoreClass,
  SetActiveSemester,
  UpdateClass,
  UpdateSemester,
  UpdateStudent,
  defaultOnboardingItems,
  LogIn,
  LogOut,
  SignInWithGoogle,
  SignUp,
  StartCheckout,
  UpdateProfile,
  UpdateSchoolDetails,
} from '@thp/application';
import type {
  SentMailbox,
  BillingEvents,
  CheckoutSessions,
  GoogleIdentity,
  GoogleProfile,
  RandomTokenGenerator,
  ReportCardRenderer,
} from '@thp/ports';
import {
  parseWebConfig,
  type BillingConfig,
  type CanvaConfig,
  type MicrosoftConfig,
  type ClassroomConfig,
  type GoogleConfig,
  type WebConfig,
} from './server/config.ts';
import { loggedCoursework, loggedSlides, loggedDrive } from './server/google-failure-log.ts';
import { createTranslator, locales, emailTemplates } from '@thp/i18n';
import { defaultGameModes, localDateIn, type LocalDate } from '@thp/domain';

export interface CanvaFeature {
  readonly startConnect: StartCanvaConnect;
  readonly finishConnect: FinishCanvaConnect;
  readonly disconnect: DisconnectCanva;
  readonly connected: CanvaConnected;
  readonly sendPresentation: SendPresentationToCanva;
  readonly sendGeneration: SendGenerationToCanva;
}

export interface MicrosoftFeature {
  readonly startConnect: StartMicrosoftConnect;
  readonly finishConnect: FinishMicrosoftConnect;
  readonly disconnect: DisconnectMicrosoft;
  readonly connected: MicrosoftConnected;
  readonly savePresentation: SavePresentationToOneDrive;
  readonly saveGeneration: SaveGenerationToOneDrive;
}

export interface AppContainer {
  readonly appUrl: string;
  /** The realtime server's address, for the live game pages. */
  readonly realtimeUrl: string;
  readonly startLiveSession: StartLiveSession;
  readonly listLiveSessions: ListLiveSessions;
  readonly openLiveHost: OpenLiveHost;
  readonly deleteLiveSession: DeleteLiveSession;
  readonly getLiveInsights: GetLiveInsights;
  readonly findLiveSessionByPin: FindLiveSessionByPin;
  readonly joinLiveSession: JoinLiveSession;
  readonly verifyLiveTicket: VerifyLiveTicket;
  readonly startSelfPacedRound: StartSelfPacedRound;
  readonly finishSelfPacedRound: FinishSelfPacedRound;
  readonly issuePortalLink: IssuePortalLink;
  readonly emailPortalLink: EmailPortalLink;
  readonly listPortalLinks: ListPortalLinks;
  readonly revokePortalLink: RevokePortalLink;
  readonly openFamilyPortal: OpenFamilyPortal;
  /** Whether email reaches people (no until Resend is set up in production). */
  readonly mailDelivers: boolean;
  /** The stand-in's mailbox, outside production only. */
  readonly sentMailbox: SentMailbox | null;
  readonly requestLearningPath: RequestLearningPath;
  readonly getClassLearning: GetClassLearning;
  readonly getLearningPath: GetLearningPath;
  readonly updateLearningPath: UpdateLearningPath;
  readonly assignLearningPath: AssignLearningPath;
  readonly archiveLearningPath: ArchiveLearningPath;
  readonly deleteLearningPath: DeleteLearningPath;
  readonly getStudentLearning: GetStudentLearning;
  readonly listStudentPaths: ListStudentPaths;
  readonly openLearnerLesson: OpenLearnerLesson;
  readonly submitLessonCheck: SubmitLessonCheck;
  readonly requestGeneration: RequestGeneration;
  readonly listGenerations: ListGenerations;
  readonly getGeneration: GetGeneration;
  readonly deleteGeneration: DeleteGeneration;
  readonly requestPresentationDraft: RequestPresentationDraft;
  readonly createPresentation: CreatePresentation;
  readonly listPresentations: ListPresentations;
  readonly getPresentation: GetPresentation;
  readonly updatePresentation: UpdatePresentation;
  readonly deletePresentation: DeletePresentation;
  readonly requestRubricDraft: RequestRubricDraft;
  readonly createRubric: CreateRubric;
  readonly listRubrics: ListRubrics;
  readonly getRubric: GetRubric;
  readonly updateRubric: UpdateRubric;
  readonly deleteRubric: DeleteRubric;
  readonly requestSpeech: RequestSpeech;
  readonly saveQuestions: SaveQuestions;
  readonly saveInstructions: SaveInstructions;
  readonly uploadAttachment: UploadAttachment;
  readonly deleteAttachment: DeleteAttachment;
  readonly listAttachments: ListAttachments;
  readonly getAttachmentFile: GetAttachmentFile;
  readonly requestPdfImport: RequestPdfImport;
  readonly getImportedTest: GetImportedTest;
  readonly issueLinks: IssueLinks;
  readonly listLinks: ListLinks;
  readonly revokeLink: RevokeLink;
  readonly reissueLink: ReissueLink;
  readonly openStudentLink: OpenStudentLink;
  readonly getStudentAssignment: GetStudentAssignment;
  readonly submitAnswers: SubmitAnswers;
  readonly getStudentAttachment: GetStudentAttachment;
  readonly listSubmissions: ListSubmissions;
  readonly getAssignmentOverview: GetAssignmentOverview;
  readonly requestAiGrading: RequestAiGrading;
  readonly confirmGrade: ConfirmGrade;
  readonly gradeByHand: GradeByHand;
  readonly startClassroomConnect: StartClassroomConnect;
  readonly finishClassroomConnect: FinishClassroomConnect;
  readonly disconnectClassroom: DisconnectClassroom;
  readonly listClassroomCourses: ListClassroomCourses;
  readonly importClassroomRoster: ImportClassroomRoster;
  readonly shareAssignment: ShareAssignment;
  readonly postWordToClassroom: PostWordToClassroom;
  readonly sendPresentationToClassroom: SendPresentationToClassroom;
  /** Canva, when it is on; null hides every Canva button. */
  readonly canva: CanvaFeature | null;
  /** Microsoft (OneDrive), when it is on; null hides every OneDrive button. */
  readonly microsoft: MicrosoftFeature | null;
  readonly downloadPresentationFile: DownloadPresentationFile;
  readonly startChat: StartChat;
  readonly sendChatMessage: SendChatMessage;
  readonly getChat: GetChat;
  readonly captureLead: CaptureLead;
  readonly listLeads: ListLeads;
  readonly updateLeadStatus: UpdateLeadStatus;
  readonly throttle: Throttle;
  readonly recordActivity: RecordActivity;
  readonly listActivity: ListActivity;
  /** Whether the first super admin setup page is on (a key is set). */
  readonly superAdminSetupAvailable: boolean;
  readonly setUpFirstSuperAdmin: SetUpFirstSuperAdmin;
  readonly requestPasswordReset: RequestPasswordReset;
  readonly setPassword: SetPassword;
  readonly sendPasswordLink: SendPasswordLink;
  readonly listSchoolUsers: ListSchoolUsers;
  readonly changeUserRole: ChangeUserRole;
  readonly transferClasses: TransferClasses;
  readonly getPlatformOverview: GetPlatformOverview;
  readonly listSchools: ListSchools;
  readonly createSchool: CreateSchool;
  readonly updateSchool: UpdateSchool;
  readonly deleteSchool: DeleteSchool;
  readonly listSchoolClasses: ListSchoolClasses;
  readonly listAllUsers: ListAllUsers;
  readonly createUser: CreateUser;
  readonly updateUser: UpdateUser;
  readonly deleteUser: DeleteUser;
  readonly importTeachers: ImportTeachers;
  readonly importSchoolStudents: ImportSchoolStudents;
  readonly getCommandCenter: GetCommandCenter;
  readonly getStudent360: GetStudent360;
  readonly addStudentNote: AddStudentNote;
  readonly deleteStudentNote: DeleteStudentNote;
  readonly requestStudentInsight: RequestStudentInsight;
  readonly startPrepBatch: StartPrepBatch;
  readonly resumePrepBatch: ResumePrepBatch;
  readonly getPrepBatch: GetPrepBatch;
  readonly listPrepBatches: ListPrepBatches;
  readonly countReadyPrepBatches: CountReadyPrepBatches;
  readonly updatePrepSelection: UpdatePrepSelection;
  readonly publishPrepBatch: PublishPrepBatch;
  readonly deletePrepBatch: DeletePrepBatch;
  readonly makeFormsQuiz: MakeFormsQuiz;
  readonly findFormsQuiz: FindFormsQuiz;
  readonly createGame: CreateGame;
  readonly updateGame: UpdateGame;
  readonly listGames: ListGames;
  readonly getGame: GetGame;
  readonly deleteGame: DeleteGame;
  readonly requestGameDraft: RequestGameDraft;
  readonly getGameDraft: GetGameDraft;
  readonly saveGameGrading: SaveGameGrading;
  readonly startGameRound: StartGameRound;
  readonly finishGameRound: FinishGameRound;
  readonly startPreviewRound: StartPreviewRound;
  readonly finishPreviewRound: FinishPreviewRound;
  readonly getGameLeaderboard: GetGameLeaderboard;
  readonly getGameResults: GetGameResults;
  readonly confirmGameGrades: ConfirmGameGrades;
  readonly getSpeechClip: GetSpeechClip;
  readonly getSubPacket: GetSubPacket;
  readonly saveSubPacket: SaveSubPacket;
  readonly signUp: SignUp;
  readonly logIn: LogIn;
  readonly logOut: LogOut;
  readonly authenticate: AuthenticateSession;
  readonly signInWithGoogle: SignInWithGoogle;
  readonly updateProfile: UpdateProfile;
  readonly updateSchoolDetails: UpdateSchoolDetails;
  readonly startCheckout: StartCheckout;
  readonly handleBillingWebhook: HandleBillingWebhook;
  readonly createClass: CreateClass;
  readonly updateClass: UpdateClass;
  readonly archiveClass: ArchiveClass;
  readonly restoreClass: RestoreClass;
  readonly getClass: GetClass;
  readonly listClasses: ListClasses;
  readonly addStudent: AddStudent;
  readonly updateStudent: UpdateStudent;
  readonly deleteStudent: DeleteStudent;
  readonly listStudents: ListStudents;
  readonly importStudents: ImportStudents;
  readonly copyStudents: CopyStudents;
  readonly createSemester: CreateSemester;
  readonly updateSemester: UpdateSemester;
  readonly setActiveSemester: SetActiveSemester;
  readonly deleteSemester: DeleteSemester;
  readonly listSemesters: ListSemesters;
  readonly getOnboarding: GetOnboarding;
  readonly dismissOnboarding: DismissOnboarding;
  readonly getAttendanceSheet: GetAttendanceSheet;
  readonly saveAttendance: SaveAttendance;
  readonly submitAttendance: SubmitAttendance;
  readonly reopenAttendance: ReopenAttendance;
  readonly listAttendanceDays: ListAttendanceDays;
  readonly getAttendanceOverview: GetAttendanceOverview;
  readonly getAttendanceReport: GetAttendanceReport;
  readonly listGradeCategories: ListGradeCategories;
  readonly addGradeCategory: AddGradeCategory;
  readonly addStandardCategories: AddStandardCategories;
  readonly updateGradeCategory: UpdateGradeCategory;
  readonly deleteGradeCategory: DeleteGradeCategory;
  readonly listAssignments: ListAssignments;
  readonly createAssignment: CreateAssignment;
  readonly updateAssignment: UpdateAssignment;
  readonly deleteAssignment: DeleteAssignment;
  readonly getGradeEntry: GetGradeEntry;
  readonly saveGrades: SaveGrades;
  readonly getGradebook: GetGradebook;
  readonly createFolder: CreateFolder;
  readonly createPlan: CreatePlan;
  readonly deleteFolder: DeleteFolder;
  readonly deletePlan: DeletePlan;
  readonly deleteTemplate: DeleteTemplate;
  readonly duplicatePlan: DuplicatePlan;
  readonly getDraftedPlan: GetDraftedPlan;
  readonly getJob: GetJob;
  readonly getPlan: GetPlan;
  readonly listFolders: ListFolders;
  readonly listPlans: ListPlans;
  readonly listTemplates: ListTemplates;
  readonly movePlan: MovePlan;
  readonly requestLessonPlanDraft: RequestLessonPlanDraft;
  readonly saveAsTemplate: SaveAsTemplate;
  readonly startFromTemplate: StartFromTemplate;
  readonly updateFolder: UpdateFolder;
  readonly updatePlan: UpdatePlan;
  readonly getGradebookReport: GetGradebookReport;
  readonly getReportCards: GetReportCards;
  readonly saveReportCardComment: SaveReportCardComment;
  readonly reportCardRenderer: ReportCardRenderer;
  readonly uploadSchoolLogo: UploadSchoolLogo;
  readonly removeSchoolLogo: RemoveSchoolLogo;
  readonly getSchoolLogo: GetSchoolLogo;
  /** Today's date where the teacher is. */
  readonly today: (timeZone: string) => LocalDate;
  readonly google: GoogleIdentity;
  readonly tokens: RandomTokenGenerator;
  /** The header that carries the billing provider's webhook signature. */
  readonly webhookSignatureHeader: string;
  /** Development and test only: the "Pay" button of the in-app checkout. */
  readonly localCheckout: LocalCheckoutSimulator | null;
  /** Development and test only: signs the code of the in-app Google account picker. */
  readonly issueLocalGoogleCode: ((profile: GoogleProfile) => string) | null;
}

interface Billing {
  readonly checkout: CheckoutSessions;
  readonly billingEvents: BillingEvents;
  readonly webhookSignatureHeader: string;
  readonly localCheckout: LocalCheckoutSimulator | null;
}

/**
 * Google Classroom and Forms, or their stand-ins for development and tests. The stand-in's tokens are fake, so
 * they are sealed with a fixed key (the same in every server instance); production refuses it.
 */
function classroomFor(config: ClassroomConfig) {
  if (config.provider === 'local') {
    const classroom = new LocalClassroom();
    return {
      cipher: new AesGcmCipher(
        createHash('sha256').update('teacherhubpro-local-classroom').digest('base64'),
      ),
      classroomAuth: new LocalClassroomAuthorization(),
      classroomCourses: classroom,
      classroomCoursework: classroom,
      googleForms: new LocalForms(),
      googleDrive: new LocalDrive(),
      googleSlides: new LocalSlides(),
    };
  }
  const classroom = new GoogleClassroom();
  return {
    cipher: new AesGcmCipher(config.encryptionKey),
    classroomAuth: new GoogleClassroomAuthorization({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
    }),
    classroomCourses: classroom,
    classroomCoursework: loggedCoursework(classroom),
    googleForms: new GoogleFormsApi(),
    googleDrive: loggedDrive(new GoogleDriveApi()),
    googleSlides: loggedSlides(new GoogleSlidesApi()),
  };
}

/**
 * Canva's Connect API, its stand-in for development and tests (fake tokens, sealed with a fixed
 * key), or nothing when it is off.
 */
function canvaFor(config: CanvaConfig) {
  if (config.provider === 'off') return null;
  if (config.provider === 'local') {
    return {
      cipher: new AesGcmCipher(
        createHash('sha256').update('teacherhubpro-local-canva').digest('base64'),
      ),
      canvaAuth: new LocalCanvaAuthorization(),
      canvaDesigns: new LocalCanvaDesigns(),
    };
  }
  return {
    cipher: new AesGcmCipher(config.encryptionKey),
    canvaAuth: new CanvaConnectAuthorization({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
    }),
    canvaDesigns: new CanvaConnectDesigns(),
  };
}

/**
 * The Microsoft identity platform and Graph, their stand-ins for development and tests (fake
 * tokens, sealed with a fixed key), or nothing when it is off.
 */
function microsoftFor(config: MicrosoftConfig) {
  if (config.provider === 'off') return null;
  if (config.provider === 'local') {
    return {
      cipher: new AesGcmCipher(
        createHash('sha256').update('teacherhubpro-local-microsoft').digest('base64'),
      ),
      microsoftAuth: new LocalMicrosoftAuthorization(),
      oneDriveFiles: new LocalOneDriveFiles(),
    };
  }
  return {
    cipher: new AesGcmCipher(config.encryptionKey),
    microsoftAuth: new MicrosoftIdentityAuthorization({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
    }),
    oneDriveFiles: new OneDriveGraphFiles(),
  };
}

function billingFor(config: BillingConfig, appUrl: string): Billing {
  if (config.provider === 'local') {
    return {
      checkout: new LocalCheckoutSessions(appUrl),
      billingEvents: new LocalBillingEvents(config.secret),
      webhookSignatureHeader: LocalCheckoutSimulator.signatureHeader,
      localCheckout: new LocalCheckoutSimulator(appUrl, config.secret),
    };
  }
  const stripe = createStripeClient(config.secretKey);
  return {
    checkout: new StripeCheckoutSessions(stripe),
    billingEvents: new StripeBillingEvents(stripe, config.webhookSecret),
    webhookSignatureHeader: 'stripe-signature',
    localCheckout: null,
  };
}

function googleFor(config: GoogleConfig, appUrl: string) {
  return config.provider === 'local'
    ? {
        google: new LocalGoogleIdentity(appUrl, config.secret),
        issueLocalGoogleCode: (profile: GoogleProfile) =>
          issueLocalGoogleCode(config.secret, profile),
      }
    : {
        google: new GoogleOAuthIdentity({
          clientId: config.clientId,
          clientSecret: config.clientSecret,
        }),
        issueLocalGoogleCode: null,
      };
}

/** Composition root: the only place in the web app where concrete adapters are created. */
export function createAppContainer(
  config: WebConfig,
  db: ReturnType<typeof createDatabase> = createDatabase(config.databaseUrl),
): AppContainer {
  const billing = billingFor(config.billing, config.appUrl);
  const identity = googleFor(config.google, config.appUrl);
  const localMailer = new LocalMailer(db);
  const deps = {
    ...createPostgresRepositories(db),
    ...billing,
    google: identity.google,
    ...classroomFor(config.classroom),
    clock: new SystemClock(),
    ids: new UuidIdGenerator(),
    tokens: new NodeRandomTokenGenerator(),
    tokenHasher: new Sha256TokenHasher(),
    passwordHasher: new ScryptPasswordHasher(),
    files: new PostgresFileStore(db),
    jobs: new PostgresJobQueue(db, new UuidIdGenerator()),
    seeds: new CryptoSeedSource(),
    ticketSigner: new HmacTicketSigner(config.realtime.ticketSecret),
    gameModes: defaultGameModes,
    appUrl: config.appUrl,
    setupKey: config.superAdminSetupKey,
    leadsNotifyEmail: config.leadsNotifyEmail,
    mailer:
      config.mail.provider === 'resend'
        ? loggedMailer(
            new ResendMailer({ apiKey: config.mail.apiKey, from: config.mail.from }),
            (line) => process.stdout.write(line),
          )
        : localMailer,
    mailTemplates: emailTemplates(config.appUrl),
    presentationFiles: new PptxPresentationWriter(),
    documentFiles: new DocxDocumentWriter(),
  };
  const canva = canvaFor(config.canva);
  const canvaDeps = canva === null ? null : { ...deps, ...canva };
  const microsoft = microsoftFor(config.microsoft);
  const microsoftDeps = microsoft === null ? null : { ...deps, ...microsoft };

  return {
    appUrl: config.appUrl,
    realtimeUrl: config.realtime.url,
    startLiveSession: new StartLiveSession(deps),
    listLiveSessions: new ListLiveSessions(deps),
    openLiveHost: new OpenLiveHost(deps),
    deleteLiveSession: new DeleteLiveSession(deps),
    getLiveInsights: new GetLiveInsights(deps),
    findLiveSessionByPin: new FindLiveSessionByPin(deps),
    joinLiveSession: new JoinLiveSession(deps),
    verifyLiveTicket: new VerifyLiveTicket(deps),
    startSelfPacedRound: new StartSelfPacedRound(deps),
    finishSelfPacedRound: new FinishSelfPacedRound(deps),
    issuePortalLink: new IssuePortalLink(deps),
    emailPortalLink: new EmailPortalLink(deps),
    listPortalLinks: new ListPortalLinks(deps),
    revokePortalLink: new RevokePortalLink(deps),
    openFamilyPortal: new OpenFamilyPortal(deps),
    mailDelivers: config.mail.delivers,
    sentMailbox:
      config.mail.provider === 'local' && config.env !== 'production' ? localMailer : null,
    requestLearningPath: new RequestLearningPath(deps),
    getClassLearning: new GetClassLearning(deps),
    getLearningPath: new GetLearningPath(deps),
    updateLearningPath: new UpdateLearningPath(deps),
    assignLearningPath: new AssignLearningPath(deps),
    archiveLearningPath: new ArchiveLearningPath(deps),
    deleteLearningPath: new DeleteLearningPath(deps),
    getStudentLearning: new GetStudentLearning(deps),
    listStudentPaths: new ListStudentPaths(deps),
    openLearnerLesson: new OpenLearnerLesson(deps),
    submitLessonCheck: new SubmitLessonCheck(deps),
    requestGeneration: new RequestGeneration(deps),
    listGenerations: new ListGenerations(deps),
    getGeneration: new GetGeneration(deps),
    deleteGeneration: new DeleteGeneration(deps),
    requestPresentationDraft: new RequestPresentationDraft(deps),
    createPresentation: new CreatePresentation(deps),
    listPresentations: new ListPresentations(deps),
    getPresentation: new GetPresentation(deps),
    updatePresentation: new UpdatePresentation(deps),
    deletePresentation: new DeletePresentation(deps),
    requestRubricDraft: new RequestRubricDraft(deps),
    createRubric: new CreateRubric(deps),
    listRubrics: new ListRubrics(deps),
    getRubric: new GetRubric(deps),
    updateRubric: new UpdateRubric(deps),
    deleteRubric: new DeleteRubric(deps),
    requestSpeech: new RequestSpeech({ ...deps, voice: config.voice }),
    saveQuestions: new SaveQuestions(deps),
    saveInstructions: new SaveInstructions(deps),
    uploadAttachment: new UploadAttachment(deps),
    deleteAttachment: new DeleteAttachment(deps),
    listAttachments: new ListAttachments(deps),
    getAttachmentFile: new GetAttachmentFile(deps),
    requestPdfImport: new RequestPdfImport(deps),
    getImportedTest: new GetImportedTest(deps),
    issueLinks: new IssueLinks(deps),
    listLinks: new ListLinks(deps),
    revokeLink: new RevokeLink(deps),
    reissueLink: new ReissueLink(deps),
    openStudentLink: new OpenStudentLink(deps),
    getStudentAssignment: new GetStudentAssignment(deps),
    submitAnswers: new SubmitAnswers(deps),
    getStudentAttachment: new GetStudentAttachment(deps),
    listSubmissions: new ListSubmissions(deps),
    getAssignmentOverview: new GetAssignmentOverview(deps),
    requestAiGrading: new RequestAiGrading(deps),
    confirmGrade: new ConfirmGrade(deps),
    gradeByHand: new GradeByHand(deps),
    startClassroomConnect: new StartClassroomConnect(deps),
    finishClassroomConnect: new FinishClassroomConnect(deps),
    disconnectClassroom: new DisconnectClassroom(deps),
    listClassroomCourses: new ListClassroomCourses(deps),
    importClassroomRoster: new ImportClassroomRoster(deps),
    shareAssignment: new ShareAssignment(deps),
    postWordToClassroom: new PostWordToClassroom(deps),
    sendPresentationToClassroom: new SendPresentationToClassroom(deps),
    canva:
      canvaDeps === null
        ? null
        : {
            startConnect: new StartCanvaConnect(canvaDeps),
            finishConnect: new FinishCanvaConnect(canvaDeps),
            disconnect: new DisconnectCanva(canvaDeps),
            connected: new CanvaConnected(canvaDeps),
            sendPresentation: new SendPresentationToCanva(canvaDeps),
            sendGeneration: new SendGenerationToCanva(canvaDeps),
          },
    microsoft:
      microsoftDeps === null
        ? null
        : {
            startConnect: new StartMicrosoftConnect(microsoftDeps),
            finishConnect: new FinishMicrosoftConnect(microsoftDeps),
            disconnect: new DisconnectMicrosoft(microsoftDeps),
            connected: new MicrosoftConnected(microsoftDeps),
            savePresentation: new SavePresentationToOneDrive(microsoftDeps),
            saveGeneration: new SaveGenerationToOneDrive(microsoftDeps),
          },
    downloadPresentationFile: new DownloadPresentationFile(deps),
    startChat: new StartChat(deps),
    sendChatMessage: new SendChatMessage(deps),
    getChat: new GetChat(deps),
    captureLead: new CaptureLead(deps),
    listLeads: new ListLeads(deps),
    updateLeadStatus: new UpdateLeadStatus(deps),
    throttle: new Throttle(deps),
    recordActivity: new RecordActivity(deps),
    listActivity: new ListActivity(deps),
    superAdminSetupAvailable: config.superAdminSetupKey !== null,
    setUpFirstSuperAdmin: new SetUpFirstSuperAdmin(deps),
    requestPasswordReset: new RequestPasswordReset(deps),
    setPassword: new SetPassword(deps),
    sendPasswordLink: new SendPasswordLink(deps),
    listSchoolUsers: new ListSchoolUsers(deps),
    changeUserRole: new ChangeUserRole(deps),
    transferClasses: new TransferClasses(deps),
    getPlatformOverview: new GetPlatformOverview(deps),
    listSchools: new ListSchools(deps),
    createSchool: new CreateSchool(deps),
    updateSchool: new UpdateSchool(deps),
    deleteSchool: new DeleteSchool(deps),
    listSchoolClasses: new ListSchoolClasses(deps),
    listAllUsers: new ListAllUsers(deps),
    createUser: new CreateUser(deps),
    updateUser: new UpdateUser(deps),
    deleteUser: new DeleteUser(deps),
    importTeachers: new ImportTeachers(deps),
    importSchoolStudents: new ImportSchoolStudents(deps),
    getCommandCenter: new GetCommandCenter(deps),
    getStudent360: new GetStudent360(deps),
    addStudentNote: new AddStudentNote(deps),
    deleteStudentNote: new DeleteStudentNote(deps),
    requestStudentInsight: new RequestStudentInsight(deps),
    startPrepBatch: new StartPrepBatch(deps),
    resumePrepBatch: new ResumePrepBatch(deps),
    getPrepBatch: new GetPrepBatch(deps),
    listPrepBatches: new ListPrepBatches(deps),
    countReadyPrepBatches: new CountReadyPrepBatches(deps),
    updatePrepSelection: new UpdatePrepSelection(deps),
    publishPrepBatch: new PublishPrepBatch(deps),
    deletePrepBatch: new DeletePrepBatch(deps),
    makeFormsQuiz: new MakeFormsQuiz(deps),
    findFormsQuiz: new FindFormsQuiz(deps),
    createGame: new CreateGame(deps),
    updateGame: new UpdateGame(deps),
    listGames: new ListGames(deps),
    getGame: new GetGame(deps),
    deleteGame: new DeleteGame(deps),
    requestGameDraft: new RequestGameDraft(deps),
    getGameDraft: new GetGameDraft(deps),
    saveGameGrading: new SaveGameGrading(deps),
    startGameRound: new StartGameRound(deps),
    finishGameRound: new FinishGameRound(deps),
    startPreviewRound: new StartPreviewRound(deps),
    finishPreviewRound: new FinishPreviewRound(deps),
    getGameLeaderboard: new GetGameLeaderboard(deps),
    getGameResults: new GetGameResults(deps),
    confirmGameGrades: new ConfirmGameGrades(deps),
    getSpeechClip: new GetSpeechClip(deps),
    getSubPacket: new GetSubPacket(deps),
    saveSubPacket: new SaveSubPacket(deps),
    signUp: new SignUp(deps),
    logIn: new LogIn(deps),
    logOut: new LogOut(deps),
    authenticate: new AuthenticateSession(deps),
    signInWithGoogle: new SignInWithGoogle(deps),
    updateProfile: new UpdateProfile(deps),
    updateSchoolDetails: new UpdateSchoolDetails(deps),
    startCheckout: new StartCheckout(deps),
    handleBillingWebhook: new HandleBillingWebhook(deps),
    createClass: new CreateClass(deps),
    updateClass: new UpdateClass(deps),
    archiveClass: new ArchiveClass(deps),
    restoreClass: new RestoreClass(deps),
    getClass: new GetClass(deps),
    listClasses: new ListClasses(deps),
    addStudent: new AddStudent(deps),
    updateStudent: new UpdateStudent(deps),
    deleteStudent: new DeleteStudent(deps),
    listStudents: new ListStudents(deps),
    importStudents: new ImportStudents(deps),
    copyStudents: new CopyStudents(deps),
    createSemester: new CreateSemester(deps),
    updateSemester: new UpdateSemester(deps),
    setActiveSemester: new SetActiveSemester(deps),
    deleteSemester: new DeleteSemester(deps),
    listSemesters: new ListSemesters(deps),
    getOnboarding: new GetOnboarding({
      ...deps,
      items: defaultOnboardingItems,
      defaultSchoolNames: [
        ...new Set(locales.map((locale) => createTranslator(locale)('defaults.schoolName'))),
      ],
    }),
    dismissOnboarding: new DismissOnboarding(deps),
    getAttendanceSheet: new GetAttendanceSheet(deps),
    saveAttendance: new SaveAttendance(deps),
    submitAttendance: new SubmitAttendance(deps),
    reopenAttendance: new ReopenAttendance(deps),
    listAttendanceDays: new ListAttendanceDays(deps),
    getAttendanceOverview: new GetAttendanceOverview(deps),
    getAttendanceReport: new GetAttendanceReport(deps),
    listGradeCategories: new ListGradeCategories(deps),
    addGradeCategory: new AddGradeCategory(deps),
    addStandardCategories: new AddStandardCategories(deps),
    updateGradeCategory: new UpdateGradeCategory(deps),
    deleteGradeCategory: new DeleteGradeCategory(deps),
    listAssignments: new ListAssignments(deps),
    createAssignment: new CreateAssignment(deps),
    updateAssignment: new UpdateAssignment(deps),
    deleteAssignment: new DeleteAssignment(deps),
    getGradeEntry: new GetGradeEntry(deps),
    saveGrades: new SaveGrades(deps),
    getGradebook: new GetGradebook(deps),
    createFolder: new CreateFolder(deps),
    createPlan: new CreatePlan(deps),
    deleteFolder: new DeleteFolder(deps),
    deletePlan: new DeletePlan(deps),
    deleteTemplate: new DeleteTemplate(deps),
    duplicatePlan: new DuplicatePlan(deps),
    getDraftedPlan: new GetDraftedPlan(deps),
    getJob: new GetJob(deps),
    getPlan: new GetPlan(deps),
    listFolders: new ListFolders(deps),
    listPlans: new ListPlans(deps),
    listTemplates: new ListTemplates(deps),
    movePlan: new MovePlan(deps),
    requestLessonPlanDraft: new RequestLessonPlanDraft(deps),
    saveAsTemplate: new SaveAsTemplate(deps),
    startFromTemplate: new StartFromTemplate(deps),
    updateFolder: new UpdateFolder(deps),
    updatePlan: new UpdatePlan(deps),
    getGradebookReport: new GetGradebookReport(deps),
    getReportCards: new GetReportCards(deps),
    saveReportCardComment: new SaveReportCardComment(deps),
    reportCardRenderer: new PdfLibReportCardRenderer(),
    uploadSchoolLogo: new UploadSchoolLogo(deps),
    removeSchoolLogo: new RemoveSchoolLogo(deps),
    getSchoolLogo: new GetSchoolLogo(deps),
    today: (timeZone) => localDateIn(deps.clock.now(), timeZone),
    google: identity.google,
    tokens: deps.tokens,
    webhookSignatureHeader: billing.webhookSignatureHeader,
    localCheckout: billing.localCheckout,
    issueLocalGoogleCode: identity.issueLocalGoogleCode,
  };
}

let instance: AppContainer | undefined;

/** The process-wide container, built on first use from the environment. Misconfiguration fails loudly. */
export function getAppContainer(): AppContainer {
  if (instance) return instance;
  const config = parseWebConfig(process.env);
  if (!config.ok) throw new Error(`Invalid configuration: ${config.error}`);
  for (const warning of config.value.warnings) {
    process.stderr.write(`Integration turned off: ${warning}\n`);
  }
  instance = createAppContainer(config.value);
  return instance;
}
