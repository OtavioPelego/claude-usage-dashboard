#!/usr/bin/env node
// Monta (ou atualiza) o dashboard de consumo de tokens do Claude Code.
//
// Lê os transcripts locais (~/.claude/projects/**/*.jsonl), soma os tokens por dia (e por modelo, projeto e hora),
// grava o histórico em <saída>/dados/ e gera <saída>/dashboard.html com os dados embutidos (abre direto no navegador,
// sem servidor e sem internet). Nada é enviado para fora do computador; os transcripts são só lidos.
//
// Uso:
//   node build-dashboard.js                        -> gera/atualiza em ~/claude-usage-dashboard
//   node build-dashboard.js --out <pasta>          -> outra pasta de saída
//   node build-dashboard.js --projects-dir <pasta> -> outra pasta de transcripts (padrão: $CLAUDE_CONFIG_DIR/projects ou ~/.claude/projects)
//   node build-dashboard.js --full                 -> relê todo o histórico (o padrão relê só os últimos 3 dias, se já existir CSV)
//   node build-dashboard.js --open                 -> abre o dashboard no navegador padrão quando terminar
//   node build-dashboard.js --aparelho <nome>      -> nome deste computador (padrão: o nome da máquina); vários computadores = vários nomes
//
//   node build-dashboard.js --aparelhos-dir <pasta> -> onde ficam os CSVs de cada computador (padrão: <saída>/dados/aparelhos);
//                                                    aponte para uma pasta SINCRONIZADA para os computadores se enxergarem sozinhos
//
// Vários computadores: cada um guarda o seu CSV em <saída>/dados/aparelhos/<nome>.csv (+ <nome>.detalhes.csv). Copie esses
// arquivos dos outros computadores para a mesma pasta (ou use --aparelhos-dir numa pasta sincronizada) e rode de novo:
// o dashboard soma tudo por dia e mostra "Por aparelho".
// Dados da API da Anthropic (opcional): rode scripts/importar-api.js; o arquivo dados/api-diario.csv aparece numa seção
// separada, sem entrar nos totais do Claude Code.
//
// Duas contagens por dia (as duas ficam no CSV; o dashboard alterna entre elas):
//   Contagem Claude Code (principal): cada linha do transcript conta. Uma resposta do Claude aparece em várias linhas
//                               (uma por bloco de conteúdo) e todas entram; métrica = entrada + saída.
//   Contagem Alternativa:       cada resposta conta uma vez; "sem cache lido" = entrada + saída + cache criado.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { lerTranscripts, lerDetalhesCsv, gravarDetalhesCsv, mesclarDetalhes, diaLocal, pad } = require('./lib/transcripts.js');

// ---------- argumentos ----------
const args = process.argv.slice(2);
const opt = nome => { const i = args.indexOf(nome); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : null; };
if (args.includes('--help') || args.includes('-h')) {
  // a ajuda é o comentário do topo deste arquivo (todas as linhas "//" seguidas, depois do "#!")
  const ajuda = [];
  for (const l of fs.readFileSync(__filename, 'utf8').split('\n').slice(1)) { if (!l.startsWith('//')) break; ajuda.push(l.replace(/^\/\/ ?/, '')); }
  console.log(ajuda.join('\n'));
  process.exit(0);
}
const nomeAparelho = s => String(s || '').trim().replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'este-computador';
const saida = path.resolve(opt('--out') || path.join(os.homedir(), 'claude-usage-dashboard'));
const aparelho = nomeAparelho(opt('--aparelho') || os.hostname());
const configDir = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const raizTranscripts = path.resolve(opt('--projects-dir') || path.join(configDir, 'projects'));
const dirDados = path.join(saida, 'dados');
// A pasta dos CSVs por computador pode ficar numa pasta sincronizada (Drive, OneDrive, Dropbox, Syncthing…):
// cada computador só escreve os PRÓPRIOS arquivos, então nada conflita e todos passam a se enxergar.
const dirAp = path.resolve(opt('--aparelhos-dir') || path.join(dirDados, 'aparelhos'));
const csvAparelho = path.join(dirAp, aparelho + '.csv');
const detAparelho = path.join(dirAp, aparelho + '.detalhes.csv');
const csvMesclado = path.join(dirDados, 'tokens-diarios.csv');
const detMesclado = path.join(dirDados, 'detalhes-diarios.csv');
const apiCsv = path.join(dirDados, 'api-diario.csv');
const htmlPath = path.join(saida, 'dashboard.html');
const modeloPath = path.join(__dirname, '..', 'assets', 'dashboard.template.html');
const TAG_DADOS = '<script src="dados/tokens-diarios.js"></script>';
// Crédito no rodapé do dashboard (licença MIT: manter o aviso de autoria). Preencha SITE_AUTOR com o endereço do site para o
// nome virar link; vazio = só o texto.
const SITE_AUTOR = 'https://otaviopelego.pages.dev';
const CREDITO = 'Dashboard gerado com a skill <code>claude-usage-dashboard</code> · Otávio Pelego' +
  (SITE_AUTOR ? ' (<a href="' + SITE_AUTOR + '" target="_blank" rel="noopener">Site do Otávio Corrêa</a>)' : ' (Site do Otávio Corrêa)');
