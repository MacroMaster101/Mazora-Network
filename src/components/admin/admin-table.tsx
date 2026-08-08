import type { ReactNode } from "react";

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  align?: "left" | "right";
}

/** Simple admin table. Client-safe — has no server-only dependencies. */
export function AdminTable<T>({ columns, rows }: { columns: Column<T>[]; rows: T[] }) {
  return (
    <div className="panel overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-widest text-muted">
            {columns.map((c) => (
              <th key={c.header} className={`px-4 py-3 font-medium ${c.align === "right" ? "text-right" : ""}`}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-line/60 last:border-0 hover:bg-ink/[0.02]">
              {columns.map((c) => (
                <td key={c.header} className={`px-4 py-3 ${c.align === "right" ? "text-right" : ""}`}>
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
