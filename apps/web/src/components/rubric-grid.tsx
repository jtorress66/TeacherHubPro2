'use client';

import {
  rubricCriteriaRange,
  rubricLevelRange,
  type RubricCriterion,
  type RubricLevel,
} from '@thp/domain';
import { createTranslator, type Locale } from '@thp/i18n';
import { TableScroll } from './table-scroll.tsx';

const resize = (list: readonly string[], length: number) =>
  Array.from({ length }, (_, index) => list[index] ?? '');

/**
 * The rubric grid: level names and points across the top, one row per criterion. It holds no
 * state of its own; the form around it does.
 */
export function RubricGrid(props: {
  readonly locale: Locale;
  readonly levels: readonly RubricLevel[];
  readonly criteria: readonly RubricCriterion[];
  readonly onLevels: (levels: RubricLevel[]) => void;
  readonly onCriteria: (criteria: RubricCriterion[]) => void;
}) {
  const t = createTranslator(props.locale);
  const { levels, criteria } = props;
  const setLevels = props.onLevels;
  const setCriteria = props.onCriteria;

  const setLevel = (index: number, change: Partial<RubricLevel>) => {
    setLevels(levels.map((level, i) => (i === index ? { ...level, ...change } : level)));
  };
  const setCriterion = (index: number, change: Partial<RubricCriterion>) => {
    setCriteria(criteria.map((row, i) => (i === index ? { ...row, ...change } : row)));
  };
  const setCell = (row: number, column: number, value: string) => {
    setCriterion(row, {
      descriptors: (criteria[row]?.descriptors ?? []).map((cell, i) =>
        i === column ? value : cell,
      ),
    });
  };
  const addLevel = () => {
    const lowest = levels.at(-1)?.points ?? 1;
    setLevels([
      ...levels,
      {
        label: t('rubrics.levelName', { points: Math.max(lowest - 1, 0) }),
        points: Math.max(lowest - 1, 0),
      },
    ]);
    setCriteria(
      criteria.map((row) => ({ ...row, descriptors: resize(row.descriptors, levels.length + 1) })),
    );
  };
  const removeLevel = (index: number) => {
    setLevels(levels.filter((_, i) => i !== index));
    setCriteria(
      criteria.map((row) => ({
        ...row,
        descriptors: row.descriptors.filter((_, i) => i !== index),
      })),
    );
  };
  const addCriterion = () => {
    setCriteria([
      ...criteria,
      {
        name: t('rubrics.criterionName', { position: criteria.length + 1 }),
        descriptors: resize([], levels.length),
      },
    ]);
  };

  return (
    <>
      <TableScroll>
        <table className="rubric-grid">
          <thead>
            <tr>
              <th scope="col">{t('rubrics.criterion')}</th>
              {levels.map((level, column) => (
                <th scope="col" key={column}>
                  <input
                    aria-label={t('rubrics.levelLabel', { n: column + 1 })}
                    value={level.label}
                    onChange={(event) => {
                      setLevel(column, { label: event.target.value });
                    }}
                  />
                  <input
                    type="number"
                    min={0}
                    aria-label={t('rubrics.levelPoints', { n: column + 1 })}
                    value={level.points}
                    onChange={(event) => {
                      setLevel(column, { points: Number(event.target.value) });
                    }}
                  />
                  {levels.length > rubricLevelRange.min ? (
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => {
                        removeLevel(column);
                      }}
                    >
                      {t('rubrics.removeLevel')}
                    </button>
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {criteria.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <th scope="row">
                  <input
                    aria-label={t('rubrics.criterionLabel', { n: rowIndex + 1 })}
                    value={row.name}
                    onChange={(event) => {
                      setCriterion(rowIndex, { name: event.target.value });
                    }}
                  />
                  {criteria.length > rubricCriteriaRange.min ? (
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => {
                        setCriteria(criteria.filter((_, i) => i !== rowIndex));
                      }}
                    >
                      {t('rubrics.removeCriterion')}
                    </button>
                  ) : null}
                </th>
                {levels.map((_, column) => (
                  <td key={column}>
                    <textarea
                      rows={3}
                      aria-label={t('rubrics.cell', {
                        criterion: row.name,
                        level: levels[column]?.label ?? '',
                      })}
                      value={row.descriptors[column] ?? ''}
                      onChange={(event) => {
                        setCell(rowIndex, column, event.target.value);
                      }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>
      <p className="actions">
        {criteria.length < rubricCriteriaRange.max ? (
          <button type="button" className="button secondary" onClick={addCriterion}>
            {t('rubrics.addCriterion')}
          </button>
        ) : null}
        {levels.length < rubricLevelRange.max ? (
          <button type="button" className="button secondary" onClick={addLevel}>
            {t('rubrics.addLevel')}
          </button>
        ) : null}
      </p>
    </>
  );
}
