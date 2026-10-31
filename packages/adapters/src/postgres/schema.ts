import type { ColumnType, Generated } from 'kysely';

/** jsonb: read back already parsed; written as JSON text. */
export type Json = ColumnType<unknown, string, string>;

/** `date` columns are read as YYYY-MM-DD strings (see database.ts). */
type DateText = string;

type CreatedAt = Generated<Date>;

export interface SchoolsTable {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  logo_key: string | null;
  created_at: CreatedAt;
}

export interface UsersTable {
  id: string;
  school_id: string;
  email: string;
  name: string;
  role: string;
  language: string;
  picture: string | null;
  onboarding_status: string;
  created_at: CreatedAt;
}

export interface ClassesTable {
  id: string;
  school_id: string;
  teacher_id: string;
  name: string;
  subject: string | null;
  grade: string | null;
  section: string | null;
  school_year: string | null;
  semester_id: string | null;
  /** Null when the class has no schedule; otherwise the schedule's days. */
  schedule_days: Json | null;
  period: number | null;
  start_time: string | null;
  end_time: string | null;
  archived_at: Date | null;
  created_at: CreatedAt;
}

export interface StudentsTable {
  id: string;
  school_id: string;
  class_id: string;
  first_name: string;
  last_name: string;
  student_number: string | null;
  parent_email: string | null;
  accommodations: string | null;
  created_at: CreatedAt;
}

export interface SemestersTable {
  id: string;
  school_id: string;
  name: string;
  start_date: DateText;
  end_date: DateText;
  school_year: string | null;
  is_active: boolean;
  created_at: CreatedAt;
}

export interface LessonPlansTable {
  id: string;
  school_id: string;
  teacher_id: string;
  kind: string;
  title: string | null;
  class_id: string | null;
  folder_id: string | null;
  body: Json;
  created_at: CreatedAt;
}

export interface PlanFoldersTable {
  id: string;
  school_id: string;
  teacher_id: string;
  name: string;
  color: string;
  created_at: CreatedAt;
}

export interface PlanTemplatesTable {
  id: string;
  school_id: string;
  teacher_id: string;
  name: string;
  kind: string;
  title: string | null;
  body: Json;
  created_at: CreatedAt;
}

/** created_at is set from the domain, so it is written like any other column. */
export interface AiGenerationsTable {
  id: string;
  school_id: string;
  teacher_id: string;
  type: string;
  subject: string;
  grade: string;
  topic: string;
  language: string;
  content: string;
  created_at: Date;
}

export interface PresentationsTable {
  id: string;
  school_id: string;
  teacher_id: string;
  name: string;
  topic: string | null;
  subject: string | null;
  grade: string | null;
  theme: string;
  slides: Json;
  created_at: Date;
  updated_at: Date;
}

export interface SubPacketsTable {
  class_id: string;
  school_id: string;
  main_office_ext: string | null;
  nurse_ext: string | null;
  daily_routines: string | null;
  emergency_procedures: string | null;
  additional_notes: string | null;
  include_accommodations: boolean;
  updated_at: Generated<Date>;
}

export interface JobsTable {
  id: string;
  school_id: string;
  owner_id: string;
  kind: string;
  payload: Json;
  status: Generated<string>;
  result: ColumnType<unknown, string | null, string | null>;
  error: string | null;
  attempts: Generated<number>;
  created_at: Generated<Date>;
  started_at: Date | null;
  finished_at: Date | null;
}

export interface GradeCategoriesTable {
  id: string;
  school_id: string;
  class_id: string;
  name: string;
  weight_percent: number;
  created_at: CreatedAt;
}

export interface AssignmentsTable {
  id: string;
  school_id: string;
  class_id: string;
  category_id: string;
  title: string;
  points: number;
  due_date: DateText | null;
  instructions: string | null;
  questions: Json;
  created_at: CreatedAt;
}

export interface GradesTable {
  id: string;
  school_id: string;
  student_id: string;
  assignment_id: string;
  status: string;
  score: number | null;
  source: string;
  graded_by: string;
  comment: string | null;
  created_at: CreatedAt;
}

export interface ReportCardCommentsTable {
  id: string;
  school_id: string;
  class_id: string;
  student_id: string;
  text: string;
  written_by: string;
  created_at: CreatedAt;
}

export interface StoredFilesTable {
  key: string;
  content_type: string;
  bytes: Uint8Array;
  created_at: CreatedAt;
}

export interface SubmissionsTable {
  id: string;
  school_id: string;
  assignment_id: string;
  student_id: string;
  answers: Json;
  submitted_at: Date;
  max_points: number;
  status: string;
  ai_draft: Json | null;
  ai_failure: string | null;
  final_score: number | null;
  confirmed_by: string | null;
  late: boolean;
  question_scores: Json;
  created_at: CreatedAt;
}

export interface AssignmentAttachmentsTable {
  id: string;
  school_id: string;
  assignment_id: string;
  name: string;
  content_type: string;
  size: number;
  key: string;
  created_at: CreatedAt;
}

export interface StudentLinksTable {
  id: string;
  school_id: string;
  class_id: string;
  student_id: string;
  token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
  created_at: CreatedAt;
}

export interface ClassroomConnectionsTable {
  teacher_id: string;
  school_id: string;
  encrypted_refresh_token: string;
  connected_at: Date;
}

export interface AttendanceSessionsTable {
  id: string;
  school_id: string;
  class_id: string;
  date: DateText;
  status: string;
  created_at: CreatedAt;
}

/** One row per rostered student; a null status means not marked yet. */
export interface AttendanceEntriesTable {
  session_id: string;
  student_id: string;
  position: number;
  status: string | null;
  minutes_late: number | null;
  note: string | null;
}

export interface GamesTable {
  id: string;
  school_id: string;
  teacher_id: string;
  title: string;
  mode_id: string;
  language: string;
  items: Json;
  created_at: CreatedAt;
}

export interface SubscriptionsTable {
  id: string;
  school_id: string;
  owner_id: string;
  plan_id: string;
  quantity: number;
  status: string;
  trial_ends_at: Date;
  current_period_end: Date | null;
  external_id: string | null;
  created_at: CreatedAt;
}

export interface SessionsTable {
  token_hash: string;
  user_id: string;
  school_id: string;
  created_at: Date;
  expires_at: Date;
}

export interface PasswordCredentialsTable {
  user_id: string;
  password_hash: string;
  updated_at: Generated<Date>;
}

export interface Database {
  schools: SchoolsTable;
  users: UsersTable;
  classes: ClassesTable;
  students: StudentsTable;
  semesters: SemestersTable;
  lesson_plans: LessonPlansTable;
  plan_folders: PlanFoldersTable;
  plan_templates: PlanTemplatesTable;
  jobs: JobsTable;
  ai_generations: AiGenerationsTable;
  presentations: PresentationsTable;
  sub_packets: SubPacketsTable;
  grade_categories: GradeCategoriesTable;
  assignments: AssignmentsTable;
  grades: GradesTable;
  report_card_comments: ReportCardCommentsTable;
  stored_files: StoredFilesTable;
  submissions: SubmissionsTable;
  assignment_attachments: AssignmentAttachmentsTable;
  student_links: StudentLinksTable;
  classroom_connections: ClassroomConnectionsTable;
  attendance_sessions: AttendanceSessionsTable;
  attendance_entries: AttendanceEntriesTable;
  games: GamesTable;
  subscriptions: SubscriptionsTable;
  sessions: SessionsTable;
  password_credentials: PasswordCredentialsTable;
}
