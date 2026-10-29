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
  logo_url: string | null;
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
  week_start: DateText;
  class_id: string | null;
  folder_id: string | null;
  days: Json;
  standards: Json;
  created_at: CreatedAt;
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
  created_at: CreatedAt;
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
  grade_categories: GradeCategoriesTable;
  assignments: AssignmentsTable;
  grades: GradesTable;
  submissions: SubmissionsTable;
  attendance_sessions: AttendanceSessionsTable;
  attendance_entries: AttendanceEntriesTable;
  games: GamesTable;
  subscriptions: SubscriptionsTable;
  sessions: SessionsTable;
  password_credentials: PasswordCredentialsTable;
}
