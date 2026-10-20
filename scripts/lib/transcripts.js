'use strict';
// Leitura dos transcripts do Claude Code — usada por build-dashboard.js (e por quem quiser reaproveitar).
// Só LÊ os arquivos; devolve, por dia: os totais das duas contagens e os detalhes por modelo, projeto e hora.
//
//   principal (por linha):   cada linha do transcript conta (uma resposta aparece em várias linhas); entrada + saída
//   alternativa (por resposta): cada resposta conta uma vez; entrada + saída + cache criado
const fs = require('fs');
const path = require('path');

const pad = n => String(n).padStart(2, '0');
const diaLocal = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// o Claude Code nomeia a pasta de cada projeto trocando tudo que não é letra/dígito ASCII do caminho por "-"
const codifica = p => p.replace(/[^a-zA-Z0-9]/g, '-');

function* jsonls(dir) {
  let entradas = [];
  try { entradas = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
  for (const e of entradas) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* jsonls(p);
    else if (e.name.endsWith('.jsonl')) yield p;
  }
}

// Lê o arquivo em pedaços (nada de carregar centenas de MB de uma vez) e separa as linhas SÓ por "\n".
// Não use readline aqui: ele também quebra em U+2028/U+2029, que podem aparecer dentro de um texto do transcript
// e partiriam uma linha de JSON em duas — a linha inteira seria perdida e os tokens dela sumiriam da conta.
async function* linhasDe(arq) {
  let resto = '';
  for await (const pedaco of fs.createReadStream(arq, { encoding: 'utf8' })) {
    const partes = (resto + pedaco).split('\n');
    resto = partes.pop();
    for (const l of partes) yield l;
  }
  if (resto) yield resto;
}

const zero = () => ({ entrada: 0, saida: 0, cacheCriado: 0, cacheLido: 0 });
const soma2 = () => ({ p: 0, a: 0 });
const acumula = (mapa, chave) => mapa[chave] || (mapa[chave] = soma2());

