import { expect, test, type Page } from '@playwright/test';
import type { GameModeId } from '@thp/domain';
import { createTranslator, type Locale } from '@thp/i18n';
import { formatPercent } from '../src/server/gradebook-display.ts';
import { classWithStudents, signUp, studentLink } from './helpers.ts';

type T = ReturnType<typeof createTranslator>;

const questions = [
  {
    prompt: 'Largest planet?',
    right: 'Jupiter',
    line: 'Largest planet? | Mars | *Jupiter | Venus',
  },
  {
    prompt: 'Closest to the Sun?',
    right: 'Mercury',
    line: 'Closest to the Sun? | *Mercury | Earth',
  },
  { prompt: 'The red planet?', right: 'Mars', line: 'The red planet? | Saturn | *Mars' },
];
const statements = [
  { text: 'The Sun is a star', truth: true },
  { text: 'The Moon is a planet', truth: false },
  { text: 'Mars looks red', truth: true },
];
const sentences = [
  { before: 'The Sun is a', text: 'The Sun is a ___.', answer: 'star' },
  { before: 'is the red planet', text: '___ is the red planet.', answer: 'Mars' },
  { before: 'goes around the Earth', text: 'The ___ goes around the Earth.', answer: 'Moon' },
];
const pairs = [
  { term: 'Sun', definition: 'Our star' },
  { term: 'Moon', definition: 'The satellite of the Earth' },
  { term: 'Comet', definition: 'Icy body with a tail' },
  { term: 'Orbit', definition: 'Path around a star' },
  { term: 'Planet', definition: 'Travels around a star' },
];
const steps = ['Water evaporates', 'Clouds form', 'Rain falls'];
const groups = [
  { name: 'Planets', members: ['Mars', 'Venus'] },
  { name: 'Stars', members: ['Sirius', 'Vega'] },
];

const content = {
  questions: questions.map((q) => q.line).join('\n'),
  statements: statements.map((s) => `${s.text} | ${s.truth ? 'true' : 'false'}`).join('\n'),
  sentences: sentences.map((s) => `${s.text} | ${s.answer}`).join('\n'),
  pairs: pairs.map((p) => `${p.term} = ${p.definition}`).join('\n'),
  steps: steps.join('\n'),
  groups: groups.map((g) => `${g.name}: ${g.members.join(', ')}`).join('\n'),
};

/** Answers a quiz, one question at a time, by finding each question's right option. */
async function answerQuestions(student: Page, total: number) {
  for (let i = 0; i < total; i += 1) {
    const prompt = (await student.locator('.game-question h2').textContent()) ?? '';
    const question = questions.find((q) => q.prompt === prompt);
    await student.getByRole('button', { name: question?.right ?? prompt, exact: true }).click();
  }
}

/** Every grid cell's letter, by "row,col". */
async function gridOf(student: Page): Promise<Map<string, string>> {
  const cells = await student
    .locator('[data-cell]')
    .evaluateAll((elements) =>
      elements.map((e) => [e.getAttribute('data-cell') ?? '', e.textContent] as const),
    );
  return new Map(cells);
}

const directions = [
  [0, 1],
  [1, 0],
  [1, 1],
  [-1, 1],
  [0, -1],
  [-1, 0],
  [-1, -1],
  [1, -1],
] as const;

/** Finds the word in the grid and clicks its first and last letters. */
async function findWord(student: Page, grid: Map<string, string>, word: string) {
  const size = Math.round(Math.sqrt(grid.size));
  const letters = word.toUpperCase();
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      for (const [dr, dc] of directions) {
        const fits = Array.from(letters).every(
          (letter, k) => grid.get(`${String(r + dr * k)},${String(c + dc * k)}`) === letter,
        );
        if (!fits) continue;
        const last = letters.length - 1;
        await student.locator(`[data-cell="${String(r)},${String(c)}"]`).click();
        await student
          .locator(`[data-cell="${String(r + dr * last)},${String(c + dc * last)}"]`)
          .click();
        return;
      }
    }
  }
  throw new Error(`${word} is not in the grid`);
}

/** Turns cards two by two to learn where everything is, then matches what is left. */
async function playMemory(student: Page) {
  const cards = student.locator('.memory-card');
  const count = await cards.count();
  const seen: string[] = [];
  for (let i = 0; i < count; i += 2) {
    await cards.nth(i).click();
    await cards.nth(i + 1).click();
    seen[i] = (await cards.nth(i).textContent()) ?? '';
    seen[i + 1] = (await cards.nth(i + 1).textContent()) ?? '';
    await expect(student.locator('.memory-card[aria-pressed="true"]:not(.found)')).toHaveCount(0);
  }
  for (const pair of pairs) {
    // A lucky shuffle can finish the board in the first pass; the result replaces the cards.
    if ((await cards.count()) === 0) return;
    const term = seen.indexOf(pair.term);
    const definition = seen.indexOf(pair.definition);
    if (await cards.nth(term).evaluate((e) => e.classList.contains('found'))) continue;
    await cards.nth(term).click();
    await cards.nth(definition).click();
  }
}

