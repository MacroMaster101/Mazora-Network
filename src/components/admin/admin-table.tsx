import type { ReactNode } from "react";

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  align?: "left" | "right";
}

/**
 * Simple admin table. Client-safe — has no server-only dependencies.
 *
 * Renders as cards on phones and as a table from md up. The page cannot scroll
 * sideways (body is overflow-x:hidden), so the 560px minimum made every
 * consumer of this component a box to swipe rather than a list to read. Doing
 * the conversion here rather than per page means each caller gets it from the
 * column definitions it already declares.
 */
export function AdminTable<T>({ columns, rows }: { columns: Column<T>[]; rows: T[] }) {
  const [lead, ...rest] = columns;

  return (
    <>
      <div className="grid gap-2.5 md:hidden">
        {rows.map((row, i) => (
          <article key={i} className="panel grid gap-2 p-3.5">
            {/* The first column is the row's identity in every caller, so it
                leads the card instead of being labelled like the others. */}
            {lead && <div className="min-w-0 break-words font-semibold">{lead.cell(row)}</div>}

            {rest.length > 0 && (
              <dl className="grid gap-1.5 border-t border-line/60 pt-2.5">
                {rest.map((c, ci) =>
                  // A blank header is an actions column: it gets the full width
                  // rather than an empty label sitting beside it.
                  c.header.trim() ? (
                    <div key={ci} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <dt className="text-[10px] font-bold uppercase tracking-wider text-muted">{c.header}</dt>
                      <dd className="min-w-0 break-words text-sm">{c.cell(row)}</dd>
                    </div>
                  ) : (
                    <div key={ci} className="flex flex-wrap items-center justify-end gap-2">
                      {c.cell(row)}
                    </div>
                  ),
                )}
              </dl>
            )}
          </article>
        ))}
      </div>

      <div className="panel hidden overflow-x-auto md:block">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-widest text-muted">
              {columns.map((c, ci) => (
                <th key={ci} className={`px-4 py-3 font-medium ${c.align === "right" ? "text-right" : ""}`}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-line/60 last:border-0 hover:bg-ink/[0.02]">
                {columns.map((c, ci) => (
                  <td key={ci} className={`px-4 py-3 ${c.align === "right" ? "text-right" : ""}`}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