// desde: 'AAAA-MM-DD' (só relê arquivos mexidos desde então e só conta dias a partir dele); '0000-00-00' = tudo
async function lerTranscripts({ raiz, desde = '0000-00-00' }) {
  const desdeMs = desde === '0000-00-00' ? 0 : new Date(desde + 'T00:00:00').getTime();
  const dias = {};       // dia -> { resp, linha, sessoes:Set, respostas }
  const brutos = {};     // dia -> { modelo:{}, pasta:{}, hora:{} }  (cada um: chave -> {p, a})
  const nomes = {};      // pasta -> { raiz, curto, curtoLen }
  const vistos = new Set();
  let nArq = 0, nLidos = 0;

  for (const arq of jsonls(raiz)) {
    nArq++;
    try { if (fs.statSync(arq).mtimeMs < desdeMs) continue; } catch (e) { continue; }
    const pasta = path.relative(raiz, arq).split(path.sep)[0];
    try {
      for await (const linha of linhasDe(arq)) {
        if (!linha.includes('"usage"')) continue;
        let r;
        try { r = JSON.parse(linha); } catch (e) { continue; }
        const u = r.message && r.message.usage;
        if (!u || !r.timestamp) continue;
        const dt = new Date(r.timestamp);
        const dia = diaLocal(dt);
        if (dia < desde) continue;

        const d = dias[dia] || (dias[dia] = { resp: zero(), linha: zero(), sessoes: new Set(), respostas: 0 });
        const det = brutos[dia] || (brutos[dia] = { modelo: {}, pasta: {}, hora: {} });
        const t = { entrada: u.input_tokens || 0, saida: u.output_tokens || 0,
          cacheCriado: u.cache_creation_input_tokens || 0, cacheLido: u.cache_read_input_tokens || 0 };
        const p = t.entrada + t.saida;                 // principal: por linha
        for (const k in t) d.linha[k] += t[k];
        const modelo = (r.message.model || '?');
        const hora = pad(dt.getHours());
        acumula(det.modelo, modelo).p += p;
        acumula(det.pasta, pasta).p += p;
        acumula(det.hora, hora).p += p;
        if (r.cwd) {   // o nome do projeto vem da pasta de trabalho (a raiz, quando dá para identificar)
          const n = nomes[pasta] || (nomes[pasta] = { raiz: null, curto: null, curtoLen: Infinity });
          const base = path.basename(r.cwd);
          if (!n.raiz && base && codifica(r.cwd) === pasta) n.raiz = base;
          if (base && r.cwd.length < n.curtoLen) { n.curto = base; n.curtoLen = r.cwd.length; }
        }

        const chave = `${r.message.id}:${r.requestId}`;
        if (vistos.has(chave)) continue;               // alternativa: cada resposta uma vez
        vistos.add(chave);
        for (const k in t) d.resp[k] += t[k];
        const a = t.entrada + t.saida + t.cacheCriado;
        acumula(det.modelo, modelo).a += a;
        acumula(det.pasta, pasta).a += a;
        acumula(det.hora, hora).a += a;
        if (r.sessionId) d.sessoes.add(r.sessionId);
        d.respostas++;
      }
      nLidos++;
    } catch (e) { console.warn(`  (pulei ${path.basename(arq)}: ${e.message})`); }
  }

  // nomes legíveis para os projetos; pastas que resultarem no mesmo nome (ex.: dois "docs") são somadas
  const nomeDe = pasta => { const n = nomes[pasta]; return (n && (n.raiz || n.curto)) || pasta; };
  const detalhes = [];   // [{ data, dim, chave, p, a }]
  for (const dia of Object.keys(brutos).sort()) {
    const det = brutos[dia];
    for (const [chave, v] of Object.entries(det.modelo)) detalhes.push({ data: dia, dim: 'modelo', chave, p: v.p, a: v.a });
    const porNome = {};
    for (const [pasta, v] of Object.entries(det.pasta)) { const x = acumula(porNome, nomeDe(pasta)); x.p += v.p; x.a += v.a; }
    for (const [chave, v] of Object.entries(porNome)) detalhes.push({ data: dia, dim: 'projeto', chave, p: v.p, a: v.a });
    for (const [chave, v] of Object.entries(det.hora)) detalhes.push({ data: dia, dim: 'hora', chave, p: v.p, a: v.a });
  }
  return { dias, detalhes, nArq, nLidos };
}

// ---- CSV de detalhes (formato longo): data;dimensao;chave;principal;alternativa ----
const CAMPOS_DET = ['data', 'dimensao', 'chave', 'principal', 'alternativa'];
function lerDetalhesCsv(arquivo) {
  if (!fs.existsSync(arquivo)) return [];
  return fs.readFileSync(arquivo, 'utf8').split(/\r?\n/).slice(1).filter(l => l.trim()).map(l => {
    const c = l.split(';');
    return { data: c[0], dim: c[1], chave: c[2], p: Number(c[3]) || 0, a: Number(c[4]) || 0 };
  });
}
function gravarDetalhesCsv(arquivo, linhas) {
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  const ordenadas = [...linhas].sort((x, y) => x.data.localeCompare(y.data) || x.dim.localeCompare(y.dim) || x.chave.localeCompare(y.chave));
  // ';' no nome (de projeto, por exemplo) quebraria a coluna: troca por vírgula
  fs.writeFileSync(arquivo, [CAMPOS_DET.join(';'), ...ordenadas.map(r => [r.data, r.dim, String(r.chave).replace(/[;\r\n]/g, ','), r.p, r.a].join(';'))].join('\n') + '\n');
}
// substitui só os dias que foram relidos; o resto (dias que sumiram dos transcripts) fica como estava
function mesclarDetalhes(antigas, novas) {
  const dias = new Set(novas.map(r => r.data));
  return antigas.filter(r => !dias.has(r.data)).concat(novas);
}

module.exports = { lerTranscripts, lerDetalhesCsv, gravarDetalhesCsv, mesclarDetalhes, diaLocal, pad, CAMPOS_DET };
