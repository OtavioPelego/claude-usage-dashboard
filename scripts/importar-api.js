#!/usr/bin/env node
// Importa o uso e o custo da API da Anthropic (Claude Console) para <saída>/dados/api-diario.csv.
// O build-dashboard.js mostra esse arquivo numa seção SEPARADA ("API da Anthropic"): API e Claude Code são tipos de dado
// diferentes (custo em dólar, modelos cobrados por token) e nunca são somados.
//
// Dois caminhos:
//   1) API de administração (organizações): a chave NUNCA vai em argumento nem em arquivo — só na variável de ambiente
//        ANTHROPIC_ADMIN_KEY=sk-ant-admin... node importar-api.js [--dias 90] [--out <pasta>]
//      Exige conta de ORGANIZAÇÃO e chave de administrador; contas individuais não têm essa API (veja o README).
//      Endpoints: GET /v1/organizations/usage_report/messages e /v1/organizations/cost_report (dias em UTC).
//   2) CSV exportado do Console (contas individuais):  node importar-api.js --csv <arquivo.csv> [--out <pasta>]
//      O formato da exportação não é documentado e pode mudar: o script reconhece as colunas pelo nome, mostra o que
//      entendeu e recusa o arquivo se não tiver certeza. Se o custo estiver em centavos, acrescente --centavos.
//      Esquema simples aceito como está:  data;modelo;entrada;saida;cache_criado;cache_lido;web_search;custo_usd
//
// Outras opções: --base-url <url> (só para testes com um servidor falso)
const fs = require('fs');
const path = require('path');
const os = require('os');

const args = process.argv.slice(2);
const opt = n => { const i = args.indexOf(n); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : null; };
if (args.includes('--help') || args.includes('-h')) {
  const ajuda = [];
  for (const l of fs.readFileSync(__filename, 'utf8').split('\n').slice(1)) { if (!l.startsWith('//')) break; ajuda.push(l.replace(/^\/\/ ?/, '')); }
  console.log(ajuda.join('\n')); process.exit(0);
}
const saida = path.resolve(opt('--out') || path.join(os.homedir(), 'claude-usage-dashboard'));
const arquivo = path.join(saida, 'dados', 'api-diario.csv');
const CAMPOS = ['data', 'modelo', 'entrada', 'saida', 'cache_criado', 'cache_lido', 'web_search', 'custo_usd'];
const BASE = (opt('--base-url') || 'https://api.anthropic.com').replace(/\/$/, '');
const falha = (msg, cod = 1) => { console.error('\n  ' + msg.split('\n').join('\n  ') + '\n'); process.exit(cod); };

