import { randomUUID } from 'node:crypto';
import { expect, test, type Browser, type Locator, type Page } from '@playwright/test';
import { createTranslator, locales, type Locale, type Translate } from '@thp/i18n';
import { tourChapters, tourSteps, type TourStepId } from '../../src/server/demo-tour.ts';
import { makeSchoolAdmin } from '../database.ts';
import { quizPdf } from '../grading-helpers.ts';
import { confirmEmail, password } from '../helpers.ts';
import { drawCards } from './tour-cards.ts';
import { scrollTo, shot, windowFor, writeManifest, type FrameEntry } from './tour-kit.ts';
import { tourWords, type TourWords } from './tour-words.ts';

// Retakes every screenshot of the /demo tour: `pnpm tour:capture` (all languages) or
// `TOUR_LOCALES=en pnpm tour:capture`. One teacher per language walks through the app with the
// sample class and a few made-up students; nothing here is a real person.

const chosen = (process.env.TOUR_LOCALES ?? '').split(/[\s,]+/u).filter(Boolean);
const tourLocales = locales.filter((l) => chosen.length === 0 || chosen.includes(l));

/** Made-up students for the imported class, with the optional columns filled in. */
const rosterOf = (words: TourWords) =>
  [
    'First name,Last name,Parent email,Accommodations',
    `Lucía,Ortiz,lucia.family@example.com,${words.needs[0]}`,
    'Mateo,Rivera,rivera.family@example.com,',
    `Emma,Chen,chen.family@example.com,${words.needs[1]}`,
    'Noah,Williams,williams.family@example.com,',
    'Valentina,Cruz,cruz.family@example.com,',
    `Liam,Santos,santos.family@example.com,${words.needs[2]}`,
    'Camila,Torres,torres.family@example.com,',
    'Ethan,Morales,morales.family@example.com,',
  ].join('\n');

/** How long an AI job may take: real Claude drafting a whole week takes minutes. */
const worker = { timeout: process.env.TOUR_AI === 'claude' ? 6 * 60_000 : 90_000 };

interface Tour {
  readonly locale: Locale;
  readonly t: Translate;
  readonly words: TourWords;
  readonly page: Page;
  readonly browser: Browser;
  readonly taken: Map<TourStepId, FrameEntry>;
  /** The sample class's page. */
  sampleClass: string;
  /** The imported class's page. */
  importedClass: string;
  /** Student links by first name; a link is shown only once, when it is made. */
  readonly links: Map<string, string>;
}

/** Screenshots a step; `focus` is what the video highlights and zooms toward. */
const take = async (
  tour: Tour,
  step: TourStepId,
  { page = tour.page, focus }: { readonly page?: Page; readonly focus?: Locator } = {},
) => {
  const device = tourSteps.find((s) => s.id === step)?.device ?? 'desktop';
  tour.taken.set(step, await shot(page, tour.locale, step, device, focus));
};

for (const locale of tourLocales) {
  test(`tour screenshots (${locale})`, async ({ browser }) => {
    test.setTimeout(30 * 60_000);
    const context = await windowFor(browser, locale, 'desktop');
    const tour: Tour = {
      locale,
      t: createTranslator(locale),
      words: tourWords[locale],
      page: await context.newPage(),
      browser,
      taken: new Map(),
      sampleClass: '',
      importedClass: '',
      links: new Map(),
    };

    await test.step('getting started', () => gettingStarted(tour));
    await test.step('classes', () => classes(tour));
    await test.step('planning', () => planning(tour));
    await test.step('assistant', () => assistant(tour));
    await test.step('presentations', () => presentations(tour));
    await test.step('prep', () => prep(tour));
    await test.step('assignments', () => assignments(tour));
    await test.step('gradebook', () => gradebook(tour));
    await test.step('games', () => games(tour));
    await test.step('live', () => live(tour));
    await test.step('learning', () => learning(tour));
    await test.step('families', () => families(tour));
    await test.step('substitutes', () => substitutes(tour));
    await test.step('connections', () => connections(tour));
    await test.step('schools', () => schools(tour));

    expect(tourSteps.map((s) => s.id).filter((id) => !tour.taken.has(id))).toEqual([]);
    writeManifest(locale, {
      locale,
      chapters: tourChapters,
      steps: tourSteps.map((s) => ({ ...tour.taken.get(s.id), chapter: s.chapter })),
    });
    await drawCards(tour.page, locale);
    await context.close();
  });
}

