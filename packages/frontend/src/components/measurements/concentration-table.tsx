"use client";

interface ConcentrationTableProps {
  elements: Record<string, number>;
  unit?: string;
}

// Display order for known elements (most relevant for brine analysis first)
const ELEMENT_ORDER = ["Fe", "Cu", "Zn", "Pb", "Ni", "Ca", "Si", "S", "Mn", "Cr"];

export function ConcentrationTable({
  elements,
  unit = "g/L",
}: ConcentrationTableProps) {
  const entries = Object.entries(elements).sort(([a], [b]) => {
    const ai = ELEMENT_ORDER.indexOf(a);
    const bi = ELEMENT_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  return (
    <div className="rounded-2xl border border-white/10 bg-black/60 backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">
          Concentraciones Cuantificadas
        </h2>
        <span className="font-mono text-[10px] text-slate-500">{unit}</span>
      </div>

      <div className="overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Elemento
              </th>
              <th className="px-4 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Concentración
              </th>
              <th className="px-4 py-2 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500 w-[35%]">
                Nivel
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map(([element, value]) => {
              const max = Math.max(...Object.values(elements));
              const pct = max > 0 ? (value / max) * 100 : 0;
              return (
                <tr
                  key={element}
                  className="border-b border-white/5 transition-colors last:border-b-0 hover:bg-white/[0.03]"
                >
                  <td className="px-4 py-2.5">
                    <span className="font-mono text-sm font-bold tracking-wide text-amber-300">
                      {element}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className="font-mono text-sm font-semibold text-slate-100 tabular-nums">
                      {value.toFixed(value < 1 ? 3 : 2)}
                    </span>
                    <span className="ml-1 text-[10px] text-slate-500">
                      {unit}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="ml-auto h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-600 to-amber-400"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
