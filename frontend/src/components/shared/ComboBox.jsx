import { useState, useRef, useEffect } from 'react';
import { ChevronDown, X } from 'lucide-react';

/**
 * Combobox con búsqueda. Dos modos:
 * - Cliente: filtra `options` internamente según lo que escribe el usuario.
 * - Servidor: llama `onSearch(query)` y usa `options` ya filtradas externamente.
 *
 * Props:
 *   options    [{value, label, meta?, sublabel?}]
 *   onSearch   (query: string) => void   — omitir para modo cliente
 *   onSelect   (option | null) => void
 *   displayValue  string  — texto controlado cuando hay selección
 *   loading    bool
 *   disabled   bool
 *   placeholder string
 *   className  string
 */
export default function ComboBox({
  placeholder = 'Buscar...',
  options = [],
  onSearch,
  onSelect,
  displayValue = '',
  loading = false,
  disabled = false,
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(displayValue);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { setQuery(displayValue); }, [displayValue]);

  const visible = onSearch
    ? options
    : options.filter(o => {
        if (!query) return true;
        const q = query.toLowerCase();
        return (
          o.label.toLowerCase().includes(q) ||
          (o.meta != null && String(o.meta).toLowerCase().includes(q))
        );
      });

  function handleSelect(opt) {
    setQuery(opt.label);
    setOpen(false);
    onSelect(opt);
  }

  function handleClear() {
    setQuery('');
    setOpen(false);
    onSelect(null);
    inputRef.current?.focus();
  }

  useEffect(() => {
    function onOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={query}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          onChange={e => {
            const v = e.target.value;
            setQuery(v);
            setOpen(true);
            if (onSearch) onSearch(v);
            if (!v) onSelect(null);
          }}
          onFocus={() => {
            setOpen(true);
            if (onSearch && !query) onSearch('');
          }}
          className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-xl text-sm
                     focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary
                     disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
        />
        {query && !disabled ? (
          <button type="button" onClick={handleClear}
            className="absolute right-3 text-gray-400 hover:text-gray-600 p-1 -mr-0.5 touch-manipulation">
            <X size={14} />
          </button>
        ) : (
          <ChevronDown size={14} className="absolute right-3 text-gray-400 pointer-events-none" />
        )}
      </div>

      {open && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white rounded-xl border border-gray-200 shadow-xl overflow-hidden">
          <div className="max-h-64 overflow-y-auto overscroll-contain">
            {loading ? (
              <p className="px-4 py-3 text-sm text-gray-400 text-center">Buscando...</p>
            ) : visible.length === 0 ? (
              <p className="px-4 py-3 text-sm text-gray-400 text-center">
                {onSearch && query.length < 2
                  ? 'Escribe al menos 2 caracteres para buscar'
                  : 'Sin resultados'}
              </p>
            ) : visible.slice(0, 80).map((opt, i) => (
              <button
                key={i}
                type="button"
                onMouseDown={e => { e.preventDefault(); handleSelect(opt); }}
                className="w-full text-left px-4 py-3 hover:bg-primary/5 active:bg-primary/10
                           border-b border-gray-50 last:border-0 flex items-baseline gap-3
                           touch-manipulation"
              >
                {opt.meta != null && (
                  <span className="font-mono text-xs text-gray-400 shrink-0 min-w-[3.5rem]">
                    {opt.meta}
                  </span>
                )}
                <span className="text-sm text-gray-800 leading-tight">{opt.label}</span>
                {opt.sublabel && (
                  <span className="text-xs text-gray-400 ml-auto shrink-0">{opt.sublabel}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