async function gettingStarted(tour: Tour) {
  const { page, t, locale } = tour;
  const email = `maria.rivera+${randomUUID().slice(0, 8)}@school.edu`;
  await page.goto(`/${locale}/signup`);
  await page.getByLabel(t('auth.name'), { exact: true }).fill('María Rivera');
  // The screenshot shows a tidy made-up address; the account uses a unique one.
  await page.getByLabel(t('auth.email'), { exact: true }).fill('maria.rivera@riverside.edu');
  await page.getByLabel(t('auth.password'), { exact: true }).fill(password);
  await page.getByLabel(t('auth.adultConfirm')).check();
  await take(tour, 'signup');
  await page.getByLabel(t('auth.email'), { exact: true }).fill(email);
  await page.getByRole('button', { name: t('auth.createAccount') }).click();
  await expect(page).toHaveURL(new RegExp(`/${locale}/app$`));
  await confirmEmail(page, locale, email);
  await makeSchoolAdmin(email);

  await page.goto(`/${locale}/app/settings`);
  const school = page.getByRole('region', { name: t('settings.school') });
  await school.getByLabel(t('settings.schoolName')).fill(tour.words.schoolName);
  await school.getByRole('button', { name: t('settings.save') }).click();
  await expect(page.getByText(tour.words.schoolName).first()).toBeVisible();

  await page.goto(`/${locale}/app`);
  await page.getByRole('button', { name: t('sample.add') }).click();
  await expect(page.getByTestId('sample-notice')).toBeVisible();
  tour.sampleClass = new URL(page.url()).pathname;
  await take(tour, 'sampleClass');

  await page.goto(`/${locale}/app`);
  await expect(page.getByRole('list', { name: t('commandCenter.atRisk') })).toBeVisible();
  await take(tour, 'commandCenter', {
    focus: page.getByRole('list', { name: t('commandCenter.atRisk') }),
  });
}

async function classes(tour: Tour) {
  const { page, t, locale } = tour;
  await page.goto(`/${locale}/app/classes`);
  const form = page.getByRole('form', { name: t('classes.newClass') });
  await form.getByLabel(t('classes.name')).fill(tour.words.className);
  await form.getByRole('button', { name: t('classes.create') }).click();
  const importForm = page.getByRole('form', { name: t('students.importTitle') });
  await importForm.getByLabel(t('students.file')).setInputFiles({
    name: 'roster.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(`${rosterOf(tour.words)}\n`, 'utf8'),
  });
  await importForm.getByRole('button', { name: t('students.import') }).click();
  await expect(page.getByRole('status')).toHaveText(t('students.imported', { count: 8 }));
  tour.importedClass = new URL(page.url()).pathname;
  await take(tour, 'rosterImport');

  await page.getByRole('link', { name: `${t('students.edit')} Lucía Ortiz` }).click();
  await expect(page.getByLabel(t('students.accommodations'))).toBeVisible();
  await take(tour, 'accommodations');

  await page.goto(`${tour.importedClass}/gradebook`);
  await page.getByRole('button', { name: t('gradebook.useStandard') }).click();

  await page.goto(`${tour.sampleClass}/attendance`);
  const alex = page.getByRole('group', {
    name: t('attendance.statusFor', { name: `${t('sample.student1')} R.` }),
  });
  await alex.getByLabel(t('attendance.status_present')).check();
  const leo = page.getByRole('group', {
    name: t('attendance.statusFor', { name: `${t('sample.student3')} K.` }),
  });
  await leo.getByLabel(t('attendance.status_tardy')).check();
  await page
    .getByLabel(t('attendance.minutesLateFor', { name: `${t('sample.student3')} K.` }))
    .fill('5');
  await take(tour, 'attendance');
  await page.getByRole('button', { name: t('attendance.submit'), exact: true }).click();
  await expect(page.getByTestId('day-status')).toHaveText(t('attendance.dayStatus_submitted'));

  await page.goto(`${tour.sampleClass}/attendance/report`);
  await take(tour, 'attendanceReport');
}

