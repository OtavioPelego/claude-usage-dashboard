# Como o dashboard funciona

## Fluxo

1. `scripts/build-dashboard.js` percorre `~/.claude/projects/**/*.jsonl` (ou `$CLAUDE_CONFIG_DIR/projects`).
2. Cada linha de transcript com `message.usage` vira tokens do dia (data no **fuso local** do computador).
3. O histórico deste computador fica em `<saída>/dados/aparelhos/<nome>.csv` (uma linha por dia; dias que já não existem
   nos transcripts mantêm a linha gravada) e `<nome>.detalhes.csv` (por modelo, projeto e hora). O build soma todos os
   CSVs dessa pasta por dia (um por computador) e grava o resultado em `dados/tokens-diarios.csv` e
   `dados/detalhes-diarios.csv`.
4. `assets/dashboard.template.html` recebe os dados embutidos e vira `<saída>/dashboard.html` (arquivo único).

## Detalhes, aparelhos e API

- **`detalhes.csv`** (formato longo, `;`): `data;dimensao;chave;principal;alternativa`. `dimensao` é `modelo` (nome como
  vem do transcript), `projeto` (nome da pasta de trabalho — a raiz do projeto, reconhecida pela pasta de transcripts
  correspondente — e não o caminho completo) ou `hora` (`00`–`23`, fuso local). `principal` = entrada + saída por linha;
  `alternativa` = entrada + saída + cache criado por resposta. Cada dimensão soma exatamente o total do dia.
- **Vários computadores:** um CSV por computador em `dados/aparelhos/`; o build soma por dia. Quem tinha só
  `dados/tokens-diarios.csv` (versão de um computador só) tem o arquivo migrado sozinho para o nome da máquina.
- **`api-diario.csv`** (`scripts/importar-api.js`): `data;modelo;entrada;saida;cache_criado;cache_lido;web_search;custo_usd`.
  Dias em **UTC** (como a API). O custo da API vem em centavos como texto decimal e é convertido para dólar. Seção separada;
  nunca soma ao Claude Code. Formatos de API conferidos na documentação da Anthropic ("Usage and Cost API"); confirme se
  mudou.

## Colunas do CSV (separador `;`)

| coluna | significado |
|---|---|
| `data` | AAAA-MM-DD, fuso local |
| `sem_cache_lido` | entrada + saída + cache criado, **cada resposta uma vez** (contagem auxiliar) |
| `entrada`, `saida`, `cache_criado`, `cache_lido` | componentes da contagem sem repetições |
| `sessoes`, `respostas` | sessões distintas e respostas distintas do dia |
| `parcial` | `1` = dia de hoje, ainda em aberto |
| `atualizado_em` | quando a linha foi calculada |
| `linha_entrada`, `linha_saida`, `linha_cache_criado`, `linha_cache_lido` | os mesmos componentes **contando cada linha do transcript** (contagem principal = `linha_entrada + linha_saida`) |

## Por que a contagem é por linha

Uma resposta do Claude aparece em várias linhas do transcript (uma por bloco de conteúdo: texto, chamada de ferramenta…),
todas com o mesmo `message.id` + `requestId`. Duas formas de somar:

- **Por linha (principal):** soma todas as linhas. Com entrada + saída (sem cache), foi o que melhor reproduziu os
  números do painel de uso do Claude Code na validação do autor: 89 dias, um único computador, total em **0,98×** do
  painel; dia a dia só 35 de 89 dias ficaram dentro de ±25% (erro típico ~31%). Os números do painel foram anotados à
  mão, em horários variados, e o painel chegou a reescrever dias já fechados — então parte da dispersão vem dali. É uma
  hipótese forte, **não** uma cópia garantida. Fechar o dia em UTC reproduz pior (correlação 0,77 contra 0,90): o painel
  vira o dia na meia-noite local.
- **Por resposta ("sem cache lido"):** cada resposta uma vez, incluindo o cache criado. **Não aparece mais no dashboard**
  (só existe a contagem por linha), mas o script continua gravando essas colunas no CSV — o histórico fica completo e dá
  para usar em outras análises. O **cache lido** (contexto relido a cada resposta) aparece só como quadro secundário:
  somado, ele infla o total em ordens de grandeza.

## Problemas conhecidos

- **Histórico curto:** o Claude Code apaga transcripts antigos; o primeiro CSV só tem o que ainda existia.
- **Cada execução vê um computador:** outros computadores entram copiando os CSVs deles (veja "Vários computadores");
  **claude.ai e a nuvem: ainda não** (sem arquivo local nem API pública conhecida).
- **Leitor de linhas:** o script separa as linhas só por `\n`. Não troque por `readline`: ele também quebra em
  U+2028/U+2029, que podem aparecer dentro de um texto do transcript — a linha de JSON se parte e os tokens dela somem.
- **Dia em aberto:** hoje entra no total, mas fica fora de médias e projeções até fechar.
- **Poucos dias:** com menos de 3 dias fechados o dashboard mostra só uma tabela.
- **Interface em português (pt-BR).** Traduzir é só trocar os textos visíveis; contribuições são bem-vindas.

## Escalas que se adaptam

Metas, patamares dos Insights e o ritmo padrão da projeção são calculados dos dados de cada pessoa (percentis dos dias
fechados, arredondados para números redondos) e refeitos ao trocar de contagem — não há números fixos de um usuário.
