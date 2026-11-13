'use client';

import { useActionState, useState } from 'react';
import { createTranslator, type Locale, type MessageKey } from '@thp/i18n';
import {
  gradeSubmissionAction,
  importRosterAction,
  issueLinksAction,
  makeFormsQuizAction,
  postWordToClassroomAction,
  requestAiGradingAction,
  requestPdfImportAction,
  shareAssignmentAction,
  uploadAttachmentAction,
  type AssignmentFormState,
} from '../app/_lib/assignment-actions.ts';
import { importLtiRosterAction } from '../app/_lib/lti-roster-actions.ts';
import {
  importTeamsRosterAction,
  postWordToTeamsAction,
  shareToTeamsAction,
} from '../app/_lib/teams-actions.ts';
import { Field, FormAlert, Submit } from './forms.tsx';
import { Hidden, Select, TextArea, type Option } from './form-fields.tsx';
import { ScheduleFields } from './schedule-fields.tsx';

const initial: AssignmentFormState = {};

type FormAction = (state: AssignmentFormState, data: FormData) => Promise<AssignmentFormState>;

/** Where a class roster can be imported from. */
interface RosterSource {
  /** Distinguishes the fields when several sources are on one page. */
  readonly idPrefix: string;
  /** The form field that carries the chosen course or class. */
  readonly field: string;
  readonly importRoster: FormAction;
  readonly keys: {
    readonly target: MessageKey;
    readonly importRoster: MessageKey;
  };
}

/**
 * Where an assignment or a roster comes from or goes: Google Classroom or Microsoft Teams. A new
 * destination is a new entry here, not a branch in the forms.
 */
interface Destination extends RosterSource {
  readonly share: FormAction;
  readonly postWord: FormAction;
  readonly keys: RosterSource['keys'] & {
    readonly share: MessageKey;
    readonly shared: MessageKey;
    readonly openLink: MessageKey;
    readonly shareNote: MessageKey;
    readonly wordSubmit: MessageKey;
    readonly wordPosted: MessageKey;
    readonly wordOpen: MessageKey;
    readonly wordNote: MessageKey;
  };
}

const destinations = {
  classroom: {
    idPrefix: '',
    field: 'courseId',
    share: shareAssignmentAction,
    importRoster: importRosterAction,
    postWord: postWordToClassroomAction,
    keys: {
      target: 'classroom.course',
      share: 'classroom.share',
      shared: 'classroom.shared',
      openLink: 'classroom.sharedLink',
      shareNote: 'classroom.shareNote',
      importRoster: 'classroom.importRoster',
      wordSubmit: 'wordPost.submit',
      wordPosted: 'wordPost.posted',
      wordOpen: 'wordPost.openClassroom',
      wordNote: 'wordPost.note',
    },
  },
  teams: {
    idPrefix: 'teams-',
    field: 'teamsClassId',
    share: shareToTeamsAction,
    importRoster: importTeamsRosterAction,
    postWord: postWordToTeamsAction,
    keys: {
      target: 'teams.class',
      share: 'teams.share',
      shared: 'teams.shared',
      openLink: 'teams.sharedLink',
      shareNote: 'teams.shareNote',
      importRoster: 'teams.importRoster',
      wordSubmit: 'teams.wordSubmit',
      wordPosted: 'teams.wordPosted',
      wordOpen: 'teams.sharedLink',
      wordNote: 'teams.wordNote',
    },
  },
} as const satisfies Record<string, Destination>;

export type DestinationName = keyof typeof destinations;

/**
 * Every roster source: the destinations, and course systems over LTI (rosters only). A new source
 * is a new entry here.
 */
const rosterSources = {
  ...destinations,
  lti: {
    idPrefix: 'lti-',
    field: 'ltiCourse',
    importRoster: importLtiRosterAction,
    keys: { target: 'lti.course', importRoster: 'lti.importRoster' },
  },
} as const satisfies Record<string, RosterSource>;

