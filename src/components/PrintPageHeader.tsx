import type { EventInfo } from '@/types/tournament';

type Props = {
  event: EventInfo;
  /** Texto da linha «CATEGORIA» (ex.: nome da categoria ou título da página). */
  categoryLabel: string;
};

/**
 * Cabeçalho unificado na impressão (título do evento, local, árbitro geral, contexto, data/hora).
 * Em ecrã fica oculto via `.print-header { display: none }`; em `@media print` passa a visível.
 */
export function PrintPageHeader({ event, categoryLabel }: Props) {
  const printedAt = new Date().toLocaleString('pt-BR');
  return (
    <div className="print-header">
      <div className="print-event-title">{event.title}</div>
      <div className="print-header-grid print-header-grid--primary">
        <div><strong>LOCAL</strong> {event.local}</div>
        <div><strong>ÁRBITRO GERAL</strong> {event.arbitroGeral}</div>
      </div>
      <div className="print-header-meta">
        <span className="print-category-name">
          <strong>CATEGORIA</strong> {categoryLabel}
        </span>
        <span>
          <strong>IMPRESSO</strong> {printedAt}
        </span>
      </div>
    </div>
  );
}
