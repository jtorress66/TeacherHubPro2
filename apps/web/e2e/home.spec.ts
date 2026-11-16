import { expect, test } from '@playwright/test';
import { catalogs } from '@thp/i18n';

test.describe('home page languages', () => {
  test('/es renders the Spanish title and html lang=es', async ({ page }) => {
    await page.goto('/es');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(catalogs.es.home.title);
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  });

  test('/en renders the English title and html lang=en', async ({ page }) => {
    await page.goto('/en');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(catalogs.en.home.title);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('/ redirects to /en with no preferences', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL(/\/en$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(catalogs.en.home.title);
  });

  test('/?lang=es redirects to /es and remembers it: the next visit to / goes to /es', async ({
    page,
  }) => {
    await page.goto('/?lang=es');
    await expect(page).toHaveURL(/\/es$/);

    await page.goto('/');
    await expect(page).toHaveURL(/\/es$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(catalogs.es.home.title);
  });

  test('an old app address such as /dashboard still lands on the right page', async ({
    request,
    page,
  }) => {
    const moved = await request.get('/dashboard?lang=es', { maxRedirects: 0 });
    expect(moved.status()).toBe(308);
    expect(moved.headers().location).toMatch(/\/es\/app$/);

    await page.goto('/dashboard?lang=es');
    await expect(page).toHaveURL(/\/es\/login/);
  });

  test('the workspace drawing shows the three feature phrases in the page’s language', async ({
    page,
  }) => {
    for (const locale of ['en', 'es'] as const) {
      const home = catalogs[locale].home;
      await page.goto(`/${locale}`);
      await expect(page.locator('.hero-phrase')).toHaveText([
        home.phraseLessons,
        home.phraseAi,
        home.phraseWorkflow,
      ]);
    }
  });

  test('the drawing’s three cards show a lesson plan, a class and a parent portal', async ({
    page,
  }) => {
    await page.goto('/en');
    await expect(page.locator('.hero-tile svg')).toHaveCount(3);
    const shown = await page
      .locator('.hero-tile')
      .evaluateAll((tiles) => tiles.map((tile) => tile.getAttribute('data-illustration')));
    expect(shown).toEqual(['lesson-plan', 'classroom', 'parent-portal']);
  });

  test('the language picker switches between /en and /es', async ({ page }) => {
    await page.goto('/en');
    const picker = page.getByRole('navigation', { name: catalogs.en.language.label });
    await expect(picker.getByRole('link')).toHaveCount(7);

    await picker.getByRole('link', { name: 'Español' }).click();
    await expect(page).toHaveURL(/\/es$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(catalogs.es.home.title);

    await page
      .getByRole('navigation', { name: catalogs.es.language.label })
      .getByRole('link', { name: 'English' })
      .click();
    await expect(page).toHaveURL(/\/en$/);
  });
});

for (const locale of ['en', 'es'] as const) {
  const text = catalogs[locale].marketing.home;
  const tools = catalogs[locale].connectedTools;

  test.describe(`home page showcase (${locale})`, () => {
    test.use({ reducedMotion: 'reduce' });

    test('the demo switches between the four jobs and responds to the teacher', async ({
      page,
    }) => {
      await page.goto(`/${locale}`);
      await page.getByRole('link', { name: text.seeItWork }).click();
      await expect(page).toHaveURL(/#demo$/);

      const demo = page.getByRole('region', { name: text.demoTitle });
      const panel = demo.getByRole('tabpanel');
      await expect(demo.getByRole('tab', { name: text.tabPrep })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      await expect(panel).toContainText(text.prepPrompt);
      await expect(panel).toContainText(text.prepDay3);
      await panel.getByRole('button', { name: text.prepApprove }).click();
      await expect(panel).toContainText(text.prepDone);
      await expect(panel.getByText(text.approved, { exact: true })).toHaveCount(4);

      await demo.getByRole('tab', { name: text.tabGrade }).click();
      await expect(demo.getByRole('heading', { name: text.gradeTitle })).toBeVisible();
      await panel.getByRole('button', { name: text.gradeChange.replace('{score}', '10') }).click();
      await expect(panel).toContainText(text.gradeChanged.replace('{score}', '10'));

      await demo.getByRole('tab', { name: text.tabGame }).press('ArrowRight');
      await expect(demo.getByRole('tab', { name: text.tabFamily })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      await expect(panel).toContainText(text.familyHidden);
      await demo.getByRole('tab', { name: text.tabGame }).click();
      await expect(panel).toContainText('482 913');
      await expect(panel).toContainText(text.gameTeam1);
    });

    test('the greeting changes to the language a visitor picks', async ({ page }) => {
      await page.goto(`/${locale}`);
      const band = page.getByRole('region', { name: text.languagesEyebrow });
      await expect(band).toContainText(text.hello);
      await band.getByRole('button', { name: 'Italiano' }).click();
      await expect(band).toContainText(catalogs.it.marketing.home.hello);
      await expect(band).toContainText(catalogs.it.marketing.home.sampleTitle);
      await expect(band.getByRole('button', { name: 'Italiano' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });

    test('every connected tool is listed as ready or on request, never "coming soon"', async ({
      page,
    }) => {
      await page.goto(`/${locale}`);
      const ready = page.getByRole('region', { name: text.toolsReady });
      const asked = page.getByRole('region', { name: tools.onRequest, exact: true });
      await expect(ready).toContainText(tools.tool.canva.name);
      await expect(ready).toContainText(tools.tool.classroom.name);
      for (const name of [tools.tool.teams.name, tools.tool.clever.name, 'Moodle', 'Canvas']) {
        await expect(asked).toContainText(name);
      }
      await expect(page.getByText(/coming soon|próximamente/iu)).toHaveCount(0);
    });

    test('the yearly plan shows its real saving and the trial facts sit under the hero', async ({
      page,
    }) => {
      await page.goto(`/${locale}`);
      await expect(page.getByTestId('plan-individual_yearly')).toContainText(
        text.save.replace('{percent}', '34'),
      );
      await expect(page.locator('.hero-facts')).toContainText(text.factNoCard);
      await expect(page.locator('.hero-facts')).toContainText(
        text.factTrial.replace('{days}', '7'),
      );
    });
  });
}
