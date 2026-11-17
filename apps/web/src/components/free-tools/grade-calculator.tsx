'use client';

import { useState } from 'react';
import { calculateGrade, parseScores, standardCategories } from '@thp/domain';
import { createTranslator, type Locale } from '@thp/i18n';

interface Row {
  readonly name: string;
  readonly weight: string;
  readonly scores: string;
}

const maxCategories = 10;

/** The free grade calculator: everything is worked out in the browser as the teacher types. */
export function GradeCalculator(props: { readonly locale: Locale }) {
  const t = createTranslator(props.locale);
  const [rows, setRows] = useState<Row[]>(
    standardCategories.map(({ key, weightPercent }) => ({
      name: t(`gradebook.standard_${key}`),
      weight: String(weightPercent),
      scores: '',
    })),
  );
  const parsed = rows.map((row) => parseScores(row.scores));
  const result = calculateGrade(
    rows.map((row, index) => ({
      weightPercent: Number(row.weight.replace(',', '.')) || 0,
      scores: parsed[index]?.scores ?? [],
    })),
  );
  const decimal = new Intl.NumberFormat(props.locale, { maximumFractionDigits: 1 });
  const gpa = new Intl.NumberFormat(props.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const change = (index: number, field: keyof Row, value: string) => {
    setRows(rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  return (
    <div className="free-tool grade-calculator">
      <div className="stack">
        {rows.map((row, index) => {
          const n = index + 1;
          const unread = parsed[index]?.unread ?? 0;
          return (
            <fieldset key={index} className="card free-category">
              <legend>{t('marketing.freeTools.category', { n })}</legend>
              <div className="field-row">
                <label>
                  {t('marketing.freeTools.name')}
                  <input
                    value={row.name}
                    onChange={(event) => {
                      change(index, 'name', event.target.value);
                    }}
                  />
                </label>
                <label>
                  {t('marketing.freeTools.weight')}
                  <input
                    type="number"
                    min={0}
                    max={100}
                    inputMode="decimal"
                    value={row.weight}
                    onChange={(event) => {
                      change(index, 'weight', event.target.value);
                    }}
                  />
                </label>
              </div>
              <label>
                {t('marketing.freeTools.scores')}
                <textarea
                  rows={3}
                  value={row.scores}
                  aria-describedby={`scores-hint-${String(n)}`}
                  onChange={(event) => {
                    change(index, 'scores', event.target.value);
                  }}
                />
              </label>
              <p className="hint" id={`scores-hint-${String(n)}`}>
                {t('marketing.freeTools.scoresHint')}
              </p>
              {unread > 0 ? (
                <p className="hint">{t('marketing.freeTools.unread', { count: unread })}</p>
              ) : null}
              {rows.length > 1 ? (
                <button
                  type="button"
                  className="link-button"
                  aria-label={`${t('marketing.freeTools.removeCategory')}: ${row.name}`}
                  onClick={() => {
                    setRows(rows.filter((_, i) => i !== index));
                  }}
                >
                  {t('marketing.freeTools.removeCategory')}
                </button>
              ) : null}
            </fieldset>
          );
        })}
        {rows.length < maxCategories ? (
          <p>
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                setRows([
                  ...rows,
                  {
                    name: t('marketing.freeTools.category', { n: rows.length + 1 }),
                    weight: '0',
                    scores: '',
                  },
                ]);
              }}
            >
              {t('marketing.freeTools.addCategory')}
            </button>
          </p>
        ) : null}
      </div>
      <section
        className="card free-result"
        aria-labelledby="grade-result-heading"
        aria-live="polite"
        data-testid="grade-result"
      >
        <h2 id="grade-result-heading">{t('marketing.freeTools.result')}</h2>
        {result === null ? (
          <p className="muted">{t('marketing.freeTools.empty')}</p>
        ) : (
          <>
            <p className="free-big">{decimal.format(result.percentage)}%</p>
            <dl className="free-facts">
              <div>
                <dt>{t('marketing.freeTools.letter')}</dt>
                <dd>{result.letter}</dd>
              </div>
              <div>
                <dt>{t('marketing.freeTools.gpa')}</dt>
                <dd>{gpa.format(result.gpa)}</dd>
              </div>
            </dl>
            <ul className="free-averages">
              {rows.map((row, index) => {
                const average = result.categories[index] ?? null;
                return (
                  <li key={index}>
                    <b>{row.name}</b>{' '}
                    {average === null
                      ? t('marketing.freeTools.noScores')
                      : t('marketing.freeTools.average', { percent: decimal.format(average) })}
                  </li>
                );
              })}
            </ul>
            {Math.abs(result.weightTotal - 100) > 0.001 ? (
              <p className="notice">
                {t('marketing.freeTools.weightWarning', {
                  total: decimal.format(result.weightTotal),
                })}
              </p>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
