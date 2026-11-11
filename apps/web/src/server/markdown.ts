// The Markdown parser lives in the domain, so documents made for Canva read text the same way.
export {
  parseInline,
  parseMarkdown,
  type MarkdownBlock as Block,
  type MarkdownInline as Inline,
} from '@thp/domain';
