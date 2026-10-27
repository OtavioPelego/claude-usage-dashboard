---
name: claude-usage-dashboard
description: Monta um dashboard HTML local com o consumo de tokens do Claude Code da pessoa (por dia, calendário de uso, sequências, insights, projeção até uma meta), lendo os transcripts do próprio computador — nada sai da máquina. Use sempre que a pessoa quiser ver, medir, acompanhar ou atualizar o consumo/uso de tokens do Claude Code, mesmo sem dizer "dashboard" — por exemplo "quanto de token eu gastei", "meu uso do Claude Code", "tokens por dia", "relatório de consumo", "monta meu dashboard de uso", "atualiza o dashboard". Builds a local HTML dashboard of the user's Claude Code token usage from their own transcripts (daily bars, usage calendar, streaks, insights, goal projection). Also use for "how many tokens have I used", "Claude Code usage report", "token usage dashboard".
---

# Dashboard de consumo do Claude Code

Gera (ou atualiza) um `dashboard.html` que abre direto no navegador, sem servidor e sem internet, a partir dos
transcripts que o Claude Code já guarda no computador da pessoa. O trabalho pesado é feito por um script pronto
(`scripts/build-dashboard.js`) — você só prepara o ambiente, roda o script, confere o resultado e explica o que a pessoa
está vendo. Não reescreva a lógica de contagem à mão: o script já trata os casos chatos (respostas repetidas em várias
linhas, arquivos grandes, dias que sumiram dos transcripts).

## Antes de rodar

1. **Node.js.** O script precisa dele (versão 14 ou mais nova). Rode `node --version`.
   - Se não existir, explique em uma frase por que é preciso e **pergunte antes de instalar**. Caminhos comuns:
     Windows `winget install OpenJS.NodeJS.LTS`; macOS `brew install node`; Linux o gerenciador de pacotes da distro;
     ou o instalador em nodejs.org. Depois de instalar, abra uma nova sessão do terminal para o `node` entrar no PATH.
   - O instalador "nativo" do Claude Code não traz o Node junto, então não presuma que ele existe.
2. **Pasta dos transcripts.** Normalmente `~/.claude/projects` (ou `$CLAUDE_CONFIG_DIR/projects` se a pessoa mudou o
   local). O script descobre sozinho; se não achar, ele diz e sai com mensagem clara — aí pergunte onde fica.

## Rodar

```bash
node <pasta-desta-skill>/scripts/build-dashboard.js
```

`<pasta-desta-skill>` é a pasta onde está este `SKILL.md` — o caminho que o ambiente informou ao carregar a skill
(normalmente `~/.claude/skills/claude-usage-dashboard`). Use o caminho absoluto.

- Saída padrão: `~/claude-usage-dashboard/` com `dashboard.html` e `dados/tokens-diarios.csv`. Use `--out <pasta>` se a
  pessoa preferir outro lugar.
- `--projects-dir <pasta>` aponta para os transcripts quando não estão no lugar padrão (o script já respeita
  `CLAUDE_CONFIG_DIR`). `--open` abre o dashboard no navegador ao terminar. `--help` lista tudo.
- Primeira vez: o script lê todo o histórico (alguns segundos, ou mais em históricos muito grandes). Nas vezes seguintes
  ele relê só os **últimos 3 dias** e mantém os anteriores do CSV. `--full` força reler tudo.
- Windows: funciona em PowerShell e no Git Bash; use aspas se o caminho tiver espaços.

## Conferir antes de entregar

O script imprime um resumo (totais em "k" ou "M" tokens). Leia-o e verifique:
- a linha **`HTML: OK`**: o próprio script compila os blocos de JavaScript do arquivo gerado **e executa a página num
  navegador simulado** (teste de carregamento), pegando erros que só estourariam ao abrir — uma página em branco —,
  então não precisa de navegador para saber que o arquivo está íntegro. Se aparecer `PROBLEMA`, **não entregue**: releia a mensagem, rode de
  novo com `--full` e, se persistir, veja `references/como-funciona.md`;
- o número de **dias** e o intervalo de datas fazem sentido para o que a pessoa conhece do próprio uso;
- os totais não são zero e o dia de hoje aparece como "(dia em aberto)". Se hoje **não** aparece, é porque ainda não
  houve uso do Claude Code hoje neste computador — normal, o script avisa;
- se houver poucos dias (menos de 3 fechados), o resumo traz "Aviso: poucos dias registrados" e o dashboard mostra só uma
  tabela simples — avise que os gráficos aparecem com mais dias de uso, em vez de tratar como erro.

