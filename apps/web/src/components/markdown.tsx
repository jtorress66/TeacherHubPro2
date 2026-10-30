import { parseMarkdown, type Block, type Inline } from '../server/markdown.ts';

function Inlines({ items }: { readonly items: readonly Inline[] }) {
  return (
    <>
      {items.map((item, index) => {
        if (item.kind === 'text') return <span key={index}>{item.text}</span>;
        if (item.kind === 'blank') return <span key={index} className="blank" aria-label="blank" />;
        const Tag = item.kind === 'strong' ? 'strong' : 'em';
        return (
          <Tag key={index}>
            <Inlines items={item.children} />
          </Tag>
        );
      })}
    </>
  );
}

function BlockView({ block }: { readonly block: Block }) {
  switch (block.kind) {
    case 'heading': {
      const Tag = (['h3', 'h4', 'h5'] as const)[block.level - 1] ?? 'h5';
      return (
        <Tag>
          <Inlines items={block.content} />
        </Tag>
      );
    }
    case 'list': {
      const Tag = block.ordered ? 'ol' : 'ul';
      return (
        <Tag>
          {block.items.map((item, index) => (
            <li key={index}>
              <Inlines items={item} />
            </li>
          ))}
        </Tag>
      );
    }
    case 'table':
      return (
        <table className="md-table">
          {block.header ? (
            <thead>
              <tr>
                {block.header.map((cell, index) => (
                  <th key={index} scope="col">
                    <Inlines items={cell} />
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
                    <Inlines items={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    case 'paragraph':
      return (
        <p>
          {block.lines.map((line, index) => (
            <span key={index}>
              {index > 0 ? <br /> : null}
              <Inlines items={line} />
            </span>
          ))}
        </p>
      );
  }
}

/** Plan text with its tables, lists and blanks, rendered as elements (never as raw HTML). */
export function Markdown({ source }: { readonly source: string | null | undefined }) {
  if (!source) return null;
  return (
    <div className="markdown">
      {parseMarkdown(source).map((block, index) => (
        <BlockView key={index} block={block} />
      ))}
    </div>
  );
}
