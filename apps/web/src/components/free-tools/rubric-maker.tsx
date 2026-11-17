'use client';

import { useState } from 'react';
import {
  blankRubricDetails,
  maxRubricPoints,
  rubricAsText,
  rubricCriteriaRange,
  rubricLevelRange,
  type RubricCriterion,
  type RubricLevel,
} from '@thp/domain';
import { createTranslator, type Locale } from '@thp/i18n';
import { RubricGrid } from '../rubric-grid.tsx';

/** The free rubric maker: the app's rubric grid, printed or copied instead of saved. */
export function RubricMaker(props: { readonly locale: Locale }) {
  const t = createTranslator(props.locale);
  const [blank] = useState(() =>
    blankRubricDetails({
      title: t('marketing.freeTools.rubricTitleDefault'),
      criteriaCount: rubricCriteriaRange.default,
      levelCount: rubricLevelRange.default,
      levelLabel: (points) => t('rubrics.levelName', { points }),
      criterionName: (position) => t('rubrics.criterionName', { position }),
    }),
  );
  const [title, setTitle] = useState(blank.title);
  const [levels, setLevels] = useState<RubricLevel[]>([...blank.levels]);
  const [criteria, setCriteria] = useState<RubricCriterion[]>([...blank.criteria]);
  const [copied, setCopied] = useState(false);
  const total = t('rubrics.total', { points: maxRubricPoints({ levels, criteria }) });

  return (
    <div className="free-tool stack">
      <div className="no-print stack">
        <label>
          {t('marketing.freeTools.rubricTitle')}
          <input
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
            }}
          />
        </label>
        <RubricGrid
          locale={props.locale}
          levels={levels}
          criteria={criteria}
          onLevels={setLevels}
          onCriteria={setCriteria}
        />
        <p className="muted" data-testid="rubric-total">
          {total}
        </p>
        <p className="actions">
          <button
            type="button"
            className="button"
            onClick={() => {
              window.print();
            }}
          >
            {t('marketing.freeTools.print')}
          </button>
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              void navigator.clipboard
                .writeText(`${title}\n\n${rubricAsText({ levels, criteria })}`)
                .then(() => {
                  setCopied(true);
                });
            }}
          >
            {t('marketing.freeTools.copy')}
          </button>
        </p>
        <p role="status">{copied ? t('marketing.freeTools.copied') : ''}</p>
      </div>
      {/* What the printer gets: the grid as plain text, without the editing fields. */}
      <div className="print-only" aria-hidden="true">
        <h2>{title}</h2>
        <table className="rubric-print">
          <thead>
            <tr>
              <th>{t('rubrics.criterion')}</th>
              {levels.map((level, i) => (
                <th key={i}>
                  {level.label} ({level.points})
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {criteria.map((row, r) => (
              <tr key={r}>
                <th>{row.name}</th>
                {levels.map((_, c) => (
                  <td key={c}>{row.descriptors[c] ?? ''}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p>{total}</p>
      </div>
    </div>
  );
}
