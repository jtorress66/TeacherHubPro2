import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { createTranslator, type Locale } from '@thp/i18n';

const axe = async (page: Page) =>
  (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations;

for (const locale of ['en', 'es'] as const satisfies readonly Locale[]) {
  const t = createTranslator(locale);

  test.describe(`free tools (${locale})`, () => {
    test('the hub lists every tool, reachable from the site menu, with no accessibility problems', async ({
      page,
    }) => {
      await page.goto(`/${locale}`);
      await page
        .getByRole('navigation', { name: t('marketing.nav.label') })
        .getByRole('link', { name: t('marketing.nav.freeTools') })
        .click();
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(
        t('marketing.freeTools.title'),
      );
      for (const name of ['gradeName', 'groupName', 'rubricName'] as const) {
        await expect(
          page.getByRole('link', { name: t(`marketing.freeTools.${name}`) }),
        ).toBeVisible();
      }
      expect(await axe(page)).toEqual([]);
    });

    test('the grade calculator weights categories and gives the letter and GPA', async ({
      page,
    }) => {
      await page.goto(`/${locale}/free-tools/grade-calculator`);
      const result = page.getByTestId('grade-result');
      await expect(result).toContainText(t('marketing.freeTools.empty'));

      // Homework 25%, quizzes 25%, tests 30%, projects 20%: only two categories have scores.
      await page.getByLabel(t('marketing.freeTools.scores')).nth(0).fill('18/20\n16/20');
      await page.getByLabel(t('marketing.freeTools.scores')).nth(2).fill('70%\nA+');

      // (85 × 25 + 70 × 30) / 55 = 76.8
      await expect(result).toContainText(locale === 'en' ? '76.8%' : '76,8%');
      await expect(result).toContainText('C');
      await expect(page.getByText(t('marketing.freeTools.unread', { count: 1 }))).toBeVisible();
      expect(await axe(page)).toEqual([]);
    });

    test('the group maker splits a pasted list without sending the names anywhere', async ({
      page,
    }) => {
      const sent: string[] = [];
      page.on('request', (request) => {
        sent.push(`${request.url()} ${request.postData() ?? ''}`);
      });
      await page.goto(`/${locale}/free-tools/group-maker`);
      const names = Array.from({ length: 10 }, (_, i) => `Pupilname${String(i + 1)}`);
      await page.getByLabel(t('marketing.freeTools.names')).fill(names.join('\n'));
      await expect(page.getByTestId('names-count')).toHaveText(
        t('marketing.freeTools.namesCount', { count: 10 }),
      );

      await page.getByLabel(t('marketing.freeTools.howMany')).fill('3');
      await page.getByRole('button', { name: t('marketing.freeTools.make') }).click();
      const groups = page.getByRole('heading', { level: 3 });
      await expect(groups).toHaveText([1, 2, 3].map((n) => t('marketing.freeTools.group', { n })));

      await page.getByRole('button', { name: t('marketing.freeTools.pick') }).click();
      await expect(page.getByRole('status')).toContainText('Pupilname');

      expect(sent.filter((line) => line.includes('Pupilname'))).toEqual([]);
      expect(await axe(page)).toEqual([]);
    });

    test('the rubric maker builds a grid with its total', async ({ page }) => {
      await page.goto(`/${locale}/free-tools/rubric-maker`);
      await expect(page.getByTestId('rubric-total')).toHaveText(t('rubrics.total', { points: 16 }));

      await page.getByRole('button', { name: t('rubrics.addCriterion') }).click();
      await expect(page.getByTestId('rubric-total')).toHaveText(t('rubrics.total', { points: 20 }));
      await page
        .getByLabel(t('rubrics.criterionLabel', { n: 5 }), { exact: true })
        .fill('Spelling');
      await expect(
        page.getByLabel(t('rubrics.criterionLabel', { n: 5 }), { exact: true }),
      ).toHaveValue('Spelling');
      expect(await axe(page)).toEqual([]);
    });
  });
}