export type RosterSourceName = keyof typeof rosterSources;

interface AssignmentProps {
  readonly locale: Locale;
  readonly classId: string;
  readonly assignmentId: string;
}

const hidden = (props: AssignmentProps) => ({
  locale: props.locale,
  classId: props.classId,
  assignmentId: props.assignmentId,
});

const allErrors = (state: AssignmentFormState) =>
  state.errors === undefined ? undefined : Object.values(state.errors).join(' ');

function FileField(props: {
  readonly id: string;
  readonly name: string;
  readonly label: string;
  readonly accept: string;
  readonly error?: string | undefined;
}) {
  return (
    <div className="field">
      <label htmlFor={props.id}>{props.label}</label>
      <input id={props.id} name={props.name} type="file" accept={props.accept} />
      {props.error === undefined ? null : <p className="field-error">{props.error}</p>}
    </div>
  );
}

export function AttachmentUploadForm(props: AssignmentProps) {
  const t = createTranslator(props.locale);
  const [state, action] = useActionState(uploadAttachmentAction, initial);
  return (
    <form
      action={action}
      className="stack"
      aria-label={t('attachments.upload')}
      key={state.version}
    >
      <Hidden values={hidden(props)} />
      <FormAlert message={state.errors?.form} />
      <FileField
        id="attachment-file"
        name="file"
        label={t('attachments.file')}
        accept=".pdf,.png,.jpg,.jpeg,.docx,.pptx"
        error={state.errors?.file}
      />
      <Submit label={t('attachments.upload')} />
    </form>
  );
}

export function PdfImportForm(props: AssignmentProps) {
  const t = createTranslator(props.locale);
  const [state, action] = useActionState(requestPdfImportAction, initial);
  return (
    <form action={action} className="stack" aria-label={t('pdfImport.title')}>
      <Hidden values={hidden(props)} />
      <FormAlert message={state.errors?.form ?? state.errors?.pdf} />
      <FileField
        id="pdf-file"
        name="pdf"
        label={t('pdfImport.file')}
        accept=".pdf,application/pdf"
      />
      <p className="hint">{t('pdfImport.scanNote')}</p>
      <Submit label={t('pdfImport.submit')} />
    </form>
  );
}

/** Shares the assignment to a Classroom course (by default) or a Teams class. */
export function ShareToClassroomForm(
  props: AssignmentProps & {
    readonly courses: readonly Option[];
    readonly destination?: DestinationName;
  },
) {
  const t = createTranslator(props.locale);
  const to: Destination = destinations[props.destination ?? 'classroom'];
  const [state, action] = useActionState(to.share, initial);
  return (
    <form action={action} className="stack" aria-label={t(to.keys.share)}>
      <Hidden values={hidden(props)} />
      <FormAlert message={allErrors(state)} />
      {state.url === undefined ? null : (
        <p role="status" className="notice">
          {t(to.keys.shared)} <a href={state.url}>{t(to.keys.openLink)}</a>
        </p>
      )}
      <Select
        id={`${to.idPrefix}share-course`}
        name={to.field}
        label={t(to.keys.target)}
        options={props.courses}
      />
      <p className="hint">{t(to.keys.shareNote)}</p>
      <Submit label={t(to.keys.share)} />
    </form>
  );
}

/** Imports a Classroom course's (by default) or a Teams class's students into a class. */
export function ImportRosterForm(props: {
  readonly locale: Locale;
  readonly classId: string;
  readonly courses: readonly Option[];
  readonly destination?: RosterSourceName;
}) {
  const t = createTranslator(props.locale);
  const to: RosterSource = rosterSources[props.destination ?? 'classroom'];
  const [state, action] = useActionState(to.importRoster, initial);
  return (
    <form action={action} className="stack" aria-label={t(to.keys.importRoster)}>
      <Hidden values={{ locale: props.locale, classId: props.classId }} />
      <FormAlert message={allErrors(state)} />
      {state.message === undefined ? null : (
        <p role="status" className="notice">
          {state.message}
        </p>
      )}
      <Select
        id={`${to.idPrefix}roster-course`}
        name={to.field}
        label={t(to.keys.target)}
        options={props.courses}
      />
      <Submit label={t(to.keys.importRoster)} />
    </form>
  );
}