// ---------- arquivo de saída (mantém os dias que não foram buscados agora) ----------
function lerExistente() {
  if (!fs.existsSync(arquivo)) return [];
  const [cab, ...ls] = fs.readFileSync(arquivo, 'utf8').split(/\r?\n/);
  const nomes = cab.split(';');
  return ls.filter(l => l.trim()).map(l => { const c = l.split(';'), r = {}; nomes.forEach((n, i) => { r[n] = (n === 'data' || n === 'modelo') ? c[i] : Number(c[i]) || 0; }); return r; });
}
function gravar(novas, diasNovos) {
  const mantidas = lerExistente().filter(r => !diasNovos.has(r.data));
  const todas = mantidas.concat(novas).sort((a, b) => a.data.localeCompare(b.data) || a.modelo.localeCompare(b.modelo));
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  // ';' no nome de um modelo quebraria a coluna
  fs.writeFileSync(arquivo, [CAMPOS.join(';'), ...todas.map(r => CAMPOS.map(c => c === 'modelo' ? String(r[c]).replace(/[;\r\n]/g, ',') : r[c]).join(';'))].join('\n') + '\n');
  return todas;
}
const resumo = (todas, novas) => {
  const t = k => novas.reduce((a, r) => a + (r[k] || 0), 0);
  console.log(`\n  ${novas.length} linha(s) (dia × modelo) importadas · ${todas.length} no arquivo`);
  console.log(`  entrada ${t('entrada').toLocaleString('pt-BR')} · saída ${t('saida').toLocaleString('pt-BR')} · cache criado ${t('cache_criado').toLocaleString('pt-BR')} · cache lido ${t('cache_lido').toLocaleString('pt-BR')}`);
  console.log(`  custo: US$ ${t('custo_usd').toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  console.log(`\n  Arquivo: ${arquivo}\n  Rode o build-dashboard.js para ver a seção "API da Anthropic" no dashboard.\n`);
};

// ---------- caminho 2: CSV exportado do Console ----------
const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
function divideCsv(linha, sep) {   // CSV simples com aspas
  const out = []; let cur = '', asp = false;
  for (let i = 0; i < linha.length; i++) {
    const ch = linha[i];
    if (ch === '"') { if (asp && linha[i + 1] === '"') { cur += '"'; i++; } else asp = !asp; }
    else if (ch === sep && !asp) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur); return out.map(s => s.trim());
}
// Tokens são inteiros: "1.500" (pt-BR) e "1,200" (en) são milhares, não decimais; "1200.0" é 1200.
const tokens = s => {
  const v = String(s === undefined ? '' : s).trim().replace(/[^0-9,.\-]/g, '');
  if (!v) return 0;
  if (/^-?\d{1,3}([.,]\d{3})+$/.test(v)) return Number(v.replace(/[.,]/g, ''));
  if (/^-?\d+([.,]\d+)?$/.test(v)) return Math.round(Number(v.replace(',', '.')));
  return Number(v.replace(/[^0-9\-]/g, '')) || 0;
};
// Valores em dinheiro: o último separador é o decimal ("1.234,56" e "1,234.56" dão 1234,56).
const numero = s => { const v = String(s === undefined ? '' : s).replace(/[^0-9,.\-]/g, ''); if (!v) return 0;
  // "1.234,56" (pt-BR) e "1,234.56" (en): o último separador é o decimal
  const ult = Math.max(v.lastIndexOf(','), v.lastIndexOf('.')); if (ult < 0) return Number(v) || 0;
  return Number(v.slice(0, ult).replace(/[.,]/g, '') + '.' + v.slice(ult + 1)) || 0; };
function importaCsv(arq) {
  if (!fs.existsSync(arq)) falha('Arquivo não encontrado: ' + arq);
  const linhas = fs.readFileSync(arq, 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
  if (linhas.length < 2) falha('O CSV está vazio.');
  const sep = [';', '\t', ','].map(s => [s, (linhas[0].split(s).length)]).sort((a, b) => b[1] - a[1])[0][0];
  const cab = divideCsv(linhas[0], sep), nc = cab.map(norm);
  const acha = (teste) => nc.findIndex(teste);
  const iData = acha(n => /^(date|day|data|dia|usage_date|starting_at|period|bucket|time|timestamp)$/.test(n) || /^(date|data)_/.test(n));
  const iModelo = acha(n => /(^|_)(model|modelo)(_|$)/.test(n));
  const iCache = nome => nc.map((n, i) => /cache/.test(n) ? i : -1).filter(i => i >= 0);
  const iCriado = acha(n => /cache/.test(n) && /(creat|writ|criad|5m|1h)/.test(n));
  const iLido = acha(n => /cache/.test(n) && /(read|hit|lid)/.test(n));
  const iEntrada = acha(n => !/cache/.test(n) && /(input|entrada|prompt)/.test(n));
  const iSaida = acha(n => /(output|saida|completion)/.test(n));
  const iCusto = acha(n => /(cost|amount|custo|spend|usd)/.test(n));
  const iWeb = acha(n => /web_search/.test(n));
  const achados = { data: iData, modelo: iModelo, entrada: iEntrada, saida: iSaida, cache_criado: iCriado, cache_lido: iLido, custo: iCusto };
  console.log('\n  Colunas que entendi (confira!):');
  for (const [k, i] of Object.entries(achados)) console.log(`    ${k.padEnd(13)} <- ${i >= 0 ? '"' + cab[i] + '"' : '(não encontrada)'}`);
  if (iData < 0 || (iEntrada < 0 && iSaida < 0 && iCusto < 0)) {
    falha('Não tenho certeza do formato deste CSV, então não importei nada.\n' +
      'Colunas do arquivo: ' + cab.join(' | ') + '\n' +
      'Renomeie as colunas para o esquema simples (data;modelo;entrada;saida;cache_criado;cache_lido;web_search;custo_usd) e rode de novo.', 4);
  }
  const mapa = new Map();
  for (const l of linhas.slice(1)) {
    const c = divideCsv(l, sep);
    const bruto = c[iData] || ''; let dia = /^\d{4}-\d{2}-\d{2}/.test(bruto) ? bruto.slice(0, 10) : '';
    if (!dia) { const m = bruto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (m) dia = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; }   // dd/mm/aaaa
    if (!dia) continue;
    const modelo = (iModelo >= 0 ? c[iModelo] : '') || '(sem modelo)';
    const k = dia + '|' + modelo;
    const x = mapa.get(k) || { data: dia, modelo, entrada: 0, saida: 0, cache_criado: 0, cache_lido: 0, web_search: 0, custo_usd: 0 };
    if (iEntrada >= 0) x.entrada += tokens(c[iEntrada]);
    if (iSaida >= 0) x.saida += tokens(c[iSaida]);
    if (iCriado >= 0) x.cache_criado += tokens(c[iCriado]);
    if (iLido >= 0) x.cache_lido += tokens(c[iLido]);
    if (iWeb >= 0) x.web_search += tokens(c[iWeb]);
    if (iCusto >= 0) x.custo_usd += numero(c[iCusto]) / (args.includes('--centavos') ? 100 : 1);
    mapa.set(k, x);
  }
  const novas = [...mapa.values()];
  if (!novas.length) falha('Nenhuma linha com data reconhecível (aaaa-mm-dd ou dd/mm/aaaa).', 4);
  if (iCusto >= 0) console.log(`    custo lido como ${args.includes('--centavos') ? 'CENTAVOS (÷100)' : 'DÓLARES'} — se estiver errado, rode de novo ${args.includes('--centavos') ? 'sem' : 'com'} --centavos`);
  resumo(gravar(novas, new Set(novas.map(r => r.data))), novas);
}

// ---------- caminho 1: API de administração ----------
function pega(urlStr, chave) {
  const u = new URL(urlStr), mod = u.protocol === 'http:' ? require('http') : require('https');
  return new Promise((resolve, reject) => {
    const req = mod.request(u, { method: 'GET', headers: { 'x-api-key': chave, 'anthropic-version': '2023-06-01', 'user-agent': 'claude-usage-dashboard/1.0' } }, res => {
      let corpo = ''; res.setEncoding('utf8'); res.on('data', c => corpo += c);
      res.on('end', () => { let j = null; try { j = JSON.parse(corpo); } catch (e) { /* não é JSON */ }
        if (res.statusCode >= 200 && res.statusCode < 300 && j) resolve(j); else reject({ status: res.statusCode, corpo: j && j.error ? (j.error.message || JSON.stringify(j.error)) : corpo.slice(0, 200) }); });
    });
    req.on('error', e => reject({ status: 0, corpo: e.message })); req.setTimeout(30000, () => req.destroy(new Error('tempo esgotado'))); req.end();
  });
}
async function todasAsPaginas(rota, params, chave) {
  const buckets = []; let pagina = null;
  for (let n = 0; n < 200; n++) {
    const q = new URLSearchParams(); for (const [k, v] of params) q.append(k, v); if (pagina) q.append('page', pagina);
    const j = await pega(`${BASE}${rota}?${q.toString()}`, chave);
    (j.data || []).forEach(b => buckets.push(b));
    if (!j.has_more || !j.next_page) break;
    pagina = j.next_page;
  }
  return buckets;
}
async function importaApi() {
  const chave = process.env.ANTHROPIC_ADMIN_KEY;
  if (!chave) falha('Falta a chave de administração na variável de ambiente ANTHROPIC_ADMIN_KEY.\n' +
    'Ela é uma chave "sk-ant-admin..." criada no Console por um administrador de uma ORGANIZAÇÃO. Contas individuais não têm a\n' +
    'API de uso e custo — use a exportação CSV do Console (--csv). A chave nunca vai em argumento nem em arquivo.', 2);
  if (!chave.startsWith('sk-ant-admin')) console.log('  Aviso: a chave não começa com "sk-ant-admin"; chaves comuns de API não acessam esta API.');
  const dias = Math.max(1, parseInt(opt('--dias') || '90', 10) || 90);
  const fim = new Date(); fim.setUTCHours(0, 0, 0, 0); fim.setUTCDate(fim.getUTCDate() + 1);
  const ini = new Date(fim); ini.setUTCDate(ini.getUTCDate() - dias);
  const janela = [['starting_at', ini.toISOString().replace('.000Z', 'Z')], ['ending_at', fim.toISOString().replace('.000Z', 'Z')], ['bucket_width', '1d'], ['limit', '31']];
  console.log(`\n  Buscando ${dias} dia(s) de uso (UTC) na API de administração…`);
  let usoBuckets, custoBuckets = [], avisoCusto = null;
  try { usoBuckets = await todasAsPaginas('/v1/organizations/usage_report/messages', [...janela, ['group_by[]', 'model']], chave); }
  catch (e) {
    if (e.status === 401 || e.status === 403) falha(`A API recusou a chave (HTTP ${e.status}): ${e.corpo}\nConfira se é uma chave de administração de uma organização (contas individuais não têm esta API).`, 3);
    falha(`Falha ao buscar o uso (HTTP ${e.status || 'rede'}): ${e.corpo}`, 3);
  }
  try { custoBuckets = await todasAsPaginas('/v1/organizations/cost_report', [...janela.filter(p => p[0] !== 'bucket_width'), ['group_by[]', 'description']], chave); }
  catch (e) { avisoCusto = `Não consegui o custo (HTTP ${e.status || 'rede'}: ${e.corpo}); segue só com o uso em tokens.`; }
  const mapa = new Map();
  const linha = (dia, modelo) => { const k = dia + '|' + modelo; return mapa.get(k) || (mapa.set(k, { data: dia, modelo, entrada: 0, saida: 0, cache_criado: 0, cache_lido: 0, web_search: 0, custo_usd: 0 }), mapa.get(k)); };
  const diasBuscados = new Set();
  for (const b of usoBuckets) {
    const dia = String(b.starting_at).slice(0, 10); diasBuscados.add(dia);
    for (const r of (b.results || [])) {
      const x = linha(dia, r.model || '(sem modelo)');
      x.entrada += r.uncached_input_tokens || 0; x.saida += r.output_tokens || 0; x.cache_lido += r.cache_read_input_tokens || 0;
      x.cache_criado += ((r.cache_creation || {}).ephemeral_1h_input_tokens || 0) + ((r.cache_creation || {}).ephemeral_5m_input_tokens || 0);
      x.web_search += (r.server_tool_use || {}).web_search_requests || 0;
    }
  }
  for (const b of custoBuckets) {   // amount vem em centavos, como texto decimal ("123.45" = US$ 1,23)
    const dia = String(b.starting_at).slice(0, 10); diasBuscados.add(dia);
    for (const r of (b.results || [])) linha(dia, r.model || '(sem modelo)').custo_usd += (parseFloat(r.amount) || 0) / 100;
  }
  if (avisoCusto) console.log('  Aviso: ' + avisoCusto);
  const novas = [...mapa.values()];
  resumo(gravar(novas, diasBuscados), novas);
}

(opt('--csv') ? Promise.resolve(importaCsv(path.resolve(opt('--csv')))) : importaApi()).catch(e => falha('Erro inesperado: ' + (e && e.stack || JSON.stringify(e))));