const hoje = diaLocal(new Date());

const CAMPOS = ['data', 'sem_cache_lido', 'entrada', 'saida', 'cache_criado', 'cache_lido', 'sessoes', 'respostas', 'parcial',
  'atualizado_em', 'linha_entrada', 'linha_saida', 'linha_cache_criado', 'linha_cache_lido'];
const NUMERICOS = ['sem_cache_lido', 'entrada', 'saida', 'cache_criado', 'cache_lido', 'sessoes', 'respostas',
  'linha_entrada', 'linha_saida', 'linha_cache_criado', 'linha_cache_lido'];

// lê um CSV de dias pelos NOMES das colunas (aceita arquivos de versões anteriores, sem as colunas mais novas)
function lerCsvDias(arquivo) {
  if (!fs.existsSync(arquivo)) return {};
  const [cab, ...linhas] = fs.readFileSync(arquivo, 'utf8').split(/\r?\n/);
  const nomes = cab.split(';');
  const out = {};
  for (const l of linhas) {
    if (!l.trim()) continue;
    const c = l.split(';'), r = {};
    nomes.forEach((n, i) => { r[n] = (n === 'data' || n === 'atualizado_em') ? c[i] : (c[i] === undefined || c[i] === '' ? null : Number(c[i])); });
    out[r.data] = r;
  }
  return out;
}
const linhaCsv = r => CAMPOS.map(c => (r[c] === null || r[c] === undefined) ? '' : r[c]).join(';');

// ---------- histórico deste aparelho ----------
// Migração: quem já usava a versão de um computador só tinha dados/tokens-diarios.csv; vira o CSV deste aparelho.
if (!fs.existsSync(dirAp) && fs.existsSync(csvMesclado)) {
  fs.mkdirSync(dirAp, { recursive: true });
  fs.copyFileSync(csvMesclado, csvAparelho);
}
const doAparelho = lerCsvDias(csvAparelho);
const datasGravadas = Object.keys(doAparelho).sort();

// Sem --full e com histórico gravado: relê só os últimos 3 dias (os anteriores já estão no CSV e não mudam).
let desde = '0000-00-00';
if (!args.includes('--full') && datasGravadas.length) {
  const ult = new Date(datasGravadas[datasGravadas.length - 1] + 'T00:00:00');
  ult.setDate(ult.getDate() - 3);
  desde = diaLocal(ult);
}

if (!fs.existsSync(raizTranscripts)) {
  console.error(`\n  Não encontrei a pasta de transcripts do Claude Code: ${raizTranscripts}\n` +
    '  Ela existe depois que você usa o Claude Code neste computador. Se ela fica em outro lugar,\n' +
    '  use --projects-dir <pasta> (ou defina CLAUDE_CONFIG_DIR).\n');
  process.exit(2);
}