**Abrir o dashboard:** dois cliques no `dashboard.html`, ou rode o script com `--open`, ou use o comando do sistema
(Windows `start "" "<arquivo>"`, macOS `open "<arquivo>"`, Linux `xdg-open "<arquivo>"`). Se a ferramenta de envio de
arquivos existir, mande o HTML para a pessoa.

## O que explicar à pessoa (curto, em linguagem simples)

- **Uma só contagem: a "Contagem Claude Code".** Ela soma entrada + saída de *cada linha* do transcript, sem cache — é
  a reconstrução que melhor reproduziu o painel de uso do próprio Claude Code (num teste de 89 dias de um único usuário,
  o total ficou a cerca de 2% do painel, 0,98×; dia a dia os valores podem variar mais). Diga que é **estimativa**, não
  cópia garantida — e, se a pessoa perguntar, que o total ao longo do tempo é a parte mais confiável, mais que cada dia
  isolado. O cache criado e o cache lido aparecem só como quadros secundários na seção Geral (o cache lido é o contexto
  relido a cada resposta e não entra na métrica).
- **No topo:** um card com **Meta Diária, Semanal e Mensal** (consumido hoje / na semana / no mês e o % de cada meta), centralizado
  logo abaixo do título (a explicação da contagem fica recolhida em "explicação ▾"). As metas são **fixas e da própria pessoa** (botão "editar metas", salvas no navegador, uma para cada
  contagem); sem metas salvas, o painel sugere pela média dos últimos 30 dias. Há também a escolha de **Objetivo**:
  "atingir uma meta" (para se desafiar, por exemplo) ou "ficar dentro de um limite" (para economizar) — a conta é a mesma,
  mas as frases mudam ("Quanto por dia até a meta?" × "Quanto ainda posso gastar?", "Meta Diária" × "Limite Diário").
  Nenhum dos dois é "o certo": a pessoa escolhe o que a ajuda.
- **Cores:** o botão "cores ▾" (ao lado de Objetivo) abre presets (Rave, Primária, Oceano, Pôr do sol, Floresta, Rosa) e três
  seletores livres — barras, fim de semana e destaque (calendário e metas batidas). "Rave" é o padrão e "Primária" são as
  cores originais (azul, laranja e verde); a escolha fica
  salva no navegador e vale nos temas claro e escuro.
- **A página:** setores recolhíveis (só o "Geral" abre sozinho; a escolha de cada pessoa fica lembrada), um "?" em cada
  métrica explicando o que ela é, e um filtro de **período** (atalhos de 7 a 180 dias, "últimos N dias" e um intervalo de
  datas do passado) que vale para o Geral, o gráfico por dia, o total por mês, os detalhes e — se a pessoa deixar marcado
  "calendário acompanha o período" — o calendário. Além dos totais, há **Por modelo**, **Por projeto** (a pasta onde o
  Claude Code foi aberto; o botão "Ocultar nomes dos projetos" serve para mostrar a tela a outras pessoas) e **Horário
  de uso** (dia da semana × hora, no fuso do computador). Se houver mais de um computador, aparece **Por aparelho**; se
  houver dados da API, aparece **API da Anthropic (separado)** — nunca somada ao Claude Code.
- **Limites que vêm do sistema, não da skill:** cada execução só enxerga o Claude Code **do computador em que roda** (para
  juntar vários computadores, veja abaixo), o **claude.ai e os apps na nuvem não deixam rastro** que dê para ler daqui
  (hoje: "ainda não"), e o Claude Code **apaga transcripts antigos** depois de um tempo — o histórico começa no que ainda
  existia na primeira execução. Por isso vale rodar de novo de vez em quando: o CSV acumula os dias já registrados, e é
  ele o "arquivo" da pessoa (sugira fazer backup da pasta `dados/`).
- **Privacidade:** o script só lê os números de uso dos transcripts; o dashboard não envia nada para a internet. Não
  suba o CSV/HTML para lugar nenhum a menos que a pessoa peça.

## Atualizar depois

Rodar o mesmo comando atualiza tudo (o dia de hoje fica "em aberto" até virar). Se a pessoa quiser automatizar, ofereça
agendar a execução (a skill de agendamento do ambiente, cron no macOS/Linux, Agendador de Tarefas no Windows) — só
configure se ela pedir.

## Histórico curto? Opcional: guardar por mais tempo

O período em que o Claude Code mantém os transcripts é uma configuração dele (`cleanupPeriodDays` nas configurações,
conforme a documentação atual — confirme lá antes de afirmar o nome ou o padrão). Se a pessoa quiser histórico mais longo,
explique a opção, mas **nunca altere as configurações do Claude Code sem um "sim" explícito**.

## Idioma da página

