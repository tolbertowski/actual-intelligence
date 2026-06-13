import { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

// Renders card text that mixes prose with LaTeX. We support inline math
// delimited by single `$...$` and display math by `$$...$$`. Anything outside
// delimiters is treated as plain text (with newlines preserved). No Markdown —
// card content is text + LaTeX only, by design (v1 scope).

interface Segment {
  type: 'text' | 'inline' | 'display';
  value: string;
}

// Split on $$...$$ first (display), then $...$ (inline). A backslash-escaped
// \$ is treated as a literal dollar sign, not a delimiter.
function tokenise(input: string): Segment[] {
  const segments: Segment[] = [];
  let i = 0;
  let buf = '';

  const flushText = () => {
    if (buf) {
      segments.push({ type: 'text', value: buf });
      buf = '';
    }
  };

  while (i < input.length) {
    const ch = input[i];

    if (ch === '\\' && input[i + 1] === '$') {
      buf += '$';
      i += 2;
      continue;
    }

    if (ch === '$') {
      const display = input[i + 1] === '$';
      const delim = display ? '$$' : '$';
      const start = i + delim.length;
      const end = input.indexOf(delim, start);
      if (end !== -1) {
        flushText();
        segments.push({
          type: display ? 'display' : 'inline',
          value: input.slice(start, end),
        });
        i = end + delim.length;
        continue;
      }
    }

    buf += ch;
    i += 1;
  }

  flushText();
  return segments;
}

function renderMath(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(tex, {
      displayMode,
      throwOnError: false,
      output: 'htmlAndMathml',
    });
  } catch {
    return tex;
  }
}

interface RichTextProps {
  children: string;
  /** Render with the reading serif (used for card faces). */
  serif?: boolean;
  className?: string;
}

export function RichText({ children, serif, className }: RichTextProps) {
  const html = useMemo(() => {
    return tokenise(children)
      .map((seg) => {
        if (seg.type === 'text') {
          // Escape HTML in plain text, keep line breaks.
          const escaped = seg.value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br />');
          return escaped;
        }
        return renderMath(seg.value, seg.type === 'display');
      })
      .join('');
  }, [children]);

  return (
    <span
      className={className}
      style={serif ? { fontFamily: 'var(--font-serif)' } : undefined}
      // KaTeX output is sanitised by the library; our text is HTML-escaped above.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