export function GradeWithAiForm(props: AssignmentProps) {
  const t = createTranslator(props.locale);
  const [state, action] = useActionState(requestAiGradingAction, initial);
  return (
    <form action={action} className="stack" aria-label={t('grading.gradeWithAi')}>
      <Hidden values={hidden(props)} />
      <FormAlert message={allErrors(state)} />
      {state.message === undefined ? null : (
        <p role="status" className="notice">
          {state.message}
        </p>
      )}
      <Submit label={t('grading.gradeWithAi')} />
    </form>
  );
}

/** The teacher's decision on one submission: confirm the draft or grade by hand. */
export function ReviewForm(
  props: AssignmentProps & {
    readonly submissionId: string;
    readonly studentName: string;
    readonly score: number | null;
    readonly maxPoints: number;
    readonly hasDraft: boolean;
  },
) {
  const t = createTranslator(props.locale);
  const [state, action] = useActionState(gradeSubmissionAction, initial);
  const id = (field: string) => `${props.submissionId}-${field}`;
  return (
    <form
      action={action}
      className="stack"
      aria-label={`${t('grading.score')} ${props.studentName}`}
    >
      <Hidden values={{ ...hidden(props), submissionId: props.submissionId }} />
      <FormAlert message={allErrors(state)} />
      <div className="field-row">
        <div className="field">
          <label
            htmlFor={id('score')}
          >{`${t('grading.score')} (/${String(props.maxPoints)})`}</label>
          <input
            id={id('score')}
            name="score"
            type="number"
            min={0}
            max={props.maxPoints}
            step="0.5"
            defaultValue={props.score ?? ''}
          />
        </div>
        <div className="field">
          <label htmlFor={id('comment')}>{t('grading.comment')}</label>
          <input id={id('comment')} name="comment" />
        </div>
      </div>
      <div className="button-row">
        {props.hasDraft ? (
          <button type="submit" name="intent" value="confirm" className="button">
            {t('grading.confirm')}
          </button>
        ) : null}
        <button
          type="submit"
          name="intent"
          value="manual"
          className={props.hasDraft ? 'button secondary' : 'button'}
        >
          {t('grading.gradeByHand')}
        </button>
      </div>
    </form>
  );
}

export function CopyLink({ locale, url }: { readonly locale: Locale; readonly url: string }) {
  const t = createTranslator(locale);
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="button secondary no-print"
      onClick={() => {
        void navigator.clipboard.writeText(url).then(() => {
          setCopied(true);
        });
      }}
    >
      {copied ? t('studentLinks.copied') : t('studentLinks.copy')}
    </button>
  );
}

