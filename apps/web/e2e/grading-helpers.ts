import { expect, type Browser, type Page } from '@playwright/test';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { createTranslator, type Locale } from '@thp/i18n';
import { classWithStudents } from './helpers.ts';

/** A small typed test, as a teacher's PDF would be. */
export async function quizPdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([500, 300]);
  page.drawText('Space Quiz', { x: 30, y: 260, size: 16, font });
  page.drawText('1. Which planet is closest to the Sun?', { x: 30, y: 230, size: 12, font });
  page.drawText('2. True or false: the Sun is a star.', { x: 30, y: 210, size: 12, font });
  return Buffer.from(await doc.save());
}

/** A class with three students, the standard categories and one assignment; returns its page. */
export async function classWithAssignment(
  page: Page,
  locale: Locale,
  title: string,
): Promise<string> {
  const t = createTranslator(locale);
  const classPath = await classWithStudents(page, locale);
  await page.goto(`${classPath}/gradebook`);
  await page.getByRole('button', { name: t('gradebook.useStandard') }).click();
  const form = page.getByRole('form', { name: t('gradebook.newAssignment') });
  await form.getByLabel(t('gradebook.assignmentTitle')).fill(title);
  await form
    .getByLabel(t('gradebook.category'), { exact: true })
    .selectOption({ label: t('gradebook.standard_test') });
  await form.getByRole('button', { name: t('gradebook.createAssignment') }).click();
  await page.getByRole('link', { name: t('gradebook.openCreated', { title }) }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(title);
  // Step 1 says students cannot see it until it has questions.
  await expect(page.getByRole('list', { name: t('questions.stepsTitle') })).toContainText(
    t('questions.stepNotVisible'),
  );
  return classPath;
}

/** Imports the PDF (the worker's stand-in reads it into three questions) and saves them. */
export async function importQuestions(page: Page, locale: Locale): Promise<void> {
  const t = createTranslator(locale);
  await page.getByRole('link', { name: t('questions.open') }).click();
  const importForm = page.getByRole('form', { name: t('pdfImport.title') });
  await importForm
    .getByLabel(t('pdfImport.file'))
    .setInputFiles({ name: 'quiz.pdf', mimeType: 'application/pdf', buffer: await quizPdf() });
  await importForm.getByRole('button', { name: t('pdfImport.submit') }).click();
  await expect(page.getByRole('note')).toHaveText(t('questions.imported'), { timeout: 30_000 });
  const builder = page.getByRole('form', { name: t('questions.title') });
  await expect(builder.getByRole('listitem')).toHaveCount(3);
  await builder.getByRole('button', { name: t('questions.save') }).click();
  await expect(page).toHaveURL(/\/questions\?saved=1$/);
  await expect(
    page.getByRole('form', { name: t('questions.title') }).getByRole('listitem'),
  ).toHaveCount(3);
}

/** Stands in for the browser's voice, keeping what it was asked to say in `window.spoken`. */
async function recordSpeech(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const spoken: { text: string; lang: string }[] = [];
    const define = (name: string, value: unknown) => {
      Object.defineProperty(window, name, { value, configurable: true });
    };
    define('spoken', spoken);
    define(
      'SpeechSynthesisUtterance',
      class {
        lang = '';
        onend: (() => void) | null = null;
        constructor(readonly text: string) {}
      },
    );
    define('speechSynthesis', {
      speak: (utterance: { text: string; lang: string }) => {
        spoken.push({ text: utterance.text, lang: utterance.lang });
      },
      cancel: () => undefined,
    });
  });
}

/** The student opens their link in their own browser, listens to a question, answers and hands in. */
export async function studentAnswers(
  browser: Browser,
  locale: Locale,
  url: string,
  title: string,
  firstName = 'Ana',
) {
  const t = createTranslator(locale);
  const student = await browser.newPage();
  await recordSpeech(student);
  await student.goto(url);
  await expect(student.getByRole('heading', { level: 1 })).toHaveText(
    t('student.hello', { name: firstName }),
  );
  await student.getByRole('link', { name: title }).click();

  // Read-aloud: the first question and its choices, in the page's language.
  const question1 = t('student.listenQuestion', { number: 1 });
  const listen = student.getByRole('button', { name: `${t('learning.listen')} ${question1}` });
  const stop = student.getByRole('button', { name: `${t('learning.stop')} ${question1}` });
  await listen.click();
  await expect(stop).toHaveAttribute('aria-pressed', 'true');
  const spoken = await student.evaluate(
    () => (window as unknown as { spoken: { text: string; lang: string }[] }).spoken,
  );
  expect(spoken).toHaveLength(1);
  expect(spoken[0]?.text).toContain('Mercury.');
  expect(spoken[0]?.lang).toBe(locale);
  await stop.click();
  await expect(listen).toHaveAttribute('aria-pressed', 'false');

  await student.getByRole('radio', { name: 'Mercury' }).check();
  await student.getByRole('radio', { name: t('questions.true') }).check();
  await student.getByLabel('Why do we have day and night?').fill('Because the Earth turns around.');
  await student.getByRole('button', { name: t('student.submit') }).click();
  await expect(student.getByRole('status')).toContainText(
    t('student.submitted', { date: '' }).split(' ')[0] ?? '',
  );
  return student;
}
