import { useEffect } from 'react';
import { TournamentProvider, useTournament } from '@/context/TournamentContext';
import { TopBar } from '@/components/TopBar';
import { CategoryBar } from '@/components/CategoryBar';
import { LoginModal } from '@/components/LoginModal';
import { MatchModal } from '@/components/MatchModal';
import { PrincipalPage } from '@/pages/PrincipalPage';
import { EmAndamentoPage } from '@/pages/EmAndamentoPage';
import { DisputasPage } from '@/pages/DisputasPage';
import { GeralPage } from '@/pages/GeralPage';
import { AdminPage } from '@/pages/AdminPage';
import { AppFooter } from '@/components/AppFooter';

function AppContent() {
  const { ui, setPage } = useTournament();

  useEffect(() => {
    if (ui.page === 'disputas' && !ui.showPlacementBrackets) {
      setPage('principal');
    }
  }, [ui.page, ui.showPlacementBrackets, setPage]);

  return (
    <div className="app">
      <TopBar />
      <CategoryBar />
      <div className="app-body">
        {ui.page === 'principal' && <PrincipalPage />}
        {ui.page === 'emAndamento' && <EmAndamentoPage />}
        {ui.page === 'disputas' && <DisputasPage />}
        {ui.page === 'geral' && <GeralPage />}
        {ui.page === 'admin' && <AdminPage />}
      </div>
      <AppFooter />
      <LoginModal />
      <MatchModal />
    </div>
  );
}

const Index = () => (
  <TournamentProvider>
    <AppContent />
  </TournamentProvider>
);

export default Index;