async function planning(tour: Tour) {
  const { page, t, locale } = tour;
  await page.goto(`/${locale}/app/plans/new?kind=weekly`);
  await page
    .getByLabel(t('planner.class'), { exact: true })
    .selectOption({ label: t('sample.className') });
  await page.getByLabel(t('planner.unit')).fill(t('sample.planUnit'));
  await page.getByLabel(t('planner.prSubject')).selectOption({ label: t('standards.pr_math') });
  await page.getByLabel(t('planner.prGrade')).selectOption('3');
  await page
    .getByRole('button', { name: `${t('planner.prChoose')}: ${t('planner.domain_other')}` })
    .first()
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await take(tour, 'planner', { focus: page.getByRole('dialog') });
  await page.keyboard.press('Escape');

  await page.goto(`/${locale}/app/plans`);
  await page
    .getByRole('link', { name: t('sample.planUnit') })
    .first()
    .click();
  await page.getByRole('link', { name: t('planner.print') }).click();
  await take(tour, 'planPrint');

  await page.goto(`/${locale}/app/curriculum`);
  const guide = page.getByRole('form', { name: t('curriculum.addHeading') });
  await guide.getByLabel(t('curriculum.col_subject')).selectOption('math');
  await guide.getByLabel(t('curriculum.col_grade')).selectOption('3');
  await guide.getByLabel(t('curriculum.guideTitle')).fill(tour.words.guideTitle);
  await guide.getByLabel(t('curriculum.text')).fill(tour.words.guideText);
  await guide.getByRole('button', { name: t('curriculum.upload') }).click();
  await expect(page.getByTestId('curriculum-row').first()).toContainText(
    t('curriculum.status_ready'),
    worker,
  );
  await take(tour, 'curriculum');

  await page.goto(`/${locale}/app/templates`);
  await take(tour, 'templates');
}

