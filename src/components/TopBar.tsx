import { useTournament } from '@/context/TournamentContext';

export function TopBar() {
  const { ui, setPage, setShowLogin } = useTournament();

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
        <div className="w-12 h-12 rounded-[14px] grid place-items-center bg-brand-mark font-extrabold shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
          BT
        </div>
        <div>
          <div className="font-extrabold text-lg leading-tight">Interclubes Local</div>
          <div className="text-xs opacity-70 mt-1">HTML local com chave principal, posições, classificação e administração visual</div>
        </div>
      </div>
      <div className="flex gap-2 flex-wrap">
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
          {ui.isAdmin ? 'Admin' : 'Entrar no admin'}
        </button>
      </div>
    </header>
  );
}
