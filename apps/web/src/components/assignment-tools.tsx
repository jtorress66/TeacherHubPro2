'use client';

import { useActionState, useState, type ReactNode } from 'react';
import { createTranslator, type Locale } from '@thp/i18n';
import {
  gradeSubmissionAction,
  importRosterAction,
  issueLinksAction,
  makeFormsQuizAction,
  postQuizToClassroomAction,
  requestAiGradingAction,
  requestPdfImportAction,
  shareAssignmentAction,
  startPdfTestAction,
  uploadAttachmentAction,
  type AssignmentFormState,
} from '../app/_lib/assignment-actions.ts';
import { Field, FormAlert, Submit } from './forms.tsx';
import { Hidden, Select, type Option } from './form-fields.tsx';

const initial: AssignmentFormState = {};

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

export function ShareToClassroomForm(
  props: AssignmentProps & { readonly courses: readonly Option[] },
) {
  const t = createTranslator(props.locale);
  const [state, action] = useActionState(shareAssignmentAction, initial);
  return (
    <form action={action} className="stack" aria-label={t('classroom.share')}>
      <Hidden values={hidden(props)} />
      <FormAlert message={allErrors(state)} />
      {state.url === undefined ? null : (
        <p role="status" className="notice">
          {t('classroom.shared')} <a href={state.url}>{t('classroom.sharedLink')}</a>
        </p>
      )}
      <Select
        id="share-course"
        name="courseId"
        label={t('classroom.course')}
        options={props.courses}
      />
      <p className="hint">{t('classroom.shareNote')}</p>
      <Submit label={t('classroom.share')} />
    </form>
  );
}

export function ImportRosterForm(props: {
  readonly locale: Locale;
  readonly classId: string;
  readonly courses: readonly Option[];
}) {
  const t = createTranslator(props.locale);
  const [state, action] = useActionState(importRosterAction, initial);
  return (
    <form action={action} className="stack" aria-label={t('classroom.importRoster')}>
      <Hidden values={{ locale: props.locale, classId: props.classId }} />
      <FormAlert message={allErrors(state)} />
      {state.message === undefined ? null : (
        <p role="status" className="notice">
          {state.message}
        </p>
      )}
      <Select
        id="roster-course"
        name="courseId"
        label={t('classroom.course')}
        options={props.courses}
      />
      <Submit label={t('classroom.importRoster')} />
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

/**
 * The AI assistant's card: a test PDF read into questions. With a class it becomes an assignment
 * graded here; with none, the questions go to a Google Forms quiz.
 */
export function PdfTestForm(props: {
  readonly locale: Locale;
  /** One option per class and grade category, as `classId|categoryId`. */
  readonly targets: readonly Option[];
  /** Shown when there is no class to pick, e.g. a link to create one. */
  readonly noClasses?: ReactNode;
}) {
  const t = createTranslator(props.locale);
  const [state, action] = useActionState(startPdfTestAction, initial);
  const [target, setTarget] = useState('');
  const errors = state.errors ?? {};
  return (
    <form action={action} className="stack" aria-label={t('pdfTest.title')}>
      <Hidden values={{ locale: props.locale }} />
      <FormAlert message={errors.form ?? errors.categoryId} />
      <Field
        id="pdf-test-title"
        name="title"
        label={t('pdfTest.name')}
        error={errors.title}
        required
      />
      <FileField
        id="pdf-test-file"
        name="pdf"
        label={t('pdfTest.file')}
        accept=".pdf,application/pdf"
        error={errors.pdf}
      />
      <p className="hint">{t('pdfImport.scanNote')}</p>
      <div className="field">
        <label htmlFor="pdf-test-target">{t('pdfTest.target')}</label>
        <select
          id="pdf-test-target"
          name="target"
          value={target}
          aria-describedby="pdf-test-target-hint"
          onChange={(event) => {
            setTarget(event.target.value);
          }}
        >
          <option value="">{t('pdfTest.noClass')}</option>
          {props.targets.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
        <p id="pdf-test-target-hint" className="hint">
          {t('pdfTest.targetHint')}
        </p>
        {props.targets.length === 0 ? props.noClasses : null}
      </div>
      {target === '' ? null : (
        <>
          <Field
            id="pdf-test-points"
            name="points"
            type="number"
            min={1}
            label={t('pdfTest.points')}
            defaultValue={100}
            error={errors.points}
          />
          <Field
            id="pdf-test-due"
            name="dueDate"
            type="date"
            label={t('pdfTest.dueDate')}
            error={errors.dueDate}
          />
        </>
      )}
      <Submit label={t('pdfTest.submit')} />
    </form>
  );
}

/** Posts one of the teacher's Google Forms quizzes to a Classroom course. */
export function PostQuizForm(props: {
  readonly locale: Locale;
  readonly quizId: string;
  readonly courses: readonly Option[];
}) {
  const t = createTranslator(props.locale);
  const [state, action] = useActionState(postQuizToClassroomAction, initial);
  const errors = state.errors ?? {};
  return (
    <form action={action} className="stack" aria-label={t('googleQuiz.post')}>
      <Hidden values={{ locale: props.locale, quizId: props.quizId }} />
      <FormAlert message={errors.form} />
      {state.url === undefined ? null : (
        <p role="status" className="notice">
          {t('googleQuiz.posted')} <a href={state.url}>{t('googleQuiz.postedLink')}</a>
        </p>
      )}
      <Select
        id="post-course"
        name="courseId"
        label={t('classroom.course')}
        options={props.courses}
      />
      <Field
        id="post-due"
        name="dueDate"
        type="date"
        label={t('googleQuiz.dueDate')}
        error={errors.dueDate}
      />
      <p className="hint">{t('googleQuiz.postNote')}</p>
      <Submit label={t('googleQuiz.post')} />
    </form>
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
            {t('pdfTest.connect')}
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
