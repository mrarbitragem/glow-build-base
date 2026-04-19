# n8n / MySQL — webhook `jogo` (placar, em andamento, quadra)

A app envia um **POST JSON** para o webhook **`/webhook/jogo`** (produção: `https://webhook.mrarbitragem.com.br/webhook/jogo`; em dev o Vite faz proxy para o mesmo URL).

## Corpo do POST (campos na raiz)

| Campo | Tipo | Descrição |
|--------|------|------------|
| `categoriaId` | string | Id da categoria **já mapeado para a BD** (ver tabela abaixo). |
| `matchId` | string | Id estável do confronto na app (ex.: chave principal / posições). |
| `score1`, `score2` | string | Placar. |
| `winner` | string | `""`, `"1"` ou `"2"` (lado vencedor). |
| `datetime` | string | Data/hora específica do jogo (formato `datetime-local` / ISO conforme gravação). |
| `inProgress` | boolean | `true` se o jogo está marcado como **em andamento**. |
| `court` | string | Quadra (texto livre); igual a `quadra`. |
| `quadra` | string | Duplicado de `court` para fluxos n8n que já usam o nome `quadra`. |

### Mapeamento `categoriaId` (app → POST)

O frontend aplica o mesmo mapeio de `save_chave` / `chave`:

| App | Valor em `categoriaId` no POST |
|-----|--------------------------------|
| `40`, `40+` | `40+` |
| `sub-12` … `sub-18` | `sub12` … `sub18` |
| `50` | `50+` |
| `60` | `60+` |
| Outros (ex.: `a`, `b`, `c`) | igual ao id da app |

No n8n, use **`$json.categoriaId`** e **`$json.matchId`** como chaves naturais do upsert.

## Exemplo de JSON recebido no Webhook

```json
{
  "categoriaId": "40+",
  "matchId": "main:R2:M0",
  "score1": "2",
  "score2": "1",
  "winner": "1",
  "datetime": "2026-04-18T14:30",
  "inProgress": true,
  "court": "Quadra 2",
  "quadra": "Quadra 2"
}
```

## MySQL — colunas sugeridas

Se já existe tabela de resultado por jogo (ex.: `jogos`, `partidas`, `match_result`), **adicione** (ou use JSON):

```sql
ALTER TABLE seu_jogos
  ADD COLUMN in_progress TINYINT(1) NOT NULL DEFAULT 0 AFTER winner,
  ADD COLUMN quadra VARCHAR(64) NOT NULL DEFAULT '' AFTER in_progress;
```

- `in_progress`: `1` quando `$json.inProgress === true`, senão `0`.
- `quadra`: `COALESCE(NULLIF(TRIM($json.quadra),''), NULLIF(TRIM($json.court),''))` — na prática basta **`$json.quadra`** ou **`$json.court`** (são iguais).

Chave lógica sugerida: **`(categoria_id, match_id)`** única, com `ON DUPLICATE KEY UPDATE`.

## Exemplo de query no nó MySQL (n8n)

Parâmetros (modo “substituir” com expressões n8n):

```sql
INSERT INTO seu_jogos (
  categoria_id, match_id,
  score1, score2, winner, datetime,
  in_progress, quadra,
  updated_at
) VALUES (
  {{ $json.categoriaId }},
  {{ $json.matchId }},
  {{ $json.score1 }},
  {{ $json.score2 }},
  NULLIF(TRIM({{ $json.winner }}), ''),
  NULLIF(TRIM({{ $json.datetime }}), ''),
  {{ $json.inProgress ? 1 : 0 }},
  LEFT(TRIM(COALESCE({{ $json.quadra }}, {{ $json.court }}, '')), 64),
  NOW()
)
ON DUPLICATE KEY UPDATE
  score1 = VALUES(score1),
  score2 = VALUES(score2),
  winner = VALUES(winner),
  datetime = VALUES(datetime),
  in_progress = VALUES(in_progress),
  quadra = VALUES(quadra),
  updated_at = NOW();
```

Ajuste nomes de tabela/colunas ao teu schema. Em n8n v2, prefira **“Execute Query”** com **query parameters** em vez de interpolar strings cruas, se o nó suportar, para evitar SQL injection em outros campos.

## n8n — fluxo mínimo

1. **Webhook** — método POST, path `jogo` (conforme já tens).
2. **(Opcional) Set** — normalizar tipos (`inProgress` boolean, strings trim).
3. **MySQL** — `INSERT ... ON DUPLICATE KEY UPDATE` como acima.
4. **Respond to Webhook** — HTTP 200 + JSON `{ "ok": true }` (a app só verifica `res.ok`).

Se hoje o Webhook devolve HTML ou vazio, mantém desde que o status seja **200**.

## Devolver estado na `load_chave` (importante para o público)

Para a app e o painel “Em Andamento” refletirem a BD após F5 ou outro browser, o payload do **`chave`** (load) deve incluir **`matchResults`** (ou `match_results` / JSON equivalente) **por `matchId`** com, no mínimo, os mesmos campos que a app grava:

```json
"matchResults": {
  "main:R2:M0": {
    "score1": "2",
    "score2": "1",
    "winner": "1",
    "datetime": "2026-04-18T14:30",
    "inProgress": true,
    "court": "Quadra 2"
  }
}
```

A app aceita também **`quadra`** e **`em_andamento`** / **`emAndamento`** na leitura (mapeamento em `matchStateFromRow` no código).

## Checklist

- [ ] Colunas `in_progress` e `quadra` (ou equivalentes) na tabela de jogos.
- [ ] Webhook `jogo` a fazer upsert com `inProgress` e `quadra`/`court`.
- [ ] Query `load_chave` a devolver `matchResults` com `inProgress` e `court` (ou `quadra`).
- [ ] Testar POST manual no n8n com o exemplo JSON acima e confirmar linha na BD.