/** How each mode is played perfectly, knowing the content the teacher typed. */
const players: Readonly<Record<GameModeId, (student: Page, t: T) => Promise<number>>> = {
  quiz: async (student) => {
    await answerQuestions(student, questions.length);
    return questions.length;
  },
  time_attack: async (student, t) => {
    await expect(student.getByRole('timer')).toContainText(
      t('gamePlay.timeLeft', { seconds: 60 }).split(':')[0] ?? '',
    );
    await answerQuestions(student, questions.length);
    return questions.length;
  },
  true_false: async (student, t) => {
    for (let left = statements.length; left > 0; left -= 1) {
      const text = (await student.locator('.game-question h2').textContent()) ?? '';
      const truth = statements.find((s) => s.text === text)?.truth ?? false;
      await student
        .getByRole('button', { name: t(truth ? 'gamePlay.true' : 'gamePlay.false') })
        .click();
    }
    return statements.length;
  },
  fill_blanks: async (student, t) => {
    const items = student.locator('.game-player ol li');
    for (let i = 0; i < sentences.length; i += 1) {
      const text = (await items.nth(i).textContent()) ?? '';
      const sentence = sentences.find((s) => text.includes(s.before));
      await items
        .nth(i)
        .getByRole('textbox')
        .fill(sentence?.answer ?? '');
    }
    await student.getByRole('button', { name: t('gamePlay.check') }).click();
    return sentences.length;
  },
  flashcards: async (student, t) => {
    for (let left = pairs.length; left > 0; left -= 1) {
      await student.getByRole('button', { name: t('gamePlay.flip') }).click();
      await student.getByRole('button', { name: t('gamePlay.knewIt') }).click();
    }
    return pairs.length;
  },
  matching: async (student, t) => {
    for (const pair of pairs) {
      await student
        .getByLabel(t('gamePlay.definitionFor', { term: pair.term }))
        .selectOption({ label: pair.definition });
    }
    await student.getByRole('button', { name: t('gamePlay.check') }).click();
    return pairs.length;
  },
  memory: async (student) => {
    await playMemory(student);
    return pairs.length;
  },
  word_search: async (student) => {
    const grid = await gridOf(student);
    for (const pair of pairs) await findWord(student, grid, pair.term);
    return pairs.length;
  },
  crossword: async (student, t) => {
    const inputs = student.getByRole('textbox');
    const placed = await inputs.count();
    for (const pair of pairs) {
      const input = student.getByLabel(`: ${pair.definition}`, { exact: false });
      if ((await input.count()) > 0) await input.fill(pair.term);
    }
    await student.getByRole('button', { name: t('gamePlay.check') }).click();
    return placed;
  },
  sequence: async (student, t) => {
    for (const [position, step] of steps.entries()) {
      const shown = (await student.locator('.sequence-list li span').allTextContents()).indexOf(
        step,
      );
      for (let k = shown; k > position; k -= 1) {
        await student.getByRole('button', { name: `${t('gamePlay.moveUp')}: ${step}` }).click();
      }
    }
    await student.getByRole('button', { name: t('gamePlay.check') }).click();
    return steps.length;
  },
  drag_drop: async (student, t) => {
    for (const group of groups) {
      for (const member of group.members) {
        await student
          .getByLabel(t('gamePlay.groupFor', { item: member }))
          .selectOption({ label: group.name });
      }
    }
    await student.getByRole('button', { name: t('gamePlay.check') }).click();
    return groups.flatMap((g) => g.members).length;
  },
};

const kindOf: Readonly<Record<GameModeId, keyof typeof content>> = {
  quiz: 'questions',
  time_attack: 'questions',
  true_false: 'statements',
  fill_blanks: 'sentences',
  flashcards: 'pairs',
  matching: 'pairs',
  memory: 'pairs',
  word_search: 'pairs',
  crossword: 'pairs',
  sequence: 'steps',
  drag_drop: 'groups',
};

