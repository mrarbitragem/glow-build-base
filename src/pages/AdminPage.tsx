import { useRef, useEffect, useState, useCallback } from 'react';
import { useTournament } from '@/context/TournamentContext';
import { evaluateStructure, countRealSeeds, scheduleLabel, collectMatches } from '@/utils/bracketEngine';
import { BracketView, BlockView } from '@/components/BracketView';
import { DirectNinthPlaceCard } from '@/components/DirectNinthPlaceCard';
import { ClubFlagMedia } from '@/components/ClubFlagMedia';
import { fileToDataUrl } from '@/utils/helpers';
import { BlockResult, EvaluatedMatch } from '@/types/tournament';

function AdminSidebar() {
  const {
    state,
    ui,
    getCategory,
    setAdminPanel,
    setAdminMode,
    updateEvent,
    setSlotClub,
    addClub,
    editClub,
    changeClubFlag,
    removeClub,
    exportBackup,
    importBackup,
    resetAll,
    setRoundDefault,
    setShowPlacementBrackets,
    reloadChaveFromServer,
    reloadAllChavesAfterOfficialDraw,
    refreshClubsFromWebhook,
  } = useTournament();
  const category = getCategory(ui.categoryId);
  const clubNameRef = useRef<HTMLInputElement>(null);
  const clubFlagRef = useRef<HTMLInputElement>(null);
  const [clubsRemoteLoading, setClubsRemoteLoading] = useState(false);
  const [clubsRemoteError, setClubsRemoteError] = useState<string | null>(null);
  const [chaveSyncBusy, setChaveSyncBusy] = useState(false);
  const [chaveSyncError, setChaveSyncError] = useState<string | null>(null);

  const handleReloadChaveThis = async (afterOfficialDraw: boolean) => {
    const label = category.name;
    if (
      afterOfficialDraw &&
      !confirm(
        `Categoria «${label}»: substituir a chave e os resultados de jogos pelos dados do servidor? (O que não vier na base será apagado nesta categoria.)`
      )
    ) {
      return;
    }
    setChaveSyncBusy(true);
    setChaveSyncError(null);
    try {
      await reloadChaveFromServer(ui.categoryId, { afterOfficialDraw });
    } catch (e) {
      setChaveSyncError(e instanceof Error ? e.message : 'Não foi possível recarregar a chave.');
    } finally {
      setChaveSyncBusy(false);
    }
  };

  const handleReloadAllChavesAfterDraw = async () => {
    if (
      !confirm(
        'Recarregar todas as categorias a partir do servidor (como após o sorteio oficial)? Os resultados de cada categoria passam a coincidir com o que a base devolver; o que não existir no servidor será removido.'
      )
    ) {
      return;
    }
    setChaveSyncBusy(true);
    setChaveSyncError(null);
    try {
      await reloadAllChavesAfterOfficialDraw();
    } catch (e) {
      setChaveSyncError(e instanceof Error ? e.message : 'Não foi possível recarregar as chaves.');
    } finally {
      setChaveSyncBusy(false);
    }
  };

  const loadClubsFromServer = useCallback(async () => {
    setClubsRemoteLoading(true);
    setClubsRemoteError(null);
    try {
      await refreshClubsFromWebhook();
    } catch (e) {
      setClubsRemoteError(e instanceof Error ? e.message : 'Não foi possível carregar os clubes.');
    } finally {
      setClubsRemoteLoading(false);
    }
  }, [refreshClubsFromWebhook]);

  useEffect(() => {
    if (ui.adminPanel !== 'clubes') return;
    void loadClubsFromServer();
  }, [ui.adminPanel, loadClubsFromServer]);

  const struct = evaluateStructure(category, state.clubs);

  // Collect visible rounds for schedule manager
  const scheduleMatches: EvaluatedMatch[] = [];
  scheduleMatches.push(...struct.mainRounds.flat());
  const walkPlacement = (block: BlockResult) => {
    if (block.rounds?.length) scheduleMatches.push(...block.rounds.flat());
    block.children.forEach(walkPlacement);
  };
  struct.placementBlocks.filter(b => b.startPlace >= 3).forEach(walkPlacement);
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
              <button className={`btn ${ui.adminMode === 'main' ? '' : 'secondary'}`} onClick={() => setAdminMode('main')}>Chaves</button>
              <button className={`btn ${ui.adminMode === 'disputas' ? '' : 'secondary'}`} onClick={() => setAdminMode('disputas')}>Posições</button>
            </div>
          </div>

          <div className="field">
            <label className="label">Sorteio / chaves no servidor</label>
            <div className="helper">
              Depois de gravar o sorteio na base (n8n / MySQL), use os botões abaixo. A categoria é a que está selecionada no topo do site (ex.: B).
            </div>
            <div className="footer-actions" style={{ flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn secondary small"
                disabled={chaveSyncBusy}
                onClick={() => void handleReloadChaveThis(false)}
              >
                Atualizar só esta chave
              </button>
              <button
                type="button"
                className="btn secondary small"
                disabled={chaveSyncBusy}
                onClick={() => void handleReloadChaveThis(true)}
              >
                Sorteio: esta categoria
              </button>
              <button
                type="button"
                className="btn small"
                disabled={chaveSyncBusy}
                onClick={() => void handleReloadAllChavesAfterDraw()}
              >
                Sorteio: todas as categorias
              </button>
            </div>
            {chaveSyncError && (
              <div className="error" role="alert" style={{ marginTop: 8 }}>
                {chaveSyncError}
              </div>
            )}
          </div>

          <div className="field">
            <label className="label">Chaves de posição (público + agenda)</label>
            <div className="round-schedule-item" style={{ alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                id="show-placement"
                checked={ui.showPlacementBrackets}
                onChange={e => setShowPlacementBrackets(e.target.checked)}
              />
              <label htmlFor="show-placement" className="label" style={{ fontWeight: 500, margin: 0, cursor: 'pointer' }}>
                Exibir chaves de posição na página «Posições» e permitir agendar rodadas de posição
              </label>
            </div>
            <div className="helper">
              Desligado: o menu «Posições» some e a página pública fica sem as mini-chaves. No admin, a área «Posições» e os horários por rodada das posições continuam disponíveis.
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
                      <div className="helper">Mesmo horário para todos os jogos desta rodada (mesmo scheduleKey), inclusive antes de existirem confrontos definidos.</div>
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
          <div className="helper">
            A lista oficial de clubes vem sempre do n8n (webhook «select_club» / MySQL): ao abrir o site, ao voltar a este separador no browser e ao abrir esta aba. Em seguida a app pede ao «chave» só a categoria 40+; nas outras abas, cada mudança de separador recarrega essa categoria. Vagas de sorteio com id que não exista na base ficam em branco. Se a resposta incluir metadados do evento (objeto «event» com «title», «local», «arbitroGeral» ou campos planos «event_title», «event_local», «event_arbitro_geral» / «nome_evento»), a topbar passa a usar esses valores.
          </div>
          <div className="footer-actions" style={{ flexWrap: 'wrap' }}>
            <button type="button" className="btn secondary" disabled={clubsRemoteLoading} onClick={() => void loadClubsFromServer()}>
              {clubsRemoteLoading ? 'Carregando…' : 'Atualizar do servidor'}
            </button>
          </div>
          {clubsRemoteError && (
            <div className="error" role="alert">{clubsRemoteError}</div>
          )}
          <div className="helper">Cadastro local (opcional): adicione clube só neste navegador; não grava no MySQL.</div>
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
                <ClubFlagMedia flag={club.flag} name={club.name} boxClassName="flag large" />
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
          <div className="helper">
            Nesta categoria, você só resgata clubes do cadastro central.
            «Definir clube…» são vagas do sorteio; «BYE (fixo na chave)» reproduce o tamanho da chave (quantidade de clubes que você definiu). Cada clube só pode ocupar uma posição — não é possível repetir o mesmo time na categoria (evita enfrentar a si mesmo).
          </div>
          <div className="field">
            <label className="label">Categoria em edição</label>
            <input className="input" disabled value={category.name} />
          </div>
          <div className="slot-grid">
            {Array.from({ length: category.slots }).map((_, idx) => {
              const raw = category.seeds[idx];
              const isFixedBye = raw === null;
              const clubId = typeof raw === 'string' ? raw : '';
              return (
                <div key={idx} className="slot-item">
                  <div className="name">Posição {idx + 1}</div>
                  {isFixedBye ? (
                    <select className="select" disabled value="__fixed_bye__">
                      <option value="__fixed_bye__">BYE (fixo na chave)</option>
                    </select>
                  ) : (
                    <select
                      className="select"
                      value={clubId}
                      onChange={e => setSlotClub(category.id, idx, e.target.value)}
                    >
                      <option value="">Definir clube…</option>
                      {state.clubs.map(club => {
                        const usedElsewhere = category.seeds.some(
                          (seed, si) => si !== idx && typeof seed === 'string' && seed === club.id
                        );
                        const disabled = usedElsewhere && club.id !== clubId;
                        return (
                          <option key={club.id} value={club.id} disabled={disabled}>
                            {club.name}
                            {disabled ? ' (outra posição)' : ''}
                          </option>
                        );
                      })}
                    </select>
                  )}
                </div>
              );
            })}
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
  const bNinthPlayoffBlock =
    category.id === 'b' ? struct.placementBlocks.find(b => b.key.includes('place-b9-playoff')) : undefined;
  const c911PlayoffBlock =
    category.id === 'c' || category.id === '40+'
      ? struct.placementBlocks.find(b => b.key.includes('place-c9-11-playoff'))
      : undefined;
  const filteredPlacementBlocks = struct.placementBlocks.filter(
    b =>
      b.startPlace >= 3 &&
      !(bNinthPlayoffBlock && b.key === bNinthPlayoffBlock.key) &&
      !(c911PlayoffBlock && b.key === c911PlayoffBlock.key)
  );
  const printedAt = new Date().toLocaleString('pt-BR');

  const handleMatchClick = (matchId: string) => {
    selectMatch(matchId);
    openMatchModal();
  };

  return (
    <div className={`card panel canvas-panel ${ui.adminMode === 'main' ? 'admin-print-main' : 'admin-print-disputes'}`}>
      <div className="print-header">
        <div className="print-event-title">{state.event.title}</div>
        <div className="print-header-grid">
          <div><strong>LOCAL</strong> {state.event.local}</div>
          <div><strong>CATEGORIA</strong> {category.name}</div>
          <div><strong>ÁRBITRO GERAL</strong> {state.event.arbitroGeral}</div>
          <div><strong>IMPRESSO</strong> {printedAt}</div>
        </div>
      </div>
      <div className="canvas-head">
        <div>
          <h3>Chave desenhada · {category.name}</h3>
          <div className="helper">
            {ui.adminMode === 'main'
              ? 'Chaves (título). Clique no confronto para registrar resultado.'
              : 'Chave de posições. Clique no confronto para data, horário e resultado.'}
          </div>
        </div>
        <div className="canvas-badges">
          <span className="mini-badge">{ui.adminMode === 'main' ? 'Chaves' : 'Posições'}</span>
          <span className="mini-badge">{countRealSeeds(category.seeds)} clubes</span>
        </div>
      </div>

      {ui.adminMode === 'main' ? (
        <>
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
          {struct.directPlacesFromR1Playables !== undefined && (
            <DirectNinthPlaceCard
              matches={struct.directPlacesFromR1Playables}
              clubs={state.clubs}
              isAdmin
              selectedMatchId={ui.selectedMatchId}
              onDefiningMatchClick={handleMatchClick}
            />
          )}
          {bNinthPlayoffBlock && (
            <BlockView
              block={bNinthPlayoffBlock}
              isAdmin
              selectedMatchId={ui.selectedMatchId}
              onMatchClick={handleMatchClick}
            />
          )}
          {c911PlayoffBlock && (
            <BlockView
              block={c911PlayoffBlock}
              isAdmin
              selectedMatchId={ui.selectedMatchId}
              onMatchClick={handleMatchClick}
            />
          )}
          {!ui.showPlacementBrackets &&
            filteredPlacementBlocks.map(block => (
              <BlockView
                key={block.key}
                block={block}
                isAdmin
                selectedMatchId={ui.selectedMatchId}
                onMatchClick={handleMatchClick}
              />
            ))}
        </>
      ) : (
        <>
          {!ui.showPlacementBrackets && (
            <p className="helper" style={{ marginBottom: 8 }}>
              Página pública «Posições» oculta: visitantes não veem o separador «Posições». Aqui a chave segue disponível para agenda e resultados.
            </p>
          )}
          {filteredPlacementBlocks.length > 0 ? (
            filteredPlacementBlocks.map(block => (
              <BlockView
                key={block.key}
                block={block}
                isAdmin
                selectedMatchId={ui.selectedMatchId}
                onMatchClick={handleMatchClick}
              />
            ))
          ) : (
            <p className="helper">
              Ainda não há mini-chaves de posição nesta categoria. Confirme o sorteio e os clubes em cada vaga.
            </p>
          )}
        </>
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
