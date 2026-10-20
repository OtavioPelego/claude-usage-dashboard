# claude-usage-dashboard

**EN** — A [Claude Code](https://claude.com/claude-code) skill that builds a **local, private HTML dashboard of your own
token usage**: daily bars, usage calendar, streaks, insights, a projection to a goal, and breakdowns by model, project
and hour of day. It reads the transcripts Claude Code already keeps on your machine; nothing is uploaded anywhere. It can
also merge **several computers** and show your **Anthropic API** usage and cost in a separate section.

**PT** — Uma skill do Claude Code que monta um **dashboard HTML local e privado do seu próprio consumo de tokens**:
barras por dia, calendário de uso, sequências, insights, projeção até uma meta e recortes por modelo, projeto e hora do
dia. Lê os transcripts que o Claude Code já guarda no seu computador; nada é enviado para fora. Também junta **vários
computadores** e mostra o uso e o custo da **API da Anthropic** numa seção separada.

> The dashboard UI is in **Brazilian Portuguese** for now (the skill can translate it on request). Contributions welcome. /
> A interface está em português do Brasil por enquanto (a skill pode traduzir sob pedido). Contribuições são bem-vindas.

## Install / Instalar

Copy this folder to your Claude Code skills directory so that the file `SKILL.md` ends up at
`~/.claude/skills/claude-usage-dashboard/SKILL.md`:

```bash
git clone https://github.com/OtavioPelego/claude-usage-dashboard.git ~/.claude/skills/claude-usage-dashboard
```

On Windows (PowerShell): `git clone https://github.com/OtavioPelego/claude-usage-dashboard.git $HOME\.claude\skills\claude-usage-dashboard`.

## Use / Usar

Open Claude Code and ask, for example: *"monta meu dashboard de consumo do Claude Code"* or *"build my Claude Code
usage dashboard"*. Claude will check that Node.js is installed (and offer to help install it if not), run the script, and
give you `~/claude-usage-dashboard/dashboard.html` — double-click to open it in your browser. Ask again any time to
update it (today shows as "in progress" until the day ends).

You can also run it yourself (Node.js 14+):

```bash
node scripts/build-dashboard.js                     # -> ~/claude-usage-dashboard/
node scripts/build-dashboard.js --out ./meu-painel  # another folder
node scripts/build-dashboard.js --full              # re-read the whole history
node scripts/build-dashboard.js --open              # open the dashboard in your browser when done
node scripts/build-dashboard.js --projects-dir <dir> # transcripts somewhere else (or set CLAUDE_CONFIG_DIR)
node scripts/build-dashboard.js --aparelho notebook # name of this computer (default: the machine name)
```

### Several computers / Vários computadores

Run the script on **each** computer (each writes `dados/aparelhos/<name>.csv` and `<name>.detalhes.csv`), copy those two
files from the other computers into the same `dados/aparelhos/` folder on your main one, and run the script again there:
it sums everything per day and a **Por aparelho** section appears. Nothing is sent anywhere — you move the files.
Two computers with the same name overwrite each other, so name them (`--aparelho`).

**Automatic, with a synced folder:** put the per-computer CSVs in a folder your computers already share (Google Drive,
OneDrive, Dropbox, iCloud Drive, Nextcloud, Syncthing…) and point every computer to it:

```bash
node scripts/build-dashboard.js --aparelho notebook --aparelhos-dir ~/Drive/claude-uso   # on the notebook
node scripts/build-dashboard.js --aparelho pc-casa  --aparelhos-dir ~/Drive/claude-uso   # on the desktop
```

Each computer writes only **its own** two files there (nothing derived, no dashboard), so there is nothing to conflict,
and every computer sees all the others after the sync catches up. Other ways to move the two files: a USB stick, a
network share, or a **private** git repository (remember that commits keep history and the files contain project and
computer names). Never sync the transcripts themselves — only these CSVs.

### Anthropic API / API da Anthropic (optional, separate)

API usage is a different kind of data (billed in dollars), so it goes in its own section and is **never added** to the
Claude Code totals:

```bash
# Organization with an Admin API key (individual accounts do not have this API). The key goes ONLY in the environment:
ANTHROPIC_ADMIN_KEY=sk-ant-admin... node scripts/importar-api.js --dias 90
# Individual account: export the CSV from the Console usage page and import it (the script shows what it understood):
node scripts/importar-api.js --csv console-export.csv
node scripts/build-dashboard.js     # then rebuild the dashboard
```

The Usage and Cost Admin API requires an **organization** and an admin key (the docs say it is not available for
individual accounts); days come in **UTC**. Check the current documentation, as it may change.

To keep it up to date, schedule the two commands (cron on macOS/Linux, Task Scheduler on Windows) with the key set in
that job's environment — or, on an individual account, export the CSV from the Console from time to time and import it.

### Cloud and claude.ai: not yet / Nuvem e claude.ai: ainda não

There is no local file or public API that I know of for usage in the web/cloud apps; only the service's own usage panel.
Until that changes, keep an eye on that panel, or note the numbers by hand in your own spreadsheet. If an export with
daily usage ever appears, the same idea as the API CSV import applies.

The script prints a summary and checks the generated page by itself (`HTML: OK`): it compiles every script **and runs
the page in a simulated browser**, refusing to deliver a page that would open blank — so you know the file is sound even
without opening it.

## What's in the page / O que tem na página

**Top card:** a fixed **daily and weekly goal** (consumed today / this week and the % of each goal), centered right under
the page title (the counting-method explanation is collapsed behind an "explicação ▾" toggle). Goals are yours (edit them in the card; saved in your browser, one set per counting method; the page
suggests them from your 30-day average until you set your own). A switch picks your **objective** — *reach a goal* (e.g.
to challenge yourself) or *stay within a limit* (e.g. to save): same arithmetic, different wording ("Quanto por dia até
a meta?" vs "Quanto ainda posso gastar?", "Meta Diária" vs "Limite Diário"). Neither is "right": use what helps you. /
**Card no topo:** meta diária e semanal fixas, centralizado logo abaixo do título (a explicação da contagem fica recolhida); e um seletor de
**objetivo** (atingir uma meta ou ficar dentro de um limite) que só muda as frases.

**Colors:** a "cores ▾" button opens presets (Original, Oceano, Pôr do sol, Floresta, Rosa) and three free pickers — bars,
weekend, highlight. "Original" is the default; your choice is saved in the browser and works in light and dark. /
**Cores:** o botão "cores ▾" abre presets e três seletores livres (barras, fim de semana, destaque); "Original" é o padrão.

Collapsible sections, in this order (each has a Collapse/Open button; only **Geral** starts open and your choice is
remembered): **Geral** (headline numbers), **Insights**, **Calendário de uso** (calendar or week-squares view, choose how
many weeks/months to show, week starting on Monday or Sunday), **Consumo por dia ativo**, **Total por mês**,
**Por modelo**, **Por projeto** (with a "hide project names" button for screenshots), **Horário de uso** (weekday × hour
heatmap), **Por aparelho** (only with 2+ computers), **Sequências de uso contínuo**, **Projeção** (goal + pace),
**Acumulado até a meta**, **Quanto por dia até a meta?** and **API da Anthropic (separado)** (only with API data).
Every metric has a **?** — hover it with a mouse, or tap it on a phone — explaining what it means. Goals, thresholds and
the default pace are computed from *your own* data.

**Period filter:** quick picks (7–180 days), **Personalizado** (last *N* days, or any date range from the past) and
"calendário acompanha o período" (the calendar follows the chosen period, or keeps its own window if unchecked). The
period drives the headline numbers, the daily chart, the monthly totals and the model/project/hour/computer/API sections.

## Two ways of counting / Duas contagens

There is a switch at the top of the page:

- **Contagem Claude Code** (default) — input + output of *every line* of the transcript, no cache. The reconstruction that best matched the
  Claude Code usage panel in the author's test (89 days, one machine: total within ~2% of the panel, i.e. 0.98×;
  individual days can differ more). **An estimate, not a guaranteed copy.**
- **Contagem Alternativa** — "sem cache lido": input + output + cache creation, each response counted once. Shows the volume of
  context processed; much larger.

Details in [`references/como-funciona.md`](references/como-funciona.md).

## Honest limits / Limites

These come from how Claude Code works, not from this skill:

- Each run sees **the Claude Code of the computer it runs on** (merge several as described above). **Cloud usage,
  claude.ai and the apps: not yet** — there is no local file or public API that I know of; only the service's own panel.
- Claude Code **deletes old transcripts** after a while, so your history starts from what still existed the first time
  you ran it. Run it again now and then: the CSV keeps the days already recorded (back it up — it is your archive).
- The dashboard needs **Node.js** to be generated (the generated page itself needs nothing).
- Tested on Windows; macOS/Linux should work (only Node's standard library is used) but have had less testing.

## Extend it / Amplie

Built: Claude Code on this and other computers, per model / project / hour, and the Anthropic API (separate). Not
possible yet: cloud / claude.ai. [`references/ampliar.md`](references/ampliar.md) is a short guide — what exists, the data
contract, a ready-made prompt for Claude, and the pitfalls — so you can build your own extension and share it back. /
Pronto: Claude Code neste e em outros computadores, por modelo / projeto / hora e API da Anthropic (separada). Ainda não:
nuvem / claude.ai. Veja `references/ampliar.md`.

## Privacy / Privacidade

The script only reads usage numbers from the transcripts, and the generated page makes no network requests. The
dashboard contains **no conversation text**, but it does show **project names** (the folder where Claude Code was
opened) and, with several computers, **computer names** — use the "hide project names" button before showing your screen,
and check the CSV/HTML before sharing them. The API key is read only from an environment variable and never printed or
saved.

## Fascínio por dados / Why this exists

**PT** — Esta skill existe por causa de um fascínio meu por números. Eu me viciei em monitorar quanto gastava de tokens
por dia e me incomodava quando não "torrava" o que tinha me proposto. Virou um jogo comigo mesmo: me empurrava a usar o
Claude Code todo dia, aprender, me superar — e, por consequência, criar coisas que eu não teria criado sem esse empurrão.
Sem esse fascínio, eu provavelmente teria largado a ferramenta, e esta skill nem existiria.

Sei que o que importa de verdade é o que se constrói — coisas incríveis, úteis, necessárias —, não a quantidade de tokens.
Gastar token não é mérito por si só: para mim é um termômetro que me mantém em movimento. Cada pessoa tem o seu objetivo, e
tem quem queira o contrário: economizar, ficar dentro de um limite. Por isso o painel deixa escolher entre **atingir uma
meta** e **ficar dentro de um limite** — a conta é a mesma, muda só a frase. Use do jeito que te ajudar.

**EN** — This skill exists because of my fascination with numbers. I got hooked on tracking how many tokens I used per day,
and it bugged me when I didn't "burn" what I had set out to. It became a game with myself: it pushed me to use Claude Code
every day, to learn and to outdo myself — and, as a result, to build things I wouldn't have built otherwise. Without that
fascination I would probably have dropped the tool, and this skill wouldn't exist. I know what really matters is what you
build, not the token count: spending tokens is no merit in itself, just a thermometer that keeps me moving. Everyone has
their own goal — some want the opposite: to save, to stay within a limit. That is why the dashboard lets you pick between
**reaching a goal** and **staying within a limit**: same arithmetic, different wording. Use it the way that helps you.

— Otávio

## Author and license / Autor e licença

Made by **Otávio Pelego** — *Site do Otávio Corrêa*: <https://otaviopelego.pages.dev> · GitHub:
[@OtavioPelego](https://github.com/OtavioPelego). Released under the **MIT License**
([`LICENSE`](LICENSE)): use, change and share freely, just keep the copyright notice. The generated dashboard carries a
small credit line in its footer — please leave it when you share the page. / Feito por **Otávio Pelego** (*Site do Otávio
Corrêa*). Licença **MIT**: use, altere e compartilhe à vontade, só mantenha o aviso de autoria; o dashboard gerado traz um
crédito discreto no rodapé — deixe-o ao compartilhar a página.

## Layout

```
claude-usage-dashboard/
├── LICENSE                       # MIT
├── SKILL.md                      # instructions Claude follows
├── scripts/build-dashboard.js    # reads transcripts, merges computers, writes CSVs + dashboard.html
├── scripts/importar-api.js       # optional: Anthropic API usage/cost (Admin API or Console CSV)
├── scripts/lib/transcripts.js    # transcript reader (totals + by model / project / hour)
├── assets/dashboard.template.html# the dashboard (single file, no dependencies)
├── references/como-funciona.md   # how the counts work, CSV columns, known problems
└── references/ampliar.md         # how to extend it (other computers, API…), pitfalls
```