async function assistant(tour: Tour) {
  const { page, t, locale } = tour;
  await page.goto(`/${locale}/app/assistant`);
  const form = page.getByRole('form', { name: t('assistant.title') });
  await form.getByLabel(t('assistant.type')).selectOption('worksheet');
  await form.getByLabel(t('assistant.topic')).fill(t('sample.day3Theme'));
  await form.getByLabel(t('esl.label')).check();
  await take(tour, 'assistantForm', { focus: form.getByLabel(t('esl.label')) });
  await form.getByRole('button', { name: t('assistant.submit') }).click();
  await expect(page).toHaveURL(/\/assistant\/[^/]+$/u, worker);
  await expect(page).not.toHaveURL(/\/jobs\//u);
  await take(tour, 'assistantResult');

  await page.goto(`/${locale}/app/rubrics`);
  const draft = page.getByRole('form', { name: t('rubrics.aiDraft') });
  await draft.getByLabel(t('rubrics.topic')).fill(t('sample.explainPrompt'));
  await draft.getByRole('button', { name: t('rubrics.generate') }).click();
  await page.getByRole('button', { name: t('rubrics.keep') }).click(worker);
  await expect(page.getByRole('form', { name: t('rubrics.editor') })).toBeVisible();
  await take(tour, 'rubric');
}

async function presentations(tour: Tour) {
  const { page, t, locale } = tour;
  await connectTools(tour);
  await page.goto(`/${locale}/app/presentations`);
  await page.getByRole('link', { name: t('presentations.generate') }).click();
  const form = page.getByRole('form', { name: t('presentations.generate') });
  await form.getByLabel(t('assistant.topic'), { exact: true }).fill(t('sample.planUnit'));
  await form.getByLabel(t('presentations.slideCount')).fill('6');
  await form.getByRole('button', { name: t('presentations.draftSubmit') }).click();
  await page.getByRole('button', { name: t('presentations.keep') }).click(worker);
  await expect(page).toHaveURL(/\/presentations\/[^/]+$/u);
  await take(tour, 'presentation');
  await scrollTo(page, `section:has(h2:text-is("${t('presentations.classroomTitle')}"))`);
  await take(tour, 'presentationExport');
}

/** Connects the local stand-ins for Google Classroom, Canva and Microsoft. */
async function connectTools(tour: Tour) {
  const { page, t, locale } = tour;
  await page.goto(`/${locale}/app/integrations`);
  await page.getByRole('link', { name: t('classroom.connect') }).click();
  await expect(page.getByRole('status')).toHaveText(t('classroom.connectedNotice'));
  await page
    .getByRole('region', { name: t('canva.title'), exact: true })
    .getByRole('link', { name: t('canva.connect') })
    .click();
  await expect(page.getByRole('status')).toHaveText(t('canva.connectedNotice'));
  await page
    .getByRole('region', { name: t('microsoft.title') })
    .getByRole('link', { name: t('microsoft.connect') })
    .click();
  await expect(page.getByRole('status')).toHaveText(t('microsoft.connectedNotice'));
}

async function prep(tour: Tour) {
  const { page, t, locale } = tour;
  await page.goto(`/${locale}/app/prep`);
  const form = page.getByRole('form', { name: t('prep.newTitle') });
  await form
    .getByLabel(t('prep.class'), { exact: true })
    .selectOption({ label: tour.words.className });
  await form.getByLabel(t('prep.prompt')).fill(tour.words.prepSentence);
  await form.getByLabel(t('prep.subject'), { exact: true }).selectOption('science');
  await form.getByLabel(t('prep.grade'), { exact: true }).selectOption('4');
  await form
    .getByLabel(t('prep.quizCategory'))
    .selectOption({ label: t('gradebook.standard_quiz') });
  await take(tour, 'prepStart', { focus: form.getByLabel(t('prep.prompt')) });
  await form.getByRole('button', { name: t('prep.start') }).click();
  await expect(page.getByTestId('prep-status')).toHaveText(t('prep.status_ready'), worker);
  await take(tour, 'prepReview');
}

async function assignments(tour: Tour) {
  const { page, t, browser, locale } = tour;
  await page.goto(`${tour.importedClass}/gradebook`);
  const title = tour.words.quizTitle;
  const form = page.getByRole('form', { name: t('gradebook.newAssignment') });
  await form.getByLabel(t('gradebook.assignmentTitle')).fill(title);
  await form
    .getByLabel(t('gradebook.category'), { exact: true })
    .selectOption({ label: t('gradebook.standard_test') });
  await form.getByRole('button', { name: t('gradebook.createAssignment') }).click();
  await page.getByRole('link', { name: t('gradebook.openCreated', { title }) }).click();
  await page.getByRole('link', { name: t('questions.open') }).click();
  const importForm = page.getByRole('form', { name: t('pdfImport.title') });
  await importForm.getByLabel(t('pdfImport.file')).setInputFiles({
    name: 'space-quiz.pdf',
    mimeType: 'application/pdf',
    buffer: await quizPdf(),
  });
  await importForm.getByRole('button', { name: t('pdfImport.submit') }).click();
  await expect(page.getByRole('note')).toHaveText(t('questions.imported'), worker);
  await take(tour, 'pdfImport');

  await page.goto(`${tour.sampleClass}/student-links`);
  await page.getByRole('button', { name: t('studentLinks.issue') }).click();
  const issued = page.getByRole('region', { name: t('studentLinks.issuedTitle') });
  await expect(issued).toBeVisible();
  await take(tour, 'studentLinks', { focus: issued });
  for (const name of [
    `${t('sample.student2')} T.`,
    `${t('sample.student5')} D.`,
    `${t('sample.student3')} K.`,
  ]) {
    const link = issued.getByRole('row').filter({ hasText: name }).getByTestId('student-link');
    tour.links.set(name, (await link.getAttribute('href')) ?? '');
  }
  const mayaUrl = tour.links.get(`${t('sample.student2')} T.`) ?? '';

  const phone = await windowFor(browser, locale, 'phone');
  const student = await phone.newPage();
  await student.goto(mayaUrl);
  await student.getByRole('link', { name: t('sample.onlineQuiz') }).click();
  await student.getByRole('radio', { name: '1/4', exact: true }).check();
  await take(tour, 'studentAnswer', { page: student });
  await phone.close();

  await page.goto(`/${locale}/app`);
  await page
    .getByRole('region', { name: t('commandCenter.toGrade') })
    .getByRole('link', { name: t('sample.onlineQuiz') })
    .click();
  await page.getByRole('link', { name: t('questions.submissions') }).click();
  await expect(page.getByTestId('submission-R.')).toContainText(t('grading.status_ai_graded'));
  await scrollTo(page, '[data-testid="submission-R."]');
  await take(tour, 'aiGrading', { focus: page.getByTestId('submission-R.') });
  await page
    .getByTestId('submission-R.')
    .getByRole('button', { name: t('grading.confirm') })
    .click();
  await expect(page.getByTestId('submission-R.')).toContainText(
    t('grading.confirmed', { score: 9, max: 10 }),
  );
}

async function gradebook(tour: Tour) {
  const { page } = tour;
  await page.goto(`${tour.sampleClass}/gradebook`);
  await take(tour, 'gradebook');
  await page.goto(`${tour.sampleClass}/report-cards`);
  await take(tour, 'reportCards');
}

async function games(tour: Tour) {
  const { page, t, browser, locale } = tour;
  await page.goto(`/${locale}/app/games`);
  await page
    .getByRole('link', { name: t('sample.gameTitle') })
    .first()
    .click();
  await take(tour, 'gameBuilder');

  const ask = page.getByRole('region', { name: t('games.explainTitle') });
  await ask.getByRole('button', { name: t('games.explainButton') }).click();
  await expect(page.getByText(t('games.explainReview'))).toBeVisible(worker);
  // Show the first card's AI-written explanation, not just the top of the form.
  await page
    .getByLabel(t('games.builderExplanation'))
    .first()
    .evaluate((field) => {
      field.closest('fieldset')?.scrollIntoView({ block: 'start' });
    });
  await take(tour, 'aiExplanations', {
    focus: page.getByLabel(t('games.builderExplanation')).first(),
  });
  await page
    .getByRole('form', { name: t('games.save') })
    .getByRole('button', { name: t('games.save') })
    .click();
  await expect(page.getByText(t('games.saved'))).toBeVisible();

  // A student plays the game from their link and misses one question.
  const samUrl = tour.links.get(`${t('sample.student5')} D.`) ?? '';
  const phone = await windowFor(browser, locale, 'phone');
  const student = await phone.newPage();
  await student.goto(samUrl);
  await student.getByRole('link', { name: t('sample.gameTitle') }).click();
  for (let n = 1; n <= 5; n += 1) {
    await expect(student.getByText(t('gamePlay.progress', { n, total: 5 }))).toBeVisible();
    await student
      .locator('.game-question .button-row button')
      .nth(n % 2)
      .click();
  }
  await expect(student.getByRole('region', { name: t('gamePlay.reviewTitle') })).toBeVisible();
  await scrollTo(student, `section:has(h2:text-is("${t('gamePlay.reviewTitle')}"))`);
  await take(tour, 'gameReview', { page: student });
  await phone.close();

  await page.goto(`${tour.sampleClass}/standards`);
  await take(tour, 'coverage');
}

async function live(tour: Tour) {
  const { page, t, browser, locale } = tour;
  await page.goto(`/${locale}/app/live`);
  const form = page.getByRole('form', { name: t('live.startTitle') });
  await form.getByLabel(t('live.kind_live')).check();
  await form.getByRole('button', { name: t('live.start') }).click();
  const pin = (await page.getByTestId('live-pin').textContent())?.trim() ?? '';

  const phones = [];
  const keys = [
    'sample.student1',
    'sample.student2',
    'sample.student3',
    'sample.student4',
  ] as const;
  for (const name of keys.map((key) => t(key))) {
    const phone = await windowFor(browser, locale, 'phone');
    const student = await phone.newPage();
    await student.goto(`/${locale}/play`);
    await student.getByLabel(t('play.pin')).fill(pin);
    await student.getByRole('button', { name: t('play.join') }).click();
    await student.getByRole('button', { name, exact: true }).click();
    phones.push({ phone, student });
  }
  await expect(page.getByRole('status')).toHaveText(t('live.players', { count: 4 }));
  await take(tour, 'liveLobby', { focus: page.getByTestId('live-pin') });

  await page.getByRole('button', { name: t('live.startGame') }).click();
  const [first, ...others] = phones;
  if (first === undefined) throw new Error('no players');
  await expect(first.student.locator('.answer-grid button').first()).toBeVisible();
  await take(tour, 'livePlayer', { page: first.student });
  // Three students pick the right answer (every sample question's is 1/2, 4 or 3/8); one doesn't.
  for (const [index, { student }] of [first, ...others].entries()) {
    const name = index < 3 ? /: (?:1\/2|4|3\/8)$/u : /: (?!(?:1\/2|4|3\/8)$)[^:]+$/u;
    await student.locator('.answer-grid').getByRole('button', { name }).first().click();
  }
  await expect(page.locator('.reveal-explanation')).toBeVisible(worker);
  await take(tour, 'liveReveal', { focus: page.locator('.reveal-explanation') });
  for (const { phone } of phones) await phone.close();
}

async function learning(tour: Tour) {
  const { page, t, browser, locale } = tour;
  await page.goto(`/${locale}/app/learning`);
  const form = page.getByRole('form', { name: t('learning.draftTitle') });
  await form
    .getByLabel(t('learning.student'))
    .selectOption({ label: `${t('sample.student3')} K.` });
  await form.getByLabel(t('learning.topic')).fill(t('sample.skill3'));
  await form.getByLabel(t('learning.lessonCount')).fill('3');
  await form.getByRole('button', { name: t('learning.draft') }).click();
  const drafts = page.getByRole('list', { name: t('learning.toReview') });
  await drafts.getByRole('link').first().click(worker);
  await take(tour, 'learningPath');
  await page.getByRole('button', { name: t('learning.assign') }).click();
  await expect(page.getByText(t('learning.status_assigned'), { exact: true })).toBeVisible();

  const leoUrl = tour.links.get(`${t('sample.student3')} K.`) ?? '';
  const phone = await windowFor(browser, locale, 'phone');
  const student = await phone.newPage();
  await student.goto(leoUrl);
  await student.locator('a[href*="/learn/"]').first().click();
  await student.locator('a[href*="/learn/"]').first().click();
  await take(tour, 'studentLesson', { page: student });
  await phone.close();

  await page.goto(`/${locale}/app`);
  await page
    .getByRole('list', { name: t('commandCenter.atRisk') })
    .getByRole('link')
    .first()
    .click();
  await page.getByRole('button', { name: t('student360.generate') }).click();
  await expect(
    page
      .getByRole('list', { name: t('student360.insight') })
      .getByRole('listitem')
      .first(),
  ).toBeVisible(worker);
  await take(tour, 'insights', {
    focus: page.getByRole('list', { name: t('student360.insight') }),
  });
}

async function families(tour: Tour) {
  const { page, t, browser, locale } = tour;
  await page.goto(`${tour.sampleClass}/portal-links`);
  await page
    .getByRole('button', { name: t('portalLinks.showLink') })
    .first()
    .click();
  const url = (await page.getByTestId('portal-link').first().getAttribute('href')) ?? '';
  const phone = await windowFor(browser, locale, 'phone');
  const parent = await phone.newPage();
  await parent.goto(url);
  await expect(parent.getByRole('table', { name: t('family.grades') })).toBeVisible();
  await take(tour, 'parentPortal', { page: parent });
  await phone.close();
}

async function substitutes(tour: Tour) {
  const { page, t } = tour;
  await page.goto(`${tour.importedClass}/sub-packet`);
  const notes = page.getByRole('form', { name: t('subPacket.subNotes') });
  await notes.getByLabel(t('subPacket.nurseExt')).fill('Ext. 105');
  await notes.getByLabel(t('subPacket.dailyRoutines')).fill(tour.words.routines);
  await notes.getByRole('button', { name: t('subPacket.save') }).click();
  await page.goto(`${tour.importedClass}/sub-packet/print`);
  await take(tour, 'subPacket');
}

async function connections(tour: Tour) {
  const { page, locale } = tour;
  await page.goto(`/${locale}/app/integrations`);
  await take(tour, 'integrations');
  await page.goto(`/${locale}/app/integrations?group=schoolSystems`);
  await take(tour, 'schoolSystems');
}

async function schools(tour: Tour) {
  const { page, t, locale } = tour;
  await page.goto(`/${locale}/app/school`);
  await take(tour, 'schoolOverview');
  await page.goto(`/${locale}/app/admin`);
  await take(tour, 'schoolUsers');
  await page.goto(`/${locale}/app/approvals`);
  await take(tour, 'approvals');
  await page.goto(`/${locale}/app/settings`);
  await scrollTo(page, `section:has(h2:text-is("${t('schoolExport.title')}"))`);
  await take(tour, 'dataExport');
  await page.goto(`/${locale}/app/settings`);
  await page.getByLabel(t('settings.language')).focus();
  await scrollTo(page, `section:has(h2:text-is("${t('settings.profile')}"))`);
  await take(tour, 'languages');
}
