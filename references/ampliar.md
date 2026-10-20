# Ampliar a skill / Extending the skill

Este arquivo diz o que já está pronto, o que ainda não dá e como a pessoa (ou o Claude dela) pode ir além.
*(EN: what is already built, what is not possible yet, and how to go further.)*

## Estado atual

| Fonte / visão | Estado | Onde |
|---|---|---|
| Claude Code deste computador (duas contagens) | **Pronto** | `scripts/build-dashboard.js` |
| **Por modelo, por projeto, por horário** | **Pronto** | `scripts/lib/transcripts.js` + seções do dashboard |
| **Vários computadores** | **Pronto** | um CSV por computador em `dados/aparelhos/`; o build soma por dia (`--aparelho`) |
| **API da Anthropic (Console)** | **Pronto**, como seção separada | `scripts/importar-api.js` (organização com chave de administração, ou CSV do Console) |
| Uso na **nuvem**, no **claude.ai** e nos apps | **Ainda não** | não há arquivo local nem API pública conhecida; só o painel do próprio serviço |

Ideias que ficaram de fora e dá para fazer: telemetria (OpenTelemetry) do Claude Code para equipes (veja a documentação do
Claude Code), a API de análise do Claude Code para organizações (custo estimado por usuário), alertas de limite, exportar o
dashboard em PDF/imagem, tradução da interface.

## Como a skill está montada (o contrato de dados)

1. `scripts/lib/transcripts.js` lê os transcripts (só leitura) e devolve, por dia, os totais das duas contagens e os
   detalhes por modelo, projeto e hora. É o lugar certo para novos recortes.
2. `scripts/build-dashboard.js` grava os CSVs em `dados/` e embute tudo em `dashboard.html` como variáveis:
   `window.TOKENS_DIARIOS` (dias), `window.DETALHES` (`[data, dimensão, chave, principal, alternativa]`),
   `window.APARELHOS` (só com 2+ computadores) e `window.API_DIARIO` (só se `dados/api-diario.csv` existir).
3. `assets/dashboard.template.html` desenha tudo a partir dessas variáveis. **Fonte nova = jeito novo de produzir linhas
   nesse formato** (ou outra variável, se for outro tipo de dado, como a API).
4. Seção nova: copie um `<section class="card" data-sec="...">`, escolha um `data-sec` novo e escreva a função
   `render...()` (chame-a em `renderAll()` e em `aplicarPeriodo()`); o recolher/abrir e a memória do estado pegam o novo
   cartão sozinhos. Se não houver dados, remova a seção do DOM no início (como as de aparelho e API fazem).

## Como pedir ao Claude (modelo de pedido)

> "Estenda a skill `claude-usage-dashboard`: quero acrescentar **<o que você quer>**. Leia `references/ampliar.md` e
> `references/como-funciona.md`. Faça num **script novo** (não altere o `build-dashboard.js` original), teste com
> transcripts falsos (veja "Teste sem dados reais" nos cuidados) e mostre a diferença antes de aplicar."

## Cuidados (aprendidos na prática)

- **Rotule cada fonte** e nunca misture tipos de dado no mesmo total; some só o que é comparável (a API fica separada).
- **Chaves e segredos:** nunca em CSV, HTML, README ou repositório. Use variável de ambiente e peça ao Claude para **não**
  repetir a chave no chat. O `importar-api.js` lê a chave só do ambiente e nunca a imprime.
- **Teste sem dados reais:** gere transcripts falsos (linhas `.jsonl` com `message.id`, `requestId`, `timestamp`, `cwd`,
  `message.model`, `message.usage`) e, para a API, um servidor falso com o formato da documentação; confira que o total
  bate com o esperado antes de usar de verdade.
- **Leitura de linhas:** separe por `\n`; não use `readline` (U+2028/U+2029 quebram linhas de JSON e fazem tokens sumirem).
- **Formatos incertos** (como o CSV exportado do Console): mostre o que foi entendido e recuse quando houver dúvida,
  em vez de importar errado em silêncio; números como "1.500" e "1,200" em colunas de tokens são milhares, não decimais.
- **Não publique seus dados** ao compartilhar sua versão: confira o CSV e o HTML por nomes, caminhos e números pessoais.
  Os nomes de projeto e de computador aparecem no dashboard (há o botão "Ocultar nomes dos projetos").