(async () => {
  const { dias, detalhes, nArq, nLidos } = await lerTranscripts({ raiz: raizTranscripts, desde });

  const carimbo = (() => { const a = new Date(); return `${diaLocal(a)} ${pad(a.getHours())}:${pad(a.getMinutes())}`; })();
  for (const dia of Object.keys(dias).sort()) {
    const d = dias[dia];
    doAparelho[dia] = { data: dia, sem_cache_lido: d.resp.entrada + d.resp.saida + d.resp.cacheCriado,
      entrada: d.resp.entrada, saida: d.resp.saida, cache_criado: d.resp.cacheCriado, cache_lido: d.resp.cacheLido,
      sessoes: d.sessoes.size, respostas: d.respostas, parcial: dia === hoje ? 1 : 0, atualizado_em: carimbo,
      linha_entrada: d.linha.entrada, linha_saida: d.linha.saida, linha_cache_criado: d.linha.cacheCriado, linha_cache_lido: d.linha.cacheLido };
  }
  if (!Object.keys(doAparelho).length) {
    console.error('\n  Não achei nenhum uso do Claude Code nos transcripts (nenhuma linha com "usage").\n  Use o Claude Code um pouco e rode de novo.\n');
    process.exit(3);
  }
  fs.mkdirSync(dirAp, { recursive: true });
  fs.mkdirSync(dirDados, { recursive: true });   // a pasta dos aparelhos pode estar fora de <saída>/dados (pasta sincronizada)
  const ordenadas = Object.keys(doAparelho).sort().map(k => linhaCsv(doAparelho[k]));
  fs.writeFileSync(csvAparelho, [CAMPOS.join(';'), ...ordenadas].join('\n') + '\n');
  gravarDetalhesCsv(detAparelho, mesclarDetalhes(lerDetalhesCsv(detAparelho), detalhes));

  // ---------- junta todos os aparelhos (um CSV por computador em dados/aparelhos) ----------
  const arquivos = fs.readdirSync(dirAp).filter(f => f.endsWith('.csv') && !f.endsWith('.detalhes.csv')).sort();
  const aparelhos = arquivos.map(f => ({ nome: f.replace(/\.csv$/, ''), dias: lerCsvDias(path.join(dirAp, f)) }));
  const somados = {};
  for (const ap of aparelhos) {
    for (const [dia, r] of Object.entries(ap.dias)) {
      const s = somados[dia] || (somados[dia] = { data: dia, parcial: 0, atualizado_em: '' });
      for (const n of NUMERICOS) if (r[n] !== null && r[n] !== undefined) s[n] = (s[n] || 0) + r[n];
      if (r.atualizado_em && r.atualizado_em > s.atualizado_em) s.atualizado_em = r.atualizado_em;
    }
  }
  for (const s of Object.values(somados)) { s.parcial = s.data === hoje ? 1 : 0; for (const n of NUMERICOS) if (s[n] === undefined) s[n] = null; }
  const registros = Object.keys(somados).sort().map(k => somados[k]);
  fs.writeFileSync(csvMesclado, [CAMPOS.join(';'), ...registros.map(linhaCsv)].join('\n') + '\n');

  const detSoma = {};
  for (const f of fs.readdirSync(dirAp).filter(x => x.endsWith('.detalhes.csv'))) {
    for (const r of lerDetalhesCsv(path.join(dirAp, f))) {
      const k = `${r.data}|${r.dim}|${r.chave}`;
      const s = detSoma[k] || (detSoma[k] = { data: r.data, dim: r.dim, chave: r.chave, p: 0, a: 0 });
      s.p += r.p; s.a += r.a;
    }
  }
  const detMesc = Object.values(detSoma);
  gravarDetalhesCsv(detMesclado, detMesc);

  // por aparelho (só faz sentido com 2 ou mais): [{ nome, dias: [[data, principal, alternativa]] }]
  const porAparelho = aparelhos.length > 1 ? aparelhos.map(ap => ({
    nome: ap.nome,
    dias: Object.keys(ap.dias).sort().map(dia => { const r = ap.dias[dia];
      return [dia, (r.linha_entrada || 0) + (r.linha_saida || 0), r.sem_cache_lido || 0]; })
  })) : null;

  // dados da API (opcional): dados/api-diario.csv, gerado por scripts/importar-api.js
  let api = null;
  if (fs.existsSync(apiCsv)) {
    const [cab, ...ls] = fs.readFileSync(apiCsv, 'utf8').split(/\r?\n/);
    const nomes = cab.split(';');
    api = ls.filter(l => l.trim()).map(l => { const c = l.split(';'), r = {};
      nomes.forEach((n, i) => { r[n] = (n === 'data' || n === 'modelo') ? c[i] : Number(c[i]) || 0; }); return r; });
  }

  // ---------- gera o HTML ----------
  if (!fs.existsSync(modeloPath)) { console.error(`  Modelo do dashboard não encontrado: ${modeloPath}`); process.exit(4); }
  const modelo = fs.readFileSync(modeloPath, 'utf8');
  if (!modelo.includes(TAG_DADOS)) { console.error('  O modelo do dashboard não tem o ponto de inserção dos dados.'); process.exit(4); }
  const json = v => JSON.stringify(v).replace(/},{/g, '},\n  {').replace(/\],\[/g, '],\n  [');
  const dadosJs = [
    'window.TOKENS_DIARIOS = ' + json(registros.map(r => Object.fromEntries(CAMPOS.map(c => [c, r[c] === undefined ? null : r[c]])))) + ';',
    'window.DETALHES = ' + json(detMesc.sort((x, y) => x.data.localeCompare(y.data)).map(r => [r.data, r.dim, r.chave, r.p, r.a])) + ';',
    porAparelho ? 'window.APARELHOS = ' + JSON.stringify(porAparelho) + ';' : '',
    api ? 'window.API_DIARIO = ' + json(api) + ';' : ''
  ].filter(Boolean).join('\n');
  // split/join em vez de replace: o texto dos dados poderia conter "$&" e outros padrões especiais do replace
  fs.writeFileSync(htmlPath, modelo.split('{{CREDITO}}').join(CREDITO).split(TAG_DADOS).join('<script>\n' + dadosJs + '\n</script>'));

  // ---------- confere o HTML gerado (sem precisar de navegador) ----------
  // Compila cada <script> embutido: pega erro de sintaxe e dados corrompidos antes de entregar o arquivo.
  let htmlOk = true, htmlMsg = '';
  try {
    const vm = require('vm');
    const html = fs.readFileSync(htmlPath, 'utf8');
    const blocos = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).filter(s => s.trim());
    blocos.forEach((codigo, i) => new vm.Script(codigo, { filename: `dashboard.html <script #${i + 1}>` }));
    if (/<script[^>]*\bsrc=/.test(html)) throw new Error('sobrou um <script src> que depende de arquivo externo');
    // Teste de fumaça: executa a página num "navegador" simulado (qualquer elemento aceita qualquer chamada). Compilar não
    // basta — uma variável usada antes de existir ou uma função que não existe só estoura ao rodar, e a pessoa veria uma
    // página em branco. Só ReferenceError/SyntaxError valem como defeito: o resto pode ser limite da simulação.
    const simulado = () => {
      const p = new Proxy(function () {}, {
        get: (t, k) => k === Symbol.toPrimitive ? () => '' : k === Symbol.iterator ? function* () {} : k === 'length' ? 0 : k === 'then' ? undefined : p,
        set: () => true, apply: () => p, construct: () => p
      });
      return p;
    };
    const ctx = { console: { log() {}, warn() {}, error() {} }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
      matchMedia: () => simulado(), requestAnimationFrame: () => 0, setTimeout: () => 0, clearTimeout() {}, addEventListener() {}, scrollTo() {}, scrollBy() {},
      getComputedStyle: () => simulado(), innerWidth: 1280, innerHeight: 800, navigator: {}, location: {},
      // a página procura listas de elementos (setores, botões…): devolve UM elemento simulado, para que o código que
      // percorre essas listas também seja executado (uma lista vazia pularia justamente as partes que queremos testar)
      document: new Proxy(simulado(), { get: (t, k) => k === 'querySelectorAll' ? () => [simulado()] : t[k] }),
      Event: function () {}, PointerEvent: function () {}, KeyboardEvent: function () {}, MouseEvent: function () {}, Node: function () {}, Element: function () {}, HTMLElement: function () {}, CSS: {} };
    ctx.window = ctx; ctx.self = ctx; ctx.globalThis = ctx;
    vm.createContext(ctx);
    let fumaca = 'a página executou até o fim';
    try { blocos.forEach((codigo, i) => vm.runInContext(codigo, ctx, { filename: `dashboard.html <script #${i + 1}>`, timeout: 8000 })); }
    catch (e) {
      if (e && (e.name === 'ReferenceError' || e.name === 'SyntaxError')) throw new Error(`a página quebra ao carregar (${e.name}: ${e.message}) — ela abriria em branco`);
      fumaca = `executou até onde o navegador simulado permitiu (${e && e.name})`;
    }
    htmlMsg = `${blocos.length} bloco(s) de script compilam · teste de carregamento: ${fumaca} · dados embutidos, sem arquivos externos`;
  } catch (e) { htmlOk = false; htmlMsg = e.message; }

  // ---------- resumo ----------
  // tokens -> "1,66 M" / "641 k": em milhões a partir de 1 M, para não parecer "1.663 k" (que confunde)
  const fmtT = n => n >= 1e6 ? (n / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' M' : Math.round(n / 1e3).toLocaleString('pt-BR') + ' k';
  const principalDe = r => (r.linha_entrada || 0) + (r.linha_saida || 0);
  const somaPrincipal = registros.reduce((a, r) => a + principalDe(r), 0);
  const somaAux = registros.reduce((a, r) => a + r.sem_cache_lido, 0);
  console.log(`\n  Transcripts: ${nArq} arquivo(s) em ${raizTranscripts}`);
  console.log(`  Leitura: ${nLidos} arquivo(s) nesta rodada, ${desde === '0000-00-00' ? 'histórico completo' : 'só desde ' + desde + ' (os últimos 3 dias; os anteriores vêm do CSV)'}`);
  console.log(`  Este aparelho: "${aparelho}" · aparelhos juntos no dashboard: ${aparelhos.length}${aparelhos.length > 1 ? ' (' + aparelhos.map(a => a.nome).join(', ') + ')' : ''}`);
  console.log(`  Dias no histórico: ${registros.length}  (${registros[0].data} a ${registros[registros.length - 1].data})`);
  console.log(`  Total — Contagem Claude Code (entrada + saída por linha, ESTIMATIVA do painel): ${fmtT(somaPrincipal)} tokens`);
  console.log(`  Total — Contagem Alternativa (sem cache lido: entrada + saída + cache criado):  ${fmtT(somaAux)} tokens`);
  for (const r of registros.slice(-3)) console.log(`    ${r.data}  Claude Code ${fmtT(principalDe(r)).padStart(9)}   Alternativa ${fmtT(r.sem_cache_lido).padStart(9)}${r.parcial ? '  (dia em aberto)' : ''}`);
  if (!registros.some(r => r.data === hoje)) console.log(`    (hoje, ${hoje}, não aparece: ainda não houve uso do Claude Code hoje neste computador — é normal)`);
  const nMod = new Set(detMesc.filter(r => r.dim === 'modelo').map(r => r.chave)).size, nProj = new Set(detMesc.filter(r => r.dim === 'projeto').map(r => r.chave)).size;
  console.log(`  Detalhes: ${nMod} modelo(s), ${nProj} projeto(s), por hora do dia${api ? ' · API: ' + api.length + ' linha(s) em dados/api-diario.csv' : ''}`);
  if (registros.filter(r => !r.parcial).length < 3) console.log('\n  Aviso: poucos dias registrados — o dashboard mostra só uma tabela até haver pelo menos 3 dias fechados.');
  console.log(`\n  HTML: ${htmlOk ? 'OK — ' : 'PROBLEMA — '}${htmlMsg}`);
  console.log(`  CSV:       ${csvMesclado}\n  Dashboard: ${htmlPath}\n`);

  if (args.includes('--open') && htmlOk) {
    // abre no navegador padrão (Windows: start · macOS: open · Linux: xdg-open)
    const { spawn } = require('child_process');
    const [cmd, cargs] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '""', htmlPath]]
      : process.platform === 'darwin' ? ['open', [htmlPath]] : ['xdg-open', [htmlPath]];
    try { spawn(cmd, cargs, { detached: true, stdio: 'ignore' }).on('error', () => console.log('  (não consegui abrir sozinho — abra o arquivo acima com dois cliques)')).unref(); } catch (e) { /* segue sem abrir */ }
  }
  if (!htmlOk) process.exit(5);
})().catch(e => { console.error('\n  Erro inesperado: ' + (e && e.stack || e) + '\n'); process.exit(1); });