/** Makes links (for everyone without one, or a new one for a student) and shows them once. */
export function IssueLinksForm(props: {
  readonly locale: Locale;
  readonly classId: string;
  readonly studentId?: string;
  readonly label: string;
  readonly secondary?: boolean;
}) {
  const t = createTranslator(props.locale);
  const [state, action] = useActionState(issueLinksAction, initial);
  const links = state.links;
  return (
    <div className="stack">
      <form action={action} aria-label={props.label}>
        <Hidden
          values={{
            locale: props.locale,
            classId: props.classId,
            studentId: props.studentId ?? '',
          }}
        />
        <FormAlert message={allErrors(state)} />
        <button type="submit" className={props.secondary === true ? 'button secondary' : 'button'}>
          {props.label}
        </button>
      </form>
      {links === undefined ? null : links.length === 0 ? (
        <p role="status" className="notice">
          {t('studentLinks.none')}
        </p>
      ) : (
        <section className="card stack issued-links" aria-label={t('studentLinks.issuedTitle')}>
          <h2>{t('studentLinks.issuedTitle')}</h2>
          <p className="notice no-print">{t('studentLinks.issuedNote')}</p>
          <table className="print-days">
            <thead>
              <tr>
                <th scope="col">{t('studentLinks.student')}</th>
                <th scope="col">{t('studentLinks.link')}</th>
              </tr>
            </thead>
            <tbody>
              {links.map((link) => (
                <tr key={link.url}>
                  <td>{link.name}</td>
                  <td>
                    <a href={link.url} data-testid="student-link">
                      {link.url}
                    </a>{' '}
                    <CopyLink locale={props.locale} url={link.url} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="no-print">
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                window.print();
              }}
            >
              {t('studentLinks.print')}
            </button>
          </p>
        </section>
      )}
    </div>
  );
}

export function FormsQuizForm(props: AssignmentProps & { readonly made: boolean }) {
  const t = createTranslator(props.locale);
  const [state, action] = useActionState(makeFormsQuizAction, initial);
  return (
    <form action={action} className="stack" aria-label={t('forms.make')}>
      <Hidden values={hidden(props)} />
      <FormAlert message={allErrors(state)} />
      {state.reconnect === true ? (
        <p>
          <a className="button secondary" href={`/api/classroom/connect?locale=${props.locale}`}>
            {t('google.connect')}
          </a>
        </p>
      ) : null}
      {state.url === undefined ? null : (
        <p role="status" className="notice">
          {t('forms.made')} <a href={state.url}>{t('forms.edit')}</a>
        </p>
      )}
      <Submit label={props.made ? t('forms.remake') : t('forms.make')} />
    </form>
  );
}

/**
 * The teacher's own Word document, posted to a Classroom course as a Google Doc (by default) or
 * to a Teams class: either way, each student gets their own copy.
 */
export function PostWordForm(props: {
  readonly locale: Locale;
  readonly courses: readonly Option[];
  readonly destination?: DestinationName;
}) {
  const t = createTranslator(props.locale);
  const to: Destination = destinations[props.destination ?? 'classroom'];
  const [state, action] = useActionState(to.postWord, initial);
  const errors = state.errors ?? {};
  const id = (name: string) => `${to.idPrefix}word-post-${name}`;
  return (
    <form action={action} className="stack" aria-label={t(to.keys.wordSubmit)} key={state.version}>
      <Hidden values={{ locale: props.locale }} />
      <FormAlert message={errors.form} />
      {state.url === undefined ? null : (
        <p role="status" className="notice">
          {state.scheduledFor === undefined
            ? t(to.keys.wordPosted)
            : t('schedule.scheduledFor', { when: state.scheduledFor })}{' '}
          <a href={state.url}>{t(to.keys.wordOpen)}</a>
          {state.docUrl === undefined ? null : (
            <>
              {' · '}
              <a href={state.docUrl}>{t('wordPost.openDoc')}</a>
            </>
          )}
        </p>
      )}
      <Select
        id={id('course')}
        name={to.field}
        label={t(to.keys.target)}
        options={props.courses}
        error={errors[to.field]}
      />
      <Field
        id={id('title')}
        name="title"
        label={t('wordPost.name')}
        error={errors.title}
        required
      />
      <TextArea
        id={id('instructions')}
        name="instructions"
        label={t('wordPost.instructions')}
        error={errors.instructions}
      />
      <Field
        id={id('due')}
        name="dueDate"
        type="date"
        label={t('wordPost.dueDate')}
        error={errors.dueDate}
      />
      <ScheduleFields
        locale={props.locale}
        idPrefix={`${to.idPrefix}word-post`}
        error={errors.scheduledAt}
      />
      <FileField
        id={id('file')}
        name="file"
        label={t('wordPost.file')}
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        error={errors.file}
      />
      <p className="hint">{t(to.keys.wordNote)}</p>
      <Submit label={t(to.keys.wordSubmit)} />
    </form>
  );
}