A interface do dashboard está em português do Brasil. Se a pessoa não lê português, ofereça traduzir os textos visíveis do
`dashboard.html` gerado (não do modelo da skill): troque só o texto que aparece na tela, sem mexer em nomes de variáveis,
atributos `data-*`, nem nos formatos de número/data do JavaScript; abra a página depois e confira que nada quebrou.

## Vários computadores

Cada computador tem o seu CSV em `<saída>/dados/aparelhos/<nome>.csv` (mais `<nome>.detalhes.csv`). O nome padrão é o nome
da máquina (`--aparelho <nome>` escolhe outro). Para juntar:

1. Em **cada** computador, rode o script (cada um gera o seu CSV).
2. Copie os arquivos `dados/aparelhos/<nome>.csv` e `<nome>.detalhes.csv` dos outros computadores para a mesma pasta
   `dados/aparelhos/` do computador principal (pendrive, pasta sincronizada, e-mail para si mesma — o que a pessoa
   preferir; **a skill não envia nada para lugar nenhum**).
3. Rode o script de novo no principal: ele soma tudo por dia e a seção **Por aparelho** aparece.

**Jeito automático (pasta sincronizada):** se os computadores já compartilham uma pasta (Google Drive, OneDrive, Dropbox,
iCloud Drive, Nextcloud, Syncthing…), rode em cada um `--aparelho <nome> --aparelhos-dir <pasta sincronizada>`. Cada
computador grava só os **seus** dois arquivos lá (nada derivado, nada de dashboard), então não há conflito, e todos
passam a enxergar os outros quando a sincronização alcança. Outras formas de levar os arquivos: pendrive, pasta de rede
ou um repositório git **privado** (lembre: o histórico do git guarda os arquivos e eles têm nomes de projetos e
computadores). Nunca sincronize os transcripts em si — só esses CSVs.

Avise que os nomes dos computadores aparecem no dashboard, que dois computadores com o **mesmo** nome se sobrescrevem
(por isso `--aparelho`), e que quem já usava um computador só tem o histórico migrado sozinho para o nome da máquina.

## API da Anthropic (Console)

A API tem um tipo de dado diferente (custo em dólar, cobrança por token), então fica numa seção **separada** e nunca entra
nos totais do Claude Code. Dois caminhos (`scripts/importar-api.js`, depois rode o `build-dashboard.js`):

- **Organização com chave de administração:** a API de uso e custo é de administração, exige conta de **organização** e uma
  chave `sk-ant-admin...`; a documentação diz que **não está disponível para contas individuais**. A chave vai **só** na
  variável de ambiente `ANTHROPIC_ADMIN_KEY` — nunca peça a chave no chat, nunca a escreva em arquivo e nunca a repita.
  Os dias vêm em **UTC**. Confirme na documentação atual (platform.claude.com, "Usage and Cost API"), que pode mudar.
- **Conta individual:** exporte o CSV da página de uso do Console e rode `importar-api.js --csv <arquivo>`. O formato da
  exportação não é documentado: o script mostra quais colunas entendeu — **confira com a pessoa** — e recusa o arquivo se
  não tiver certeza (aí renomeie as colunas para o esquema simples descrito em `--help`). Se o custo estiver em
  centavos, use `--centavos`.

Para manter atualizado, a pessoa pode agendar os dois comandos (cron no macOS/Linux, Agendador de Tarefas no Windows) com
a chave definida no ambiente daquela tarefa — só configure se ela pedir; numa conta individual, vale exportar o CSV do
Console de vez em quando e importar.

## Se a pessoa pedir ainda mais (nuvem, claude.ai, outras fontes)

Diga com franqueza: **uso na nuvem e no claude.ai: ainda não** — não há arquivo local nem API pública conhecida para
ler (só o painel do próprio serviço); por enquanto a pessoa pode acompanhar o painel do serviço ou anotar os números à mão
numa planilha dela. Para outras ideias, aponte `references/ampliar.md` (ideias, contrato de dados,
modelo de pedido) e ofereça construir **num script novo, na cópia dela**, sem alterar o modelo compartilhado.

## Crédito e licença

A skill é de Otávio Pelego, licença MIT (arquivo `LICENSE`). O rodapé do dashboard traz uma linha de crédito
("Dashboard gerado com a skill … · Otávio Pelego (Site do Otávio Corrêa)"): mantenha-a ao entregar ou compartilhar a página
e não a apresente como criação sua. O link (https://otaviopelego.pages.dev) está em `SITE_AUTOR`, no topo de `scripts/build-dashboard.js`.

## Se algo der errado

Veja `references/como-funciona.md` (colunas do CSV, como as contagens são calculadas, problemas conhecidos). Não edite
`assets/dashboard.template.html` para uma pessoa específica: o modelo é compartilhado; personalizações vão no
`dashboard.html` gerado.
