import { Icon } from '@/ui/Icon'

export function SearchInput({ value, onChange, placeholder = 'Sök övning' }: {
  value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <div className="relative">
      <Icon name="search" size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        enterKeyHint="search"
        autoComplete="off"
        className="h-12 w-full rounded-[var(--radius-control)] border border-line bg-sunken pl-10 pr-10 text-fg placeholder:text-faint transition-colors focus:border-accent/70 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button type="button" aria-label="Rensa sökning" onClick={() => onChange('')}
          className="absolute right-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full text-faint hover:text-fg">
          <Icon name="x" size={16} />
        </button>
      )}
    </div>
  )
}
