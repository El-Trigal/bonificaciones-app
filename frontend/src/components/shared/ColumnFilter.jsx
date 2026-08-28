import { useEffect, useRef, useState } from 'react';
import { Filter, X } from 'lucide-react';

/**
 * Filtro multiselect para encabezados de tabla.
 *
 * Props:
 *  - label: texto del botón/columna (ej. "Fecha")
 *  - options: string[] | number[] valores únicos disponibles
 *  - selected: Set | array de valores seleccionados (vacío = sin filtro = todos)
 *  - onChange: (array) => void
 *  - width: ancho del dropdown
 */
export default function ColumnFilter({ label, options, selected = [], onChange, width = 'w-56' }) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState('');
  const ref = useRef(null);

  const sel = new Set(selected);
  const active = sel.size > 0;

  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const filtradas = options.filter((o) => String(o).toLowerCase().includes(busca.toLowerCase()));

  function toggle(v) {
    const n = new Set(sel);
    n.has(v) ? n.delete(v) : n.add(v);
    onChange(Array.from(n));
  }

  function seleccionarTodos() { onChange(filtradas.slice()); }
  function limpiar() { onChange([]); }

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1 text-left ${active ? 'text-primary font-semibold' : 'text-gray-600 hover:text-gray-900'}`}
      >
        <span className="truncate">{label}</span>
        <Filter size={12} className={active ? 'fill-current' : ''}/>
        {active && <span className="ml-1 bg-primary text-white rounded-full text-[9px] px-1.5">{sel.size}</span>}
      </button>
      {open && (
        <div className={`absolute left-0 top-full mt-1 ${width} bg-white border border-gray-200 rounded-lg shadow-lg z-30 normal-case`}>
          <div className="p-2 border-b">
            <input
              type="text" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar..."
              className="w-full px-2 py-1 border rounded text-xs"
              autoFocus
            />
            <div className="flex justify-between text-[11px] mt-1">
              <button onClick={seleccionarTodos} className="text-primary hover:underline">Seleccionar todos</button>
              {active && <button onClick={limpiar} className="text-gray-500 hover:text-red-600 flex items-center gap-1"><X size={10}/>Limpiar</button>}
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {filtradas.length === 0 ? (
              <div className="px-3 py-2 text-xs text-gray-400">Sin opciones</div>
            ) : filtradas.map((o) => (
              <label key={String(o)} className="flex items-center gap-2 px-3 py-1 hover:bg-gray-50 cursor-pointer text-xs">
                <input type="checkbox" checked={sel.has(o)} onChange={() => toggle(o)} className="rounded"/>
                <span className="truncate">{String(o)}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
