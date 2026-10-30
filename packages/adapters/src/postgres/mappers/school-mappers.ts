import {
  languages,
  folderColors,
  onboardingStatuses,
  planIds,
  roles,
  subscriptionStatuses,
  type Class,
  type ClassId,
  type Email,
  type Game,
  type GameId,
  type GameModeId,
  type LessonPlan,
  type PlanBody,
  type PlanFolder,
  type PlanTemplate,
  type PlanTemplateId,
  type LessonPlanId,
  type PlanFolderId,
  type School,
  type SchoolId,
  type Semester,
  type SemesterId,
  type Student,
  type StudentId,
  type Subscription,
  type SubscriptionId,
  type User,
  type UserId,
} from '@thp/domain';
import type {
  ClassesTable,
  GamesTable,
  LessonPlansTable,
  PlanFoldersTable,
  PlanTemplatesTable,
  SchoolsTable,
  SemestersTable,
  StudentsTable,
  SubscriptionsTable,
  UsersTable,
} from '../schema.ts';
import {
  localDate,
  oneOf,
  readJson,
  timeOfDay,
  toJson,
  weekdayList,
  type RowMapper,
} from './columns.ts';

export const schoolMapper: RowMapper<School, SchoolsTable> = {
  toRow: (school) => ({
    id: school.id,
    name: school.name,
    address: school.address,
    phone: school.phone,
    email: school.email,
    logo_key: school.logoKey,
  }),
  fromRow: (row) => ({
    id: row.id as SchoolId,
    name: row.name,
    address: row.address,
    phone: row.phone,
    email: row.email as Email | null,
    logoKey: row.logo_key,
  }),
};

export const userMapper: RowMapper<User, UsersTable> = {
  toRow: (user) => ({
    id: user.id,
    school_id: user.schoolId,
    email: user.email,
    name: user.name,
    role: user.role,
    language: user.language,
    picture: user.picture,
    onboarding_status: user.onboardingStatus,
  }),
  fromRow: (row) => ({
    id: row.id as UserId,
    schoolId: row.school_id as SchoolId,
    email: row.email as Email,
    name: row.name,
    role: oneOf(roles, row.role, 'users.role'),
    language: oneOf(languages, row.language, 'users.language'),
    picture: row.picture,
    onboardingStatus: oneOf(onboardingStatuses, row.onboarding_status, 'users.onboarding_status'),
  }),
};

export const classMapper: RowMapper<Class, ClassesTable> = {
  toRow: (cls) => ({
    id: cls.id,
    school_id: cls.schoolId,
    teacher_id: cls.teacherId,
    name: cls.name,
    subject: cls.subject,
    grade: cls.grade,
    section: cls.section,
    school_year: cls.schoolYear,
    semester_id: cls.semesterId,
    schedule_days: cls.schedule === null ? null : toJson(cls.schedule.days),
    period: cls.schedule?.period ?? null,
    start_time: cls.schedule?.startTime ?? null,
    end_time: cls.schedule?.endTime ?? null,
    archived_at: cls.archivedAt,
  }),
  fromRow: (row) => ({
    id: row.id as ClassId,
    schoolId: row.school_id as SchoolId,
    teacherId: row.teacher_id as UserId,
    name: row.name,
    subject: row.subject,
    grade: row.grade,
    section: row.section,
    schoolYear: row.school_year,
    semesterId: row.semester_id as SemesterId | null,
    schedule:
      row.schedule_days === null
        ? null
        : {
            period: row.period,
            startTime:
              row.start_time === null ? null : timeOfDay(row.start_time, 'classes.start_time'),
            endTime: row.end_time === null ? null : timeOfDay(row.end_time, 'classes.end_time'),
            days: weekdayList(readJson(row.schedule_days), 'classes.schedule_days'),
          },
    archivedAt: row.archived_at,
  }),
};

export const studentMapper: RowMapper<Student, StudentsTable> = {
  toRow: (student) => ({
    id: student.id,
    school_id: student.schoolId,
    class_id: student.classId,
    first_name: student.firstName,
    last_name: student.lastName,
    student_number: student.studentNumber,
    parent_email: student.parentEmail,
    accommodations: student.accommodations,
  }),
  fromRow: (row) => ({
    id: row.id as StudentId,
    schoolId: row.school_id as SchoolId,
    classId: row.class_id as ClassId,
    firstName: row.first_name,
    lastName: row.last_name,
    studentNumber: row.student_number,
    parentEmail: row.parent_email as Email | null,
    accommodations: row.accommodations,
  }),
};

