import { useTournament } from '@/context/TournamentContext';
import { useTheme } from '@/hooks/useTheme';

export function TopBar() {
  const { state, ui, setPage, setShowLogin, logout } = useTournament();
  const { theme, toggle } = useTheme();
  const canPrint = ui.page === 'admin';

  const openAcesso = () => {
    if (ui.isAdmin) {
      setPage('admin');
    } else {
      setShowLogin(true);
    }
  };

  const pills: { page: typeof ui.page | 'admin'; label: string; warn?: boolean }[] = [
    { page: 'principal', label: 'Chaves' },
    ...(ui.showPlacementBrackets ? [{ page: 'disputas' as const, label: 'Posições' }] : []),
    { page: 'geral', label: 'Classificação geral' },
  ];

  return (
    <header className="sticky top-0 z-40 flex justify-between items-center gap-3.5 flex-wrap px-4 py-3.5 bg-topbar text-white shadow-topbar backdrop-blur-[12px]">
      <div className="flex min-w-0 flex-1 gap-3 items-center">
        <img
          src="/images/logo-fbt.png"
          alt="FBT"
          className="topbar-logo shrink-0 object-contain object-center"
        />
        <div className="min-w-0 flex-1">
          <div className="font-extrabold text-lg leading-tight topbar-title break-words">{state.event.title}</div>
          <div className="text-xs mt-1 topbar-info">
            <span className="topbar-info-local">{state.event.local}</span>
            <span className="topbar-info-sep" aria-hidden="true">
              {' · '}
            </span>
            <span className="topbar-info-arbitro">Árbitro Geral: {state.event.arbitroGeral}</span>
          </div>
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
          type="button"
          onClick={openAcesso}
          className={`topbar-access-logo ${ui.page === 'admin' ? 'active' : ''}`}
          aria-label="Acesso ao painel de administração"
          title="Acesso"
        >
          <img src="/images/logo-mr.png" alt="" width={40} height={40} decoding="async" className="topbar-access-logo-img" />
        </button>
        {ui.isAdmin && (
          <button
            type="button"
            className="pill topbar-logout-pill"
            onClick={() => logout()}
            aria-label="Sair do modo administrativo"
            title="Encerrar acesso administrativo"
          >
            Sair
          </button>
        )}
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
