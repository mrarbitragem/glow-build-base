import { useRef } from 'react';
import { useTournament } from '@/context/TournamentContext';
import { evaluateStructure, countRealSeeds, scheduleLabel, collectMatches } from '@/utils/bracketEngine';
import { BracketView, BlockView } from '@/components/BracketView';
import { initials } from '@/utils/helpers';
import { fileToDataUrl } from '@/utils/helpers';
import { EvaluatedMatch } from '@/types/tournament';

function AdminSidebar() {
  const { state, ui, getCategory, setAdminPanel, setAdminMode, updateEvent, setSlotClub, addClub, editClub, changeClubFlag, removeClub, exportBackup, importBackup, resetAll, setRoundDefault } = useTournament();
  const category = getCategory(ui.categoryId);
  const clubNameRef = useRef<HTMLInputElement>(null);
  const clubFlagRef = useRef<HTMLInputElement>(null);

  const struct = evaluateStructure(category, state.clubs);

  // Collect visible rounds for schedule manager
  const scheduleMatches: EvaluatedMatch[] = [];
  if (ui.adminMode === 'main') {
    scheduleMatches.push(...struct.mainRounds.flat().filter(m => m.playable));
  } else {
    const walk = (block: any) => {
      if (block.rounds?.length) scheduleMatches.push(...block.rounds.flat().filter((m: EvaluatedMatch) => m.playable));
      block.children?.forEach(walk);
    };
    struct.placementBlocks.filter(b => b.startPlace >= 3).forEach(walk);
  }
  const seen = new Set<string>();
  const visibleRounds = scheduleMatches.filter(m => {
    if (seen.has(m.scheduleKey)) return false;
    seen.add(m.scheduleKey);
    return true;
  }).map(m => ({
    scheduleKey: m.scheduleKey,
    label: scheduleLabel(m),
    value: category.roundDefaults[m.scheduleKey] || ''
  }));

  const handleAddClub = async () => {
    const name = clubNameRef.current?.value || '';
    const file = clubFlagRef.current?.files?.[0];
    let flag = '';
    if (file) {
      try { flag = await fileToDataUrl(file); } catch {}
    }
    addClub(name, flag);
    if (clubNameRef.current) clubNameRef.current.value = '';
    if (clubFlagRef.current) clubFlagRef.current.value = '';
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const success = importBackup(reader.result as string);
      alert(success ? 'Backup importado com sucesso.' : 'Arquivo inválido.');
    };
    reader.readAsText(file);
  };

  const tabs: [string, string][] = [['operacao', 'Operação'], ['clubes', 'Clubes'], ['categoria', 'Categoria']];

  return (
    <div className="card panel admin-sidebar">
      <div className="admin-tabs">
        {tabs.map(([id, label]) => (
          <button key={id} className={`seg-btn ${ui.adminPanel === id ? 'active' : ''}`} onClick={() => setAdminPanel(id as any)}>
            {label}
          </button>
        ))}
      </div>

      {ui.adminPanel === 'operacao' && (
        <div className="stack">
          <h3>Operação</h3>
          <div className="helper">Painel principal da operação local.</div>
          <div className="field">
            <label className="label">Título</label>
            <input className="input" value={state.event.title} onChange={e => updateEvent('title', e.target.value)} />
          </div>
          <div className="field">
            <label className="label">Local</label>
            <input className="input" value={state.event.local} onChange={e => updateEvent('local', e.target.value)} />
          </div>
          <div className="field">
            <label className="label">Árbitro Geral</label>
            <input className="input" value={state.event.arbitroGeral} onChange={e => updateEvent('arbitroGeral', e.target.value)} />
          </div>
          <div className="field">
            <label className="label">Área da chave</label>
            <div className="footer-actions">
              <button className={`btn ${ui.adminMode === 'main' ? '' : 'secondary'}`} onClick={() => setAdminMode('main')}>Chave principal</button>
              <button className={`btn ${ui.adminMode === 'disputas' ? '' : 'secondary'}`} onClick={() => setAdminMode('disputas')}>Posições</button>
            </div>
          </div>

          {visibleRounds.length > 0 && (
            <div className="stack">
              <div className="helper">Programe a rodada inteira aqui.</div>
              <div className="round-schedule-list">
                {visibleRounds.map(r => (
                  <div key={r.scheduleKey} className="round-schedule-item">
                    <div>
                      <strong>{r.label}</strong>
                      <div className="helper">Aplicado a todos os confrontos jogáveis desta rodada.</div>
                    </div>
                    <input
                      type="datetime-local"
                      className="input"
                      value={r.value}
                      onChange={e => setRoundDefault(category.id, r.scheduleKey, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="footer-actions">
            <button className="btn secondary" onClick={exportBackup}>Exportar backup</button>
            <label className="btn ghost" style={{ cursor: 'pointer' }}>
              Importar backup
              <input type="file" accept="application/json" style={{ display: 'none' }} onChange={handleImport} />
            </label>
            <button className="btn danger" onClick={() => { if (confirm('Tem certeza que deseja resetar o sistema local?')) resetAll(); }}>Resetar tudo</button>
          </div>
        </div>
      )}

      {ui.adminPanel === 'clubes' && (
        <div className="stack">
          <h3>Clubes</h3>
          <div className="helper">Cadastre os clubes uma única vez.</div>
          <div className="field">
            <label className="label">Nome do clube</label>
            <input ref={clubNameRef} className="input" placeholder="Ex.: IATE CLUBE" />
          </div>
          <div className="field">
            <label className="label">Bandeira do clube</label>
            <input ref={clubFlagRef} type="file" accept="image/*" className="input" />
          </div>
          <button className="btn" onClick={handleAddClub}>Adicionar clube</button>
          <div className="stack">
            {state.clubs.map(club => (
              <div key={club.id} className="club-item">
                <div className="flag large">
                  {club.flag ? <img src={club.flag} alt={`Bandeira ${club.name}`} /> : initials(club.name)}
                </div>
                <div className="name">
                  <strong>{club.name}</strong>
                  <div className="helper">Cadastro central</div>
                </div>
                <button className="btn secondary small" onClick={() => {
                  const newName = prompt('Nome do clube:', club.name);
                  if (newName !== null) editClub(club.id, newName);
                }}>Renomear</button>
                <label className="btn ghost small upload-btn">
                  Bandeira
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const flag = await fileToDataUrl(file);
                      changeClubFlag(club.id, flag);
                    } catch { alert('Não foi possível carregar a imagem.'); }
                  }} />
                </label>
                <button className="btn danger small" onClick={() => { if (confirm('Remover clube do cadastro?')) removeClub(club.id); }}>Remover</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {ui.adminPanel === 'categoria' && (
        <div className="stack">
          <h3>Categoria</h3>
          <div className="helper">Nesta categoria, você só resgata clubes do cadastro central.</div>
          <div className="field">
            <label className="label">Categoria em edição</label>
            <input className="input" disabled value={category.name} />
          </div>
          <div className="slot-grid">
            {Array.from({ length: category.slots }).map((_, idx) => (
              <div key={idx} className="slot-item">
                <div className="name">Posição {idx + 1}</div>
                <select className="select" value={category.seeds[idx] || ''} onChange={e => setSlotClub(category.id, idx, e.target.value)}>
                  <option value="">BYE</option>
                  {state.clubs.map(club => (
                    <option key={club.id} value={club.id}>{club.name}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AdminCanvas() {
  const { state, ui, getCategory, selectMatch, openMatchModal } = useTournament();
  const category = getCategory(ui.categoryId);
  const struct = evaluateStructure(category, state.clubs);

  const handleMatchClick = (matchId: string) => {
    selectMatch(matchId);
    openMatchModal();
  };

  return (
    <div className="card panel canvas-panel">
      <div className="canvas-head">
        <div>
          <h3>Chave desenhada · {category.name}</h3>
          <div className="helper">Layout limpo para operação. Clique no confronto para abrir a janela flutuante de resultado.</div>
        </div>
        <div className="canvas-badges">
          <span className="mini-badge">{ui.adminMode === 'main' ? 'Principal' : 'Posições'}</span>
          <span className="mini-badge">{countRealSeeds(category.seeds)} clubes</span>
        </div>
      </div>

      {ui.adminMode === 'main' ? (
        <div className="bracket-box main">
          <BracketView
            rounds={struct.mainRounds}
            kind="main"
            scopeKey="main"
            finalTitle="Campeão da categoria"
            isAdmin
            selectedMatchId={ui.selectedMatchId}
            onMatchClick={handleMatchClick}
          />
        </div>
      ) : (
        struct.placementBlocks.filter(b => b.startPlace >= 3).map(block => (
          <BlockView
            key={block.key}
            block={block}
            isAdmin
            selectedMatchId={ui.selectedMatchId}
            onMatchClick={handleMatchClick}
          />
        ))
      )}
    </div>
  );
}

export function AdminPage() {
  return (
    <div className="page">
      <div className="admin-layout">
        <AdminSidebar />
        <AdminCanvas />
      </div>
    </div>
  );
}
