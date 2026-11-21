import { createTranslator, type Locale } from '@thp/i18n';
import { parseMarkdown, type Block, type Inline } from '../server/markdown.ts';
import { TableScroll } from './table-scroll.tsx';

/** A blank to fill in is a line on the page, named for screen readers in the page's language. */
function Inlines({ items, blank }: { readonly items: readonly Inline[]; readonly blank: string }) {
  return (
    <>
      {items.map((item, index) => {
        if (item.kind === 'text') return <span key={index}>{item.text}</span>;
        if (item.kind === 'blank') {
          return <span key={index} className="blank" role="img" aria-label={blank} />;
        }
        const Tag = item.kind === 'strong' ? 'strong' : 'em';
        return (
          <Tag key={index}>
            <Inlines items={item.children} blank={blank} />
          </Tag>
        );
      })}
    </>
  );
}

function BlockView({ block, blank }: { readonly block: Block; readonly blank: string }) {
  switch (block.kind) {
    case 'heading': {
      const Tag = (['h3', 'h4', 'h5'] as const)[block.level - 1] ?? 'h5';
      return (
        <Tag>
          <Inlines blank={blank} items={block.content} />
        </Tag>
      );
    }
    case 'list': {
      const Tag = block.ordered ? 'ol' : 'ul';
      return (
        <Tag start={block.ordered && block.start !== 1 ? block.start : undefined}>
          {block.items.map((item, index) => (
            <li key={index}>
              <Inlines blank={blank} items={item} />
            </li>
          ))}
        </Tag>
      );
    }
    case 'table':
      return (
        <TableScroll>
          <table className="md-table">
            {block.header ? (
              <thead>
                <tr>
                  {block.header.map((cell, index) => (
                    <th key={index} scope="col">
                      <Inlines blank={blank} items={cell} />
                    </th>
                  ))}
                </tr>
              </thead>
            ) : null}
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c}>
                      <Inlines blank={blank} items={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      );
    case 'rule':
      return <hr />;
    case 'paragraph':
      return (
        <p>
          {block.lines.map((line, index) => (
            <span key={index}>
              {index > 0 ? <br /> : null}
              <Inlines blank={blank} items={line} />
            </span>
          ))}
        </p>
      );
  }
}

/** Plan text with its tables, lists and blanks, rendered as elements (never as raw HTML). */
export function Markdown({
  source,
  locale,
}: {
  readonly source: string | null | undefined;
  readonly locale: Locale;
}) {
  if (!source) return null;
  const blank = createTranslator(locale)('assistant.blank');
  return (
    <div className="markdown">
      {parseMarkdown(source).map((block, index) => (
        <BlockView key={index} block={block} blank={blank} />
      ))}
    </div>
  );
}
