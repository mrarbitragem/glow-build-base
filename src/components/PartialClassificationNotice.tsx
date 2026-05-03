/**
 * Aviso comum às páginas de classificação (geral e por categoria): resultado ainda não oficial.
 */
export function PartialClassificationNotice() {
  return (
    <div className="partial-classification-notice" role="status">
      <p className="partial-classification-notice__lead">
        <strong>Resultado parcial — ainda não oficial</strong>
      </p>
      <p className="partial-classification-notice__body">
        As posições e pontuações que vê aqui são apenas o reflexo do que foi registado nesta
        aplicação durante o torneio. <strong>Continuam pendentes de validação e homologação pela
        arbitragem</strong> (revisão dos resultados, protestos, correcções, etc.). Enquanto isso não
        ocorrer, <strong>não constituem classificação nem pontuação definitivas</strong> e não
        vinculam a organização nem os clubes em sede de reclamação ou premiação.
      </p>
    </div>
  );
}
