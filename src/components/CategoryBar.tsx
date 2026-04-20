import { useTournament } from '@/context/TournamentContext';

export function CategoryBar() {
  const { state, ui, setCategory, getCategory } = useTournament();

  if (ui.page === 'geral') return null;

  return (
    <div className="category-bar-wrap relative z-10 overflow-auto whitespace-nowrap bg-white/95 border-b border-line shadow-[0_4px12px_rgba(15,23,42,0.04)] scrollbar-hide">
      {state.categoryOrder.map(id => {
        const cat = getCategory(id);
        return (
          <span
            key={id}
            onClick={() => setCategory(id)}
            className={`tab ${ui.categoryId === id ? 'active' : ''}`}
          >
            {cat.name}
          </span>
        );
      })}
    </div>
  );
}
