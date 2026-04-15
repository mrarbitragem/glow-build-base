import { useTournament } from '@/context/TournamentContext';
import { useTheme } from '@/hooks/useTheme';

export function TopBar() {
  const { state, ui, setPage, setShowLogin } = useTournament();
  const { theme, toggle } = useTheme();
  const canPrint = ui.page === 'admin';

  const openAdmin = () => {
    if (ui.isAdmin) {
      setPage('admin');
    } else {
      setShowLogin(true);
    }
  };

  const pills: { page: typeof ui.page | 'admin'; label: string; warn?: boolean }[] = [
    { page: 'principal', label: 'Principal' },
    { page: 'disputas', label: 'Posições' },
    { page: 'geral', label: 'Classificação geral' },
  ];

  return (
    <header className="sticky top-0 z-40 flex justify-between items-center gap-3.5 flex-wrap px-4 py-3.5 bg-topbar text-white shadow-topbar backdrop-blur-[12px]">
      <div className="flex gap-3 items-center">
        <img src="/images/logo-mr.png" alt="Logo MR" className="w-12 h-12 rounded-[14px] object-contain" />
        <div>
          <div className="font-extrabold text-lg leading-tight topbar-title">{state.event.title}</div>
          <div className="text-xs mt-1 topbar-info">{state.event.local} · Árbitro Geral: {state.event.arbitroGeral}</div>
        </div>
      </div>
      <div className="flex gap-2 flex-wrap items-center topbar-pills">
        {pills.map(p => (
          <button
            key={p.page}
            onClick={() => setPage(p.page)}
            className={`pill ${ui.page === p.page ? 'active' : ''}`}
          >
            {p.label}
          </button>
        ))}
        <button
          onClick={openAdmin}
          className={`pill warn ${ui.page === 'admin' ? 'active' : ''}`}
        >
          {ui.isAdmin ? 'Admin' : 'Acesso'}
        </button>
        {canPrint && (
          <button className="pill print-btn" onClick={() => window.print()}>
            Imprimir
          </button>
        )}
        <button className="theme-toggle" onClick={toggle} title="Alternar tema">
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>
    </header>
  );
}
