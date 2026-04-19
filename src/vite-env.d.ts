/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CLUBS_WEBHOOK_URL?: string;
  /** URL base se `bandeira` no banco for só caminho (ex.: `https://cdn.exemplo.com/files`) */
  readonly VITE_CLUB_FLAG_BASE_URL?: string;
  /** POST para gravar resultado (ex.: https://webhook.../webhook/jogo) */
  readonly VITE_JOGO_WEBHOOK_URL?: string;
  readonly VITE_LOAD_CHAVE_WEBHOOK_URL?: string;
  readonly VITE_SAVE_CHAVE_WEBHOOK_URL?: string;
  /**
   * Se `1`, com várias categorias não se tenta POST em lote com `categoriaIds` (só um pedido por categoria).
   * Por omissão a app tenta primeiro um único POST com todas as ids e só recorre ao modo um-a-um se a resposta não trouxer dados.
   */
  readonly VITE_CHAVE_LOAD_SEQUENTIAL_ONLY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