/** Creates a game shared with the class "Historia 6"; returns its page's path. */
async function createGame(page: Page, locale: Locale, title: string, mode: GameModeId) {
  const t = createTranslator(locale);
  await page.goto(`/${locale}/app/games`);
  const form = page.getByRole('form', { name: t('games.newGame') });
  await form.getByLabel(t('games.titleLabel')).fill(title);
  await form.getByLabel(t('games.mode')).selectOption(mode);
  await form.getByLabel(t('games.class')).selectOption({ label: 'Historia 6' });
  await form.getByLabel(t('games.content'), { exact: false }).fill(content[kindOf[mode]]);
  await form.getByRole('button', { name: t('games.create') }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
  return new URL(page.url()).pathname;
}

const modes = Object.keys(players) as GameModeId[];

for (const locale of ['en', 'es'] as const satisfies readonly Locale[]) {
  const t = createTranslator(locale);

  // Build step 11 gate: create, play and score one game per mode.
  test(`a game in every mode is created, played from a student link and scored (${locale})`, async ({
    page,
    browser,
  }) => {
    test.setTimeout(300_000);
    await signUp(page, locale);
    const classPath = await classWithStudents(page, locale);
    const url = await studentLink(page, locale, classPath, 'Ana Zayas');
    const student = await browser.newPage();

    for (const mode of modes) {
      await test.step(mode, async () => {
        const title = `${t(`gameModes.${mode}`)} game`;
        await createGame(page, locale, title, mode);
        await student.goto(url);
        await student.getByRole('link', { name: title }).click();
        await expect(student.getByRole('heading', { level: 1 })).toHaveText(title);
        const total = await players[mode](student, t);
        await expect(student.getByRole('status').filter({ hasText: '100' })).toHaveText(
          t('gamePlay.result', { score: total, total, percent: 100 }),
        );
      });
    }
    await student.close();
  });

  test(`a game counts as a grade once the teacher confirms it (${locale})`, async ({
    page,
    browser,
  }) => {
    await signUp(page, locale);
    const classPath = await classWithStudents(page, locale);
    await page.goto(`${classPath}/gradebook`);
    await page.getByRole('button', { name: t('gradebook.useStandard') }).click();
    const url = await studentLink(page, locale, classPath, 'Ana Zayas');
    const gamePath = await createGame(page, locale, 'Space quiz', 'quiz');

    const preview = await browser.newPage();
    await preview.context().addCookies(await page.context().cookies());
    await preview.goto(`${gamePath}/play`);
    await expect(preview.getByText(t('gamePlay.previewNote'))).toBeVisible();
    await preview.close();

    const student = await browser.newPage();
    await student.goto(url);
    await student.getByRole('link', { name: 'Space quiz' }).click();
    await answerQuestions(student, questions.length);
    await expect(
      student.getByText(t('gamePlay.result', { score: 3, total: 3, percent: 100 })),
    ).toBeVisible();
    await student.getByRole('button', { name: t('gamePlay.playAgain') }).click();
    await expect(student.locator('.game-question h2')).toBeVisible();
    await student.reload();
    const board = student.getByRole('table', { name: t('games.leaderboard') });
    await expect(board).toContainText(`Ana (${t('gamePlay.you')})`);
    await expect(board).not.toContainText('Zayas');
    await student.close();

    await page.goto(gamePath);
    const grading = page.getByRole('form', { name: t('games.gradingTitle') });
    await grading.getByLabel(t('games.countAsGrade')).check();
    await grading.getByLabel(t('games.points')).fill('10');
    await grading
      .getByLabel(t('games.category'))
      .selectOption({ label: t('gradebook.standard_quiz') });
    await grading.getByRole('button', { name: t('games.saveGrading') }).click();
    await expect(grading.getByRole('status')).toHaveText(t('games.saved'));

    await page.reload();
    const results = page.getByRole('form', { name: t('games.results') });
    await expect(results.getByRole('row').filter({ hasText: 'Ana Zayas' })).toBeVisible();
    await expect(results.getByLabel(t('games.scoreFor', { name: 'Ana Zayas' }))).toHaveValue('10');
    await results.getByRole('button', { name: t('games.confirmGrades') }).click();
    await expect(results.getByRole('status')).toHaveText(t('games.gradesConfirmed'));

    await page.goto(`${classPath}/gradebook`);
    await expect(
      page.getByTestId('gradebook-row').filter({ hasText: 'Zayas' }).getByTestId('overall'),
    ).toHaveText(formatPercent(100, locale));
  });
}

test('the AI writes a game the teacher reviews and saves', async ({ page }) => {
  const t = createTranslator('en');
  await signUp(page, 'en');
  await page.goto('/en/app/games');
  const form = page.getByRole('form', { name: t('games.aiTitle') });
  await form.getByLabel(t('games.mode')).selectOption('word_search');
  await form.getByLabel(t('games.topic')).fill('Space');
  await form.getByLabel(t('games.count')).fill('6');
  await form.getByRole('button', { name: t('games.generate') }).click();
  const editor = page.getByRole('form', { name: t('games.newGame') });
  await expect(editor).toBeVisible({ timeout: 30_000 });
  await expect(editor.getByLabel(t('games.titleLabel'))).toHaveValue('Space');
  await expect(editor.getByLabel(t('games.mode'))).toHaveValue('word_search');
  await expect(editor.getByLabel(t('games.content'), { exact: false })).toHaveValue(/^Sun = /);
  await editor.getByRole('button', { name: t('games.create') }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Space');
});
