import { expect, test, type Locator, type Page } from '@playwright/test';
import { createTranslator } from '@thp/i18n';
import { signUp } from '../helpers.ts';

/**
 * Stripe Checkout renders card inputs inside embedded Stripe frames, so each field is searched for
 * in every frame, by its standard autofill attribute first (stable across layouts), then by the
 * ids older Checkout layouts used. (Adapted from LaunchPilot's Stripe journey.)
 */
const cardFields = [
  {
    name: 'card number',
    value: '4242424242424242',
    required: true,
    selectors: [
      'input[autocomplete="cc-number"]',
      '#cardNumber',
      'input[name="number"]',
      'input[name="cardnumber"]',
    ],
  },
  {
    name: 'expiry',
    value: '1234',
    required: true,
    selectors: [
      'input[autocomplete="cc-exp"]',
      '#cardExpiry',
      'input[name="expiry"]',
      'input[name="exp-date"]',
    ],
  },
  {
    name: 'CVC',
    value: '123',
    required: true,
    selectors: ['input[autocomplete="cc-csc"]', '#cardCvc', 'input[name="cvc"]'],
  },
  {
    name: 'cardholder name',
    value: 'Test Teacher',
    required: false,
    selectors: ['input[autocomplete="cc-name"]', '#billingName', 'input[name="billingName"]'],
  },
  {
    name: 'postal code',
    value: '10001',
    required: false,
    selectors: [
      'input[autocomplete="postal-code"]',
      '#billingPostalCode',
      'input[name="postalCode"]',
    ],
  },
] as const;

async function findInFrames(
  page: Page,
  selectors: readonly string[],
): Promise<Locator | undefined> {
  for (const frame of page.frames()) {
    for (const selector of selectors) {
      const candidate = frame.locator(selector).first();
      if (await candidate.isVisible().catch(() => false)) return candidate;
    }
  }
  return undefined;
}

async function waitForField(page: Page, selectors: readonly string[], timeout: number) {
  let input: Locator | undefined;
  await expect
    .poll(async () => (input = await findInFrames(page, selectors)) !== undefined, { timeout })
    .toBe(true)
    .catch(() => undefined);
  return input;
}

/** Pays on Stripe's hosted Checkout with its documented test card. */
async function payWithTestCard(page: Page): Promise<void> {
  const [cardNumber] = cardFields;
  // Checkout may list payment methods as an accordion whose Card entry starts collapsed.
  if (!(await waitForField(page, cardNumber.selectors, 5_000))) {
    await page.getByTestId('card-accordion-item-button').dispatchEvent('click');
  }
  for (const field of cardFields) {
    const input = await waitForField(page, field.selectors, field.required ? 30_000 : 1_000);
    if (field.required && !input) throw new Error(`Stripe Checkout ${field.name} field not found`);
    await input?.pressSequentially(field.value, { delay: 30 });
  }
  const postalCode = page.getByRole('textbox', { name: /ZIP|postal/i }).first();
  if ((await postalCode.isVisible().catch(() => false)) && (await postalCode.inputValue()) === '') {
    await postalCode.fill('10001');
  }
  // "Save my info with Link" requires a phone number when ticked; this test pays without Link.
  const saveWithLink = page.locator('#enableStripePass');
  if (await saveWithLink.isChecked().catch(() => false)) await saveWithLink.dispatchEvent('click');
  await page.getByTestId('hosted-payment-submit-button').click();
}

// On failure, list every frame's form controls in the job log, so a changed Checkout layout can be
// diagnosed without downloading the report.
test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus) return;
  const lines: string[] = [`Failed on ${page.url()}`];
  for (const frame of page.frames()) {
    const controls = await frame
      .locator('input, select, button')
      .evaluateAll((elements) =>
        elements.map((element) =>
          ['id', 'name', 'autocomplete', 'aria-label', 'data-testid', 'type']
            .map((attribute) => {
              const value = element.getAttribute(attribute);
              return value ? `${attribute}=${value}` : '';
            })
            .filter(Boolean)
            .join(' '),
        ),
      )
      .catch(() => ['(frame not readable)']);
    lines.push(
      `Frame ${frame.name() || '(main)'} ${frame.url().slice(0, 80)}`,
      ...controls.map((c) => `  ${c}`),
    );
  }
  console.log(lines.join('\n'));
});

// Build step 4 gate, against real Stripe test mode: sign up → school created → buy a plan.
test('a teacher signs up and buys the Individual monthly plan on Stripe Checkout', async ({
  page,
}) => {
  const t = createTranslator('en');
  await signUp(page, 'en');
  await expect(page.getByTestId('school-name')).toHaveText(t('defaults.schoolName'));

  await page.getByRole('link', { name: t('nav.billing') }).click();
  const plan = t('plans.individual_monthly');
  await page
    .getByRole('form', { name: plan })
    .getByRole('button', { name: t('billing.choose', { plan }) })
    .click();
  await page.waitForURL(/checkout\.stripe\.com/);
  await page.getByTestId('hosted-payment-submit-button').waitFor();
  await payWithTestCard(page);

  await page.waitForURL(/\/en\/app\/billing\?checkout=success/, { timeout: 60_000 });
  // The plan changes when Stripe's webhook arrives through `stripe listen`.
  await expect(async () => {
    await page.goto('/en/app');
    await expect(page.getByTestId('plan-badge')).toHaveText(plan, { timeout: 2_000 });
  }).toPass({ timeout: 60_000 });
});
