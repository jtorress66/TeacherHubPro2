import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { createTranslator } from '@thp/i18n';
import { classWithStudents, signUp, studentLink } from './helpers.ts';

/** WCAG 2.1 A and AA: labels, landmarks, names and text contrast. */
async function violations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return results.violations.map((v) => ({
    rule: v.id,
    nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
  }));
}

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`${colorScheme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme });
    });

    test('public pages meet WCAG AA in English and Spanish', async ({ page }) => {
      for (const path of ['/en', '/es', '/en/login', '/es/signup']) {
        await page.goto(path);
        expect(await violations(page), path).toEqual([]);
      }
    });

    test('the teacher app and a student link page meet WCAG AA', async ({ page, browser }) => {
      const t = createTranslator('es');
      await signUp(page, 'es');
      expect(await violations(page), 'dashboard').toEqual([]);
      const classPath = await classWithStudents(page, 'es');
      expect(await violations(page), 'class').toEqual([]);
      for (const path of ['/es/app/classes', '/es/app/games', `${classPath}/gradebook`]) {
        await page.goto(path);
        expect(await violations(page), path).toEqual([]);
      }

      const url = await studentLink(page, 'es', classPath, 'Ana Zayas');
      const context = await browser.newContext({ colorScheme });
      const student = await context.newPage();
      await student.goto(url);
      await expect(student.getByRole('heading', { level: 1 })).toHaveText(
        t('student.hello', { name: 'Ana' }),
      );
      expect(await violations(student), 'student link').toEqual([]);
      await context.close();
    });
  });
}
