/**
 * Aviso comum às páginas de classificação (geral e por categoria): resultado oficial.
 */
export function PartialClassificationNotice() {
  return (
    <div className="partial-classification-notice" role="status">
      <p className="partial-classification-notice__lead">
        <strong>Resultado oficial — validado pela arbitragem</strong>
      </p>
      <p className="partial-classification-notice__body">
        As posições e pontuações apresentadas nesta página foram conferidas, validadas e
        homologadas pela equipa de arbitragem. Esta publicação passa a valer como
        <strong> classificação oficial do evento</strong>, com efeitos desportivos e de premiação,
        salvo retificação formal publicada pela organização.
      </p>
    </div>
  );
}
