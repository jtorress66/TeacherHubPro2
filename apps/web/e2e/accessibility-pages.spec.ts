import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { createTranslator, type Locale } from '@thp/i18n';
import { marketingPaths } from '../src/server/marketing-pages.ts';
import { signUp } from './helpers.ts';

// Every page a teacher, student or family can reach, checked against WCAG 2.1 A and AA: the
// basis of the accessibility report (docs/ACCESSIBILITY_REPORT.md). Pages are read on the
// narrowest screen WCAG names (320 pixels wide, 1.4.10 Reflow).
const narrowest = 320;
test.setTimeout(600_000);
test.use({ reducedMotion: 'reduce', viewport: { width: narrowest, height: 800 } });

type Found = Record<string, string[]>;

async function check(page: Page, path: string, found: Found): Promise<void> {
  if (path !== new URL(page.url()).pathname) await page.goto(path);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const problems = results.violations.map(
    (v) =>
      `${v.id}: ${v.nodes
        .slice(0, 3)
        .map((n) => n.target.join(' '))
        .join(' | ')}`,
  );
  problems.push(...(await reflowProblems(page)), ...(await fieldBorderProblems(page)));
  if (problems.length > 0) found[path] = problems;
}

/** 1.4.10: the page itself never needs sideways scrolling (wide tables scroll in their own box). */
async function reflowProblems(page: Page): Promise<string[]> {
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  return width > narrowest ? [`reflow: the page is ${String(width)}px wide`] : [];
}

/**
 * 1.4.11: a text box, list or dropdown is found by its outline, so the outline needs a 3:1
 * contrast with what is behind it.
 */
async function fieldBorderProblems(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const rgb = (color: string) => (color.match(/[\d.]+/g) ?? []).map(Number);
    const luminance = ([r = 0, g = 0, b = 0]: number[]) => {
      const [lr = 0, lg = 0, lb = 0] = [r, g, b].map((v) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
    };
    const behind = (element: Element): number[] => {
      for (let node = element.parentElement; node; node = node.parentElement) {
        const color = rgb(getComputedStyle(node).backgroundColor);
        if (color.length === 3 || (color[3] ?? 0) > 0) return color;
      }
      return [255, 255, 255];
    };
    const problems: string[] = [];
    const fields = document.querySelectorAll(
      'input:not([type="hidden"], [type="radio"], [type="checkbox"], [type="file"], [type="submit"]), select, textarea',
    );
    for (const field of Array.from(fields)) {
      const style = getComputedStyle(field);
      if (field.getBoundingClientRect().width === 0 || style.borderTopStyle === 'none') continue;
      const a = luminance(rgb(style.borderTopColor));
      const b = luminance(behind(field));
      const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      if (ratio < 3) {
        const name = field.getAttribute('name') ?? field.id;
        problems.push(`field-border: ${field.tagName.toLowerCase()} ${name} ${ratio.toFixed(2)}:1`);
      }
    }
    return problems.slice(0, 3);
  });
}

/** The first link on a page whose address matches, e.g. a plan in the plan list. */
async function firstLink(page: Page, listPath: string, pattern: RegExp): Promise<string> {
  await page.goto(listPath);
  const hrefs = await page
    .locator('main a[href]')
    .evaluateAll((links) => links.map((a) => a.getAttribute('href') ?? ''));
  const href = hrefs.find((h) => pattern.test(h));
  expect(href, `a link matching ${pattern.source} on ${listPath}`).toBeDefined();
  return href ?? '';
}

const id = '[0-9a-f-]{36}';

for (const locale of ['en', 'es'] as const satisfies readonly Locale[]) {
  test(`every public page meets WCAG 2.1 AA (${locale})`, async ({ page }) => {
    const found: Found = {};
    const paths = [
      ...marketingPaths().map((path) => `/${locale}${path === '/' ? '' : path}`),
      `/${locale}/login`,
      `/${locale}/signup`,
      `/${locale}/forgot-password`,
      `/${locale}/play`,
    ];
    for (const path of paths) await check(page, path, found);
    expect(found).toEqual({});
  });

  test(`every teacher, student and family page meets WCAG 2.1 AA (${locale})`, async ({
    page,
    browser,
  }) => {
    const t = createTranslator(locale);
    const found: Found = {};
    await signUp(page, locale);
    await page.getByRole('button', { name: t('sample.add') }).click();
    await expect(page.getByTestId('sample-notice')).toBeVisible();
    const classPath = new URL(page.url()).pathname;
    const app = `/${locale}/app`;

    const student = await firstLink(page, classPath, new RegExp(`/students/${id}$`));
    const assignment = await firstLink(
      page,
      `${classPath}/gradebook`,
      new RegExp(`/assignments/${id}$`),
    );
    const plan = await firstLink(page, `${app}/plans`, new RegExp(`/plans/${id}$`));
    const game = await firstLink(page, `${app}/games`, new RegExp(`/games/${id}$`));

    for (const path of [
      app,
      `${app}/classes`,
      classPath,
      student,
      `${student}/edit`,
      `${classPath}/attendance`,
      `${classPath}/attendance/report`,
      `${classPath}/gradebook`,
      `${classPath}/gradebook/report`,
      `${classPath}/report-cards`,
      `${classPath}/standards`,
      `${classPath}/student-links`,
      `${classPath}/portal-links`,
      `${classPath}/sub-packet`,
      assignment,
      `${assignment}/questions`,
      `${assignment}/submissions`,
      `${app}/attendance`,
      `${app}/gradebook`,
      `${app}/plans`,
      `${app}/plans/new`,
      plan,
      `${plan}/print`,
      `${app}/prep`,
      `${app}/assistant`,
      `${app}/presentations`,
      `${app}/rubrics`,
      `${app}/templates`,
      `${app}/standards`,
      `${app}/games`,
      game,
      `${app}/live`,
      `${app}/learning`,
      `${app}/approvals`,
      `${app}/semesters`,
      `${app}/settings`,
      `${app}/billing`,
      `${app}/invite`,
      `${app}/integrations`,
      `${app}/school`,
    ]) {
      await check(page, path, found);
    }

    // A student's link: the assignment list and one assignment.
    await page.goto(`${classPath}/student-links`);
    await page.getByRole('button', { name: t('studentLinks.issue') }).click();
    const link = (await page.getByTestId('student-link').first().getAttribute('href')) ?? '';
    const studentPage = await (await browser.newContext({ reducedMotion: 'reduce' })).newPage();
    await studentPage.goto(link);
    await check(studentPage, new URL(studentPage.url()).pathname, found);
    await studentPage.getByRole('link', { name: t('sample.onlineQuiz') }).click();
    await check(studentPage, new URL(studentPage.url()).pathname, found);

    // A family's portal link, from the development mailbox.
    await page.goto(`${classPath}/portal-links`);
    const email = page
      .getByRole('form', { name: new RegExp(`^${t('portalLinks.email')}: `) })
      .first();
    await email.getByLabel(t('portalLinks.emailTo')).fill('family@example.com');
    await email.getByRole('button', { name: t('portalLinks.send') }).click();
    await expect(email.getByRole('status')).toBeVisible();
    await page.goto(`/${locale}/dev/mail`);
    const mail = page.getByRole('article').filter({ hasText: 'To family@example.com' }).first();
    const body = (await mail.locator('pre').textContent()) ?? '';
    const portal = /https?:\/\/\S+\/p\/\S+/u.exec(body)?.[0] ?? '';
    await studentPage.goto(portal);
    await check(studentPage, new URL(studentPage.url()).pathname, found);

    expect(found).toEqual({});
  });
}
