import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { createTranslator, type Locale } from '@thp/i18n';
import { classWithStudents, signUp } from './helpers.ts';

type T = ReturnType<typeof createTranslator>;

/** The fixed text of a message before its first number (scores vary with speed). */
const before = (message: string): string => message.split('\u0000')[0] ?? message;

const questions = [
  { prompt: 'Largest planet?', right: 'Jupiter', wrong: 'Mars' },
  { prompt: 'Closest to the Sun?', right: 'Mercury', wrong: 'Earth' },
  { prompt: 'The red planet?', right: 'Mars', wrong: 'Saturn' },
];
const content = [
  'Largest planet? | Mars | *Jupiter | Venus',
  'Closest to the Sun? | *Mercury | Earth',
  'The red planet? | Saturn | *Mars',
].join('\n');

/** A quiz shared with the class "Historia 6". */
async function createQuiz(page: Page, locale: Locale, title: string) {
  const t = createTranslator(locale);
  await page.goto(`/${locale}/app/games`);
  const form = page.getByRole('form', { name: t('games.newGame') });
  await form.getByLabel(t('games.titleLabel')).fill(title);
  await form.getByLabel(t('games.mode')).selectOption('quiz');
  await form.getByLabel(t('games.class')).selectOption({ label: 'Historia 6' });
  await form.getByLabel(t('games.content'), { exact: false }).fill(content);
  await form.getByRole('button', { name: t('games.create') }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
  return new URL(page.url()).pathname;
}

/** Starts a session from the Play to Learn page and returns its PIN. */
async function startSession(page: Page, t: T, locale: Locale, kind: 'live' | 'self_paced') {
  await page.goto(`/${locale}/app/live`);
  const form = page.getByRole('form', { name: t('live.startTitle') });
  await form.getByLabel(t(`live.kind_${kind}`)).check();
  await form.getByRole('button', { name: t('live.start') }).click();
  const pin = page.getByTestId('live-pin');
  await expect(pin).toHaveText(/^\d{6}$/);
  return (await pin.textContent()) ?? '';
}

/** A student's own browser: enter the PIN, tap their name. */
async function joinAs(browser: Browser, locale: Locale, pin: string, name: string) {
  const t = createTranslator(locale);
  const context = await browser.newContext();
  const student = await context.newPage();
  await student.goto(`/${locale}/play`);
  await student.getByLabel(t('play.pin')).fill(pin);
  await student.getByRole('button', { name: t('play.join') }).click();
  await student.getByRole('button', { name, exact: true }).click();
  return student;
}

/** Taps the answer with this option text on the question shown. */
async function answer(student: Page, option: string) {
  await student.getByRole('button', { name: new RegExp(`: ${option}$`, 'u') }).click();
}

for (const locale of ['en', 'es'] as const satisfies readonly Locale[]) {
  const t = createTranslator(locale);

  // Build step 12 gate: a host and 3 students play a live session; scores and insights are correct.
  test(`a host and three students play a live game; scores and insights are correct (${locale})`, async ({
    page,
    browser,
  }) => {
    test.setTimeout(120_000);
    await signUp(page, locale);
    await classWithStudents(page, locale);
    const gamePath = await createQuiz(page, locale, 'Planets live');
    const pin = await startSession(page, t, locale, 'live');

    const ana = await joinAs(browser, locale, pin, 'Ana');
    const ben = await joinAs(browser, locale, pin, 'Ben');
    const cara = await joinAs(browser, locale, pin, 'Cara');
    await expect(ana.getByText(t('play.waiting', { name: 'Ana' }))).toBeVisible();
    await expect(page.getByRole('status')).toHaveText(t('live.players', { count: 3 }));
    expect(
      await new AxeBuilder({ page: ana }).withTags(['wcag2a', 'wcag2aa']).analyze(),
    ).toMatchObject({ violations: [] });

    await page.getByRole('button', { name: t('live.startGame') }).click();
    for (let index = 0; index < questions.length; index += 1) {
      const prompt = (await ana.locator('.live-question').textContent()) ?? '';
      const question = questions.find((q) => q.prompt === prompt) ?? questions[0];
      await answer(ana, question?.right ?? '');
      // Rounds are shuffled: Ben knows only the largest planet, whenever it comes.
      const benKnows = question?.prompt === 'Largest planet?';
      const [right, wrong] = [question?.right ?? '', question?.wrong ?? ''];
      await answer(ben, benKnows ? right : wrong);
      await answer(cara, question?.wrong ?? '');
      await expect(
        page.getByText(t('live.correctAnswer', { answer: question?.right ?? '' })),
      ).toBeVisible();
      await expect(ana.getByRole('status')).toContainText(
        before(t('play.correct', { points: '\u0000' })),
      );
      await expect(cara.getByRole('status')).toHaveText(t('play.wrong'));
      const last = index === questions.length - 1;
      await page.getByRole('button', { name: last ? t('live.finish') : t('live.next') }).click();
    }

    const board = page.getByRole('list', { name: t('live.leaderboard') });
    await expect(page.getByRole('heading', { name: t('live.finalResults') })).toBeVisible();
    await expect(board.locator('.live-name')).toHaveText(['Ana', 'Ben', 'Cara']);
    await expect(ana.getByText(t('play.ended'))).toBeVisible();
    await expect(ana.locator('.live-standing')).toContainText(
      before(t('play.rank', { rank: 1, points: '\u0000' })),
    );

    await page.goto(gamePath);
    await expect(
      page.getByText(t('live.insightsSummary', { sessions: 1, participants: 3, accuracy: 44 })),
    ).toBeVisible();
    const hardest = page.getByRole('table', { name: t('live.hardest') });
    await expect(hardest.getByRole('row').filter({ hasText: 'Largest planet?' })).toContainText(
      '67%',
    );
    await expect(hardest.getByRole('row').filter({ hasText: 'The red planet?' })).toContainText(
      '33%',
    );
    const students = page.getByRole('table', { name: t('live.student') });
    await expect(students.getByRole('row').filter({ hasText: 'Ana' })).toContainText('100%');
    await expect(students.getByRole('row').filter({ hasText: 'Ben' })).toContainText('33%');
    await expect(students.getByRole('row').filter({ hasText: 'Cara' })).toContainText('0%');
    for (const student of [ana, ben, cara]) await student.context().close();
  });
}

test('a self-paced session: a student plays on their own and the host sees their score', async ({
  page,
  browser,
}) => {
  const t = createTranslator('en');
  await signUp(page, 'en');
  await classWithStudents(page, 'en');
  await createQuiz(page, 'en', 'Planets practice');
  const pin = await startSession(page, t, 'en', 'self_paced');

  const ana = await joinAs(browser, 'en', pin, 'Ana');
  for (let left = questions.length; left > 0; left -= 1) {
    const prompt = (await ana.locator('.game-question h2').textContent()) ?? '';
    const question = questions.find((q) => q.prompt === prompt);
    await ana.getByRole('button', { name: question?.right ?? '', exact: true }).click();
  }
  await expect(
    ana.getByText(t('gamePlay.result', { score: 3, total: 3, percent: 100 })),
  ).toBeVisible();

  const progress = page.getByRole('table', { name: t('live.studentsPlaying') });
  await expect(progress.getByRole('row').filter({ hasText: 'Ana' })).toContainText('100%');
  await ana.context().close();
});

test('a wrong PIN says no game is open, and a taken name cannot be picked twice', async ({
  page,
  browser,
}) => {
  const t = createTranslator('en');
  await page.goto('/en/play');
  await page.getByLabel(t('play.pin')).fill('000000');
  await page.getByRole('button', { name: t('play.join') }).click();
  await expect(page.getByText(t('play.notFound'))).toBeVisible();

  const host = await browser.newPage();
  await signUp(host, 'en');
  await classWithStudents(host, 'en');
  await createQuiz(host, 'en', 'Planets once');
  const pin = await startSession(host, t, 'en', 'live');
  const ana = await joinAs(browser, 'en', pin, 'Ana');
  await expect(ana.getByText(t('play.waiting', { name: 'Ana' }))).toBeVisible();
  await page.getByLabel(t('play.pin')).fill(pin);
  await page.getByRole('button', { name: t('play.join') }).click();
  await expect(page.getByRole('button', { name: /^Ana/u })).toBeDisabled();
  await expect(page.getByRole('button', { name: /^Ana/u })).toContainText(t('play.taken'));
});
