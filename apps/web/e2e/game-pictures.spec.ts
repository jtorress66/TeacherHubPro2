import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type Locator } from '@playwright/test';
import { createTranslator, type Locale } from '@thp/i18n';
import { classWithStudents, signUp, studentLink } from './helpers.ts';

/** A real 1×1 PNG, so the browser can draw it before it is sent. */
const dot = {
  name: 'ponce-map.png',
  mimeType: 'image/png',
  buffer: Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  ),
};
const alt = 'A map of Puerto Rico with Ponce marked';
const ponce = 'Where is Ponce?';

/** The picture really loaded (not just an <img> with a broken address). */
async function expectLoaded(picture: Locator) {
  await expect(picture).toBeVisible();
  await expect
    .poll(() => picture.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth))
    .toBeGreaterThan(0);
}

async function joinAs(browser: Browser, locale: Locale, pin: string, name: string) {
  const t = createTranslator(locale);
  const student = await (await browser.newContext()).newPage();
  await student.goto(`/${locale}/play`);
  await student.getByLabel(t('play.pin')).fill(pin);
  await student.getByRole('button', { name: t('play.join') }).click();
  await student.getByRole('button', { name, exact: true }).click();
  return student;
}

for (const locale of ['en', 'es'] as const satisfies readonly Locale[]) {
  const t = createTranslator(locale);
  const card = (form: Locator, number: number) =>
    form.getByRole('group', { name: t('games.builderLegend_questions', { number }) });

  async function fillQuestion(form: Locator, number: number, prompt: string, answers: string[]) {
    const question = card(form, number);
    await question.getByLabel(t('games.builderQuestion'), { exact: true }).fill(prompt);
    for (const [index, answer] of answers.entries()) {
      await question
        .getByLabel(t('games.builderAnswer', { option: index + 1 }), { exact: true })
        .fill(answer);
    }
  }

  test(`a teacher puts a described picture on a question; students see it in solo and live play (${locale})`, async ({
    page,
    browser,
  }) => {
    test.setTimeout(180_000);
    await signUp(page, locale);
    const classPath = await classWithStudents(page, locale);

    await page.goto(`/${locale}/app/games`);
    const form = page.getByRole('form', { name: t('games.newGame') });
    await form.getByLabel(t('games.titleLabel')).fill('Puerto Rico');
    await form.getByLabel(t('games.mode')).selectOption('quiz');
    await form.getByLabel(t('games.class')).selectOption({ label: 'Historia 6' });
    await fillQuestion(form, 1, ponce, ['South coast', 'North coast']);
    await card(form, 1).getByLabel(t('games.pictureAdd')).setInputFiles(dot);
    await expect(card(form, 1).locator('img.game-picture')).toBeVisible();
    for (const [number, prompt] of [
      [2, 'Capital of Puerto Rico?'],
      [3, 'Largest island nearby?'],
    ] as const) {
      await form.getByRole('button', { name: t('games.builderAdd_questions') }).click();
      await fillQuestion(form, number, prompt, ['Yes', 'No']);
    }

    // A picture with no description is refused, and stays on its card to describe.
    await form.getByRole('button', { name: t('games.create') }).click();
    await expect(
      page.getByText(t('games.itemError', { item: 1, message: t('games.pictureAltRequired') })),
    ).toBeVisible();
    await expect(card(form, 1).locator('img.game-picture')).toBeVisible();
    await card(form, 1).getByLabel(t('games.pictureAlt')).fill(alt);
    await form.getByRole('button', { name: t('games.create') }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Puerto Rico');

    const editor = page.getByRole('form', { name: t('games.save') });
    await expectLoaded(card(editor, 1).getByRole('img', { name: alt }));

    // Solo play from a student link: the picture is shown, described, with its question.
    const url = await studentLink(page, locale, classPath, 'Ana Zayas');
    const student = await (await browser.newContext()).newPage();
    await student.goto(url);
    await student.getByRole('link', { name: 'Puerto Rico' }).click();
    let seen = false;
    for (let index = 0; index < 3; index += 1) {
      const question = student.locator('.game-question h2');
      await expect(question).toHaveText(/\?$/u);
      if ((await question.textContent()) === ponce) {
        await expectLoaded(student.getByRole('img', { name: alt }));
        expect(
          await new AxeBuilder({ page: student }).withTags(['wcag2a', 'wcag2aa']).analyze(),
        ).toMatchObject({ violations: [] });
        seen = true;
      }
      await student.locator('.game-question .button-row button').first().click();
    }
    expect(seen).toBe(true);
    await student.context().close();

    // Live: on the big screen and on the student's device.
    await page.goto(`/${locale}/app/live`);
    const start = page.getByRole('form', { name: t('live.startTitle') });
    await start.getByLabel(t('live.kind_live')).check();
    await start.getByRole('button', { name: t('live.start') }).click();
    const pin = (await page.getByTestId('live-pin').textContent()) ?? '';
    const ana = await joinAs(browser, locale, pin, 'Ana');
    await expect(page.getByRole('status')).toHaveText(t('live.players', { count: 1 }));
    await page.getByRole('button', { name: t('live.startGame') }).click();
    for (let index = 0; index < 3; index += 1) {
      const prompt = ana.locator('.live-question');
      await expect(prompt).toHaveText(/\?$/u);
      if ((await prompt.textContent()) === ponce) {
        await expectLoaded(ana.getByRole('img', { name: alt }));
        await expectLoaded(page.getByRole('img', { name: alt }));
      } else {
        await expect(ana.getByRole('img', { name: alt })).toHaveCount(0);
      }
      await ana.locator('.answer-grid button').first().click();
      await page
        .getByRole('button', { name: index === 2 ? t('live.finish') : t('live.next') })
        .click();
    }
    await ana.context().close();
  });
}
