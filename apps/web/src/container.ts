import {
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
  type GoogleConfig,
  type WebConfig,
} from './server/config.ts';
import { createTranslator, locales } from '@thp/i18n';
import { localDateIn, type LocalDate } from '@thp/domain';

export interface AppContainer {
  readonly appUrl: string;
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
  const deps = {
    ...createPostgresRepositories(db),
    ...billing,
    google: identity.google,
    clock: new SystemClock(),
    ids: new UuidIdGenerator(),
    tokens: new NodeRandomTokenGenerator(),
    tokenHasher: new Sha256TokenHasher(),
    passwordHasher: new ScryptPasswordHasher(),
    files: new PostgresFileStore(db),
    jobs: new PostgresJobQueue(db, new UuidIdGenerator()),
    appUrl: config.appUrl,
  };

  return {
    appUrl: config.appUrl,
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
  instance = createAppContainer(config.value);
  return instance;
}
