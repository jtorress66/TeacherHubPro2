import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type Locator } from '@playwright/test';
import { createTranslator, type Locale } from '@thp/i18n';
import { classWithStudents, signUp, studentLink } from './helpers.ts';

const moon = 'The Moon is a planet';
const why = 'The Moon travels around the Earth, so it is a moon.';

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
    form.getByRole('group', { name: t('games.builderLegend_statements', { number }) });

  test(`a teacher explains why an answer is right; students see it after they miss it, solo and live (${locale})`, async ({
    page,
    browser,
  }) => {
    test.setTimeout(180_000);
    await signUp(page, locale);
    const classPath = await classWithStudents(page, locale);

    await page.goto(`/${locale}/app/games`);
    const form = page.getByRole('form', { name: t('games.newGame') });
    await form.getByLabel(t('games.titleLabel')).fill('Space facts');
    await form.getByLabel(t('games.mode')).selectOption('true_false');
    await form.getByLabel(t('games.class')).selectOption({ label: 'Historia 6' });
    const statements = [
      ['The Sun is a star', true],
      [moon, false],
      ['Mars is red', true],
    ] as const;
    for (const [index, [statement, isTrue]] of statements.entries()) {
      const number = index + 1;
      if (number > 1) {
        await form.getByRole('button', { name: t('games.builderAdd_statements') }).click();
      }
      await card(form, number).getByLabel(t('games.builderStatement')).fill(statement);
      await card(form, number)
        .getByLabel(isTrue ? t('games.builderTrue') : t('games.builderFalse'))
        .check();
    }
    await card(form, 2).getByLabel(t('games.builderExplanation')).fill(why);
    await form.getByRole('button', { name: t('games.create') }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Space facts');
    const editor = page.getByRole('form', { name: t('games.save') });
    await expect(card(editor, 2).getByLabel(t('games.builderExplanation'))).toHaveValue(why);

    // Solo play: answer "true" to everything, so only the Moon statement is missed.
    const url = await studentLink(page, locale, classPath, 'Ana Zayas');
    const student = await (await browser.newContext()).newPage();
    await student.goto(url);
    await student.getByRole('link', { name: 'Space facts' }).click();
    for (let index = 0; index < statements.length; index += 1) {
      await student.getByRole('button', { name: t('gamePlay.true'), exact: true }).click();
    }
    const review = student.getByRole('region', { name: t('gamePlay.reviewTitle') });
    await expect(review.getByRole('listitem')).toHaveCount(1);
    await expect(review.getByText(moon)).toBeVisible();
    await expect(
      review.getByText(t('gamePlay.reviewYours', { answer: t('gamePlay.true') })),
    ).toBeVisible();
    await expect(
      review.getByText(t('gamePlay.reviewRight', { answer: t('gamePlay.false') })),
    ).toBeVisible();
    await expect(review.getByText(why)).toBeVisible();
    expect(
      (await new AxeBuilder({ page: student }).withTags(['wcag2a', 'wcag2aa']).analyze())
        .violations,
    ).toEqual([]);
    await student.context().close();

    // Live: the reveal shows the explanation on the big screen and on the student's phone.
    await page.goto(`/${locale}/app/live`);
    const start = page.getByRole('form', { name: t('live.startTitle') });
    await start.getByLabel(t('live.kind_live')).check();
    await start.getByRole('button', { name: t('live.start') }).click();
    const pin = (await page.getByTestId('live-pin').textContent()) ?? '';
    const ana = await joinAs(browser, locale, pin, 'Ana');
    await expect(page.getByRole('status')).toHaveText(t('live.players', { count: 1 }));
    await page.getByRole('button', { name: t('live.startGame') }).click();
    let explained = false;
    for (let index = 0; index < statements.length; index += 1) {
      const prompt = ana.locator('.live-question');
      await expect(prompt).not.toBeEmpty();
      const isMoon = (await prompt.textContent()) === moon;
      await ana.locator('.answer-grid button').first().click();
      const next = page.getByRole('button', {
        name: index === statements.length - 1 ? t('live.finish') : t('live.next'),
      });
      await expect(next).toBeVisible();
      if (isMoon) {
        await expect(page.locator('.reveal-explanation')).toContainText(why);
        await expect(ana.locator('.reveal-explanation')).toContainText(why);
        explained = true;
      } else {
        await expect(page.locator('.reveal-explanation')).toHaveCount(0);
      }
      await next.click();
    }
    expect(explained).toBe(true);
    await ana.context().close();
  });
}
