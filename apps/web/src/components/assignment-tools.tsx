'use client';

import { useActionState, useState } from 'react';
import { createTranslator, type Locale } from '@thp/i18n';
import {
  gradeSubmissionAction,
  importRosterAction,
  issueLinksAction,
  requestAiGradingAction,
  requestPdfImportAction,
  shareAssignmentAction,
  uploadAttachmentAction,
  type AssignmentFormState,
} from '../app/_lib/assignment-actions.ts';
import { FormAlert, Submit } from './forms.tsx';
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

function CopyLink({ locale, url }: { readonly locale: Locale; readonly url: string }) {
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
