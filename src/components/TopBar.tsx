import { Upload } from 'lucide-react';

export type WorkspaceSection = 'manuscript' | 'cast' | 'samples' | 'export';

interface TopBarProps {
  activeSection: WorkspaceSection;
  onSelectSection: (section: WorkspaceSection) => void;
  onOpenImport: () => void;
}

const NAV_ITEMS: Array<{ id: WorkspaceSection; label: string }> = [
  { id: 'manuscript', label: 'Manuscript' },
  { id: 'cast', label: 'Cast & Voices' },
  { id: 'samples', label: 'Samples' },
  { id: 'export', label: 'Export' },
];

export function TopBar({
  activeSection,
  onSelectSection,
  onOpenImport,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-8 px-4 py-3.5 sm:px-6">
        <a
          href="#manuscript"
          onClick={(e) => {
            e.preventDefault();
            onSelectSection('manuscript');
          }}
          className="font-display text-lg font-bold tracking-tight text-zinc-900 whitespace-nowrap shrink-0"
        >
          TableRead
        </a>

        <nav
          aria-label="Primary sections"
          className="hidden md:flex items-center gap-7"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onSelectSection(item.id)}
                className={`relative py-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 rounded-sm ${
                  isActive
                    ? 'text-zinc-950'
                    : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 -bottom-[15px] h-0.5 bg-blue-600"
                  />
                )}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onOpenImport}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 whitespace-nowrap shrink-0"
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            <span>Import Script</span>
          </button>
        </div>
      </div>

      {/* Mobile workspace section switcher (non-overflowing single row) */}
      <nav
        aria-label="Mobile sections"
        className="flex md:hidden items-center gap-1 overflow-x-auto border-t border-zinc-100 px-4 py-2"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onSelectSection(item.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                isActive
                  ? 'bg-zinc-900 text-white'
                  : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
