// Small, safe Markdown renderer for AI output: headings, bullet/numbered lists, paragraphs, **bold**, *italic*, `code`.
// It builds React elements, never HTML strings, so model output cannot inject markup.
import { Fragment, type ReactNode } from "react";

function inline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const t = m[0];
    if (t.startsWith("**")) parts.push(<strong key={m.index}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith("`")) parts.push(<code key={m.index} className="rounded bg-neutral-100 px-1 text-[0.9em] dark:bg-[#2a2a2e]">{t.slice(1, -1)}</code>);
    else parts.push(<em key={m.index}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push(
        <h3 key={i} className="mt-4 mb-1 font-bold first:mt-0">
          {inline(heading[2])}
        </h3>,
      );
      i++;
      continue;
    }
    const listRe = /^\s*([-*•]|\d+[.)])\s+(.*)$/;
    if (listRe.test(line)) {
      const ordered = /^\s*\d/.test(line);
      const items: ReactNode[] = [];
      while (i < lines.length && listRe.test(lines[i])) {
        items.push(<li key={i}>{inline(listRe.exec(lines[i])![2])}</li>);
        i++;
      }
      const cls = `my-2 space-y-1 pl-5 ${ordered ? "list-decimal" : "list-disc"}`;
      blocks.push(ordered ? <ol key={`l${i}`} className={cls}>{items}</ol> : <ul key={`l${i}`} className={cls}>{items}</ul>);
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4})\s/.test(lines[i]) && !listRe.test(lines[i])) {
      para.push(lines[i].trim());
      i++;
    }
    blocks.push(
      <p key={`p${i}`} className="my-2">
        {inline(para.join(" "))}
      </p>,
    );
  }
  return <div className="text-[15px] leading-relaxed">{blocks.map((b, k) => <Fragment key={k}>{b}</Fragment>)}</div>;
}