export const semesterMapper: RowMapper<Semester, SemestersTable> = {
  toRow: (semester) => ({
    id: semester.id,
    school_id: semester.schoolId,
    name: semester.name,
    start_date: semester.startDate,
    end_date: semester.endDate,
    school_year: semester.schoolYear,
    is_active: semester.isActive,
  }),
  fromRow: (row) => ({
    id: row.id as SemesterId,
    schoolId: row.school_id as SchoolId,
    name: row.name,
    startDate: localDate(row.start_date, 'semesters.start_date'),
    endDate: localDate(row.end_date, 'semesters.end_date'),
    schoolYear: row.school_year,
    isActive: row.is_active,
  }),
};

export const lessonPlanMapper: RowMapper<LessonPlan, LessonPlansTable> = {
  toRow: (plan) => ({
    id: plan.id,
    school_id: plan.schoolId,
    teacher_id: plan.teacherId,
    kind: plan.body.kind,
    title: plan.title,
    class_id: plan.classId,
    folder_id: plan.folderId,
    body: toJson(plan.body),
  }),
  fromRow: (row) => ({
    id: row.id as LessonPlanId,
    schoolId: row.school_id as SchoolId,
    teacherId: row.teacher_id as UserId,
    title: row.title,
    classId: row.class_id as ClassId | null,
    folderId: row.folder_id as PlanFolderId | null,
    body: readJson(row.body) as PlanBody,
  }),
};

export const planFolderMapper: RowMapper<PlanFolder, PlanFoldersTable> = {
  toRow: (folder) => ({
    id: folder.id,
    school_id: folder.schoolId,
    teacher_id: folder.teacherId,
    name: folder.name,
    color: folder.color,
  }),
  fromRow: (row) => ({
    id: row.id as PlanFolderId,
    schoolId: row.school_id as SchoolId,
    teacherId: row.teacher_id as UserId,
    name: row.name,
    color: oneOf(folderColors, row.color, 'plan_folders.color'),
  }),
};

export const planTemplateMapper: RowMapper<PlanTemplate, PlanTemplatesTable> = {
  toRow: (template) => ({
    id: template.id,
    school_id: template.schoolId,
    teacher_id: template.teacherId,
    name: template.name,
    kind: template.body.kind,
    title: template.title,
    body: toJson(template.body),
  }),
  fromRow: (row) => ({
    id: row.id as PlanTemplateId,
    schoolId: row.school_id as SchoolId,
    teacherId: row.teacher_id as UserId,
    name: row.name,
    title: row.title,
    body: readJson(row.body) as PlanBody,
  }),
};

export const gameMapper: RowMapper<Game, GamesTable> = {
  toRow: (game) => ({
    id: game.id,
    school_id: game.schoolId,
    teacher_id: game.teacherId,
    title: game.title,
    mode_id: game.modeId,
    language: game.language,
    items: toJson(game.items),
  }),
  fromRow: (row) => ({
    id: row.id as GameId,
    schoolId: row.school_id as SchoolId,
    teacherId: row.teacher_id as UserId,
    title: row.title,
    modeId: row.mode_id as GameModeId,
    language: oneOf(languages, row.language, 'games.language'),
    items: readJson(row.items) as readonly unknown[],
  }),
};

export const subscriptionMapper: RowMapper<Subscription, SubscriptionsTable> = {
  toRow: (subscription) => ({
    id: subscription.id,
    school_id: subscription.schoolId,
    owner_id: subscription.ownerId,
    plan_id: subscription.planId,
    quantity: subscription.quantity,
    status: subscription.status,
    trial_ends_at: subscription.trialEndsAt,
    current_period_end: subscription.currentPeriodEnd,
    external_id: subscription.externalId,
  }),
  fromRow: (row) => ({
    id: row.id as SubscriptionId,
    schoolId: row.school_id as SchoolId,
    ownerId: row.owner_id as UserId,
    planId: oneOf(planIds, row.plan_id, 'subscriptions.plan_id'),
    quantity: row.quantity,
    status: oneOf(subscriptionStatuses, row.status, 'subscriptions.status'),
    trialEndsAt: row.trial_ends_at,
    currentPeriodEnd: row.current_period_end,
    externalId: row.external_id,
  }),
};
