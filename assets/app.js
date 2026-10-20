(function () {
'use strict';

// ---------------------------------------------------------------
// Configuração
// O site roda só no GitHub Pages: tudo acontece no navegador e nada é gravado.
// Plano grátis (2 CNPJs): bom fornecedor ou não + regime, com dados públicos da BrasilAPI.
// Análise completa (paga, quando houver servidor): certidão federal e crédito em reais.
// precoPorCnpj: valor de EXEMPLO, até o preço ser definido.
// ---------------------------------------------------------------
var CONFIG = {
  gratis: 2,
  precoPorCnpj: 4.90,
  precoDefinido: false,
  api: '',
  brasilapi: 'https://brasilapi.com.br/api/cnpj/v1/',
  site: 'guilhermevictaliano.github.io/consulta-reforma-site'
};

var LOGO = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="40" height="40" aria-hidden="true">' +
  '<line x1="41" y1="41" x2="57" y2="57" stroke="#fff" stroke-width="9" stroke-linecap="round"/>' +
  '<circle cx="27" cy="27" r="19" fill="#fff" stroke="#1363df" stroke-width="6"/>' +
  '<path d="M18 27.5l6.5 6.5L37 21" fill="none" stroke="#12a150" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

var D = document;
function $(s, c) { return (c || D).querySelector(s); }

// Estado só em memória: some ao fechar ou recarregar a página.
var st = { email: '', whats: '', itens: [], res: [], quando: null, faltaram: 0 };

// ---------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------
function dig(s) { return String(s == null ? '' : s).replace(/\D/g, ''); }
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function fmtDoc(d) {
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return d;
}
function brl(v) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function dataBr(iso) { return iso ? iso.slice(0, 10).split('-').reverse().join('/') : ''; }
function hojeIso() { return new Date().toISOString().slice(0, 10); }
function titulo(s) {
  return String(s || '').toLowerCase().replace(/(^|\s)(\S)/g, function (m, a, b) { return a + b.toUpperCase(); })
    .replace(/\s(Do|Da|De|Dos|Das|E)\s/g, function (m) { return m.toLowerCase(); });
}

function dvCnpj(base) {
  function dv(s) {
    var w = s.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    var t = 0;
    for (var i = 0; i < s.length; i++) t += +s[i] * w[i];
    var r = t % 11;
    return r < 2 ? 0 : 11 - r;
  }
  var d1 = dv(base);
  return '' + d1 + dv(base + d1);
}
function cnpjValido(d) { return d.length === 14 && !/^(\d)\1+$/.test(d) && dvCnpj(d.slice(0, 12)) === d.slice(12); }
function cpfValido(d) {
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  for (var t = 9; t < 11; t++) {
    var s = 0;
    for (var i = 0; i < t; i++) s += +d[i] * (t + 1 - i);
    if (((s * 10) % 11) % 10 !== +d[t]) return false;
  }
  return true;
}
function mascara(d) {
  var partes = [2, 3, 3, 4, 2], sep = ['', '.', '.', '/', '-'], out = '', k = 0;
  for (var i = 0; i < partes.length && k < d.length; i++) { out += sep[i] + d.slice(k, k + partes[i]); k += partes[i]; }
  return out;
}

// ---------------------------------------------------------------
// Busca: CNPJs digitados (+) ou por arquivo
// ---------------------------------------------------------------
var inp = $('#cnpj'), errB = $('#err-busca');

function adicionar(raw) {
  var d = dig(raw);
  if (d.length === 14 && !cnpjValido(d)) return 'CNPJ inválido: ' + fmtDoc(d) + '. Confira os números.';
  if (d.length === 11 && !cpfValido(d)) return 'CPF inválido: ' + fmtDoc(d) + '.';
  if (d.length !== 14 && d.length !== 11) return 'Digite um CNPJ com 14 números.';
  if (!st.itens.some(function (i) { return i.doc === d; })) st.itens.push({ doc: d });
  return null;
}

// adiciona o que estiver digitado; devolve false se havia algo inválido
function pegarDigitado() {
  if (!dig(inp.value)) return true;
  var e = adicionar(inp.value);
  errB.textContent = e || '';
  if (e) { inp.focus(); return false; }
  inp.value = '';
  desenharLista();
  return true;
}

inp.addEventListener('input', function () { inp.value = mascara(dig(inp.value).slice(0, 14)); errB.textContent = ''; });
$('#mais').addEventListener('click', function () {
  if (!dig(inp.value)) { errB.textContent = 'Digite um CNPJ e toque no + para adicionar outro.'; inp.focus(); return; }
  if (pegarDigitado()) inp.focus();
});

var RE_DOC = /(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2}|\d{14}|\d{11})/;
function lerTexto(txt) {
  var ok = 0, ruins = [];
  txt.split(/\r?\n/).forEach(function (linha) {
    var m = linha.match(RE_DOC);
    if (!m) return;
    if (adicionar(m[0])) ruins.push(fmtDoc(dig(m[0]))); else ok++;
  });
  var msg = '';
  if (!ok && !ruins.length) msg = 'Não encontramos nenhum CNPJ no arquivo.';
  else if (ruins.length) msg = ruins.length + ' número(s) inválido(s) ignorado(s): ' + ruins.slice(0, 3).join(', ') + (ruins.length > 3 ? '…' : '');
  errB.textContent = msg;
  desenharLista();
}
$('#arq').addEventListener('change', function (e) {
  var f = e.target.files[0];
  if (!f) return;
  if (f.size > 2e6) { errB.textContent = 'Arquivo muito grande (máximo 2 MB).'; return; }
  var r = new FileReader();
  r.onload = function () { lerTexto(String(r.result)); e.target.value = ''; };
  r.readAsText(f, /\.csv$/i.test(f.name) ? 'ISO-8859-1' : 'UTF-8');
});

function calcPreco(n) {
  var extra = Math.max(0, n - CONFIG.gratis);
  return { extra: extra, total: extra * CONFIG.precoPorCnpj };
}
function htmlPreco(n) {
  var p = calcPreco(n);
  if (!p.extra) return '';
  return 'Você tem <b>' + n + ' CNPJs</b>: ' + CONFIG.gratis + ' grátis + análise completa de ' + p.extra + ' × ' + brl(CONFIG.precoPorCnpj) +
    '<span class="tot">Total: ' + brl(p.total) + '</span>' +
    (CONFIG.precoDefinido ? '' : '<small>Valor de exemplo: o preço ainda está sendo definido.</small>');
}

function desenharLista() {
  var n = st.itens.length, g = CONFIG.gratis;
  $('#lista').innerHTML = st.itens.map(function (it, i) {
    return '<li><span class="doc">' + fmtDoc(it.doc) + '</span>' +
      '<span class="tag ' + (i < g ? 'free">Grátis' : 'paid">Análise paga') + '</span>' +
      '<button class="rm" type="button" data-i="' + i + '" aria-label="Remover ' + fmtDoc(it.doc) + '">×</button></li>';
  }).join('');
  var pr = $('#preco'), h = htmlPreco(n);
  pr.innerHTML = h;
  pr.classList.toggle('hide', !h);
  $('#go').textContent = n > 1 ? 'Consultar ' + n + ' fornecedores' : 'Consultar';
}
$('#lista').addEventListener('click', function (e) {
  var b = e.target.closest('.rm');
  if (!b) return;
  st.itens.splice(+b.getAttribute('data-i'), 1);
  desenharLista();
});

// ---------------------------------------------------------------
// Pop-up de contato e termos
// ---------------------------------------------------------------
var modal = $('#modal');
function abrirModal() {
  var n = st.itens.length, g = CONFIG.gratis, p = calcPreco(n);
  $('#m-sub').textContent = n > g
    ? 'Os ' + g + ' primeiros CNPJs são grátis. Informe seu contato para ver o resultado.'
    : 'Informe seu contato para ver o resultado ' + (n > 1 ? 'dos ' + n + ' CNPJs' : 'do CNPJ') + ', grátis.';
  var mp = $('#m-preco');
  mp.innerHTML = htmlPreco(n);
  mp.classList.toggle('hide', !p.extra);
  $('#m-ok').textContent = p.extra ? 'Ver os ' + g + ' grátis' : 'Ver resultado';
  var pg = $('#m-pagar');
  pg.classList.toggle('hide', !p.extra);
  pg.textContent = 'Pagar ' + brl(p.total) + ' pela análise completa' + (CONFIG.api ? '' : ' · em breve');
  pg.disabled = !CONFIG.api;
  $('#err-m').textContent = '';
  if (st.email) { $('#email').value = st.email; $('#whats').value = st.whats; $('#lgpd').checked = true; }
  if (typeof modal.showModal === 'function') modal.showModal(); else modal.setAttribute('open', '');
  setTimeout(function () { (st.email ? $('#m-ok') : $('#email')).focus(); }, 30);
}
function fecharModal() { if (modal.close) modal.close(); else modal.removeAttribute('open'); }
$('#m-fechar').addEventListener('click', fecharModal);
$('#m-termos').addEventListener('click', function () { fecharModal(); });
modal.addEventListener('click', function (e) { if (e.target === modal) fecharModal(); });

$('#busca').addEventListener('submit', function (ev) {
  ev.preventDefault();
  if (!pegarDigitado()) return;
  if (!st.itens.length) { errB.textContent = 'Digite o CNPJ do fornecedor.'; inp.focus(); return; }
  errB.textContent = '';
  abrirModal();
});

$('#f-contato').addEventListener('submit', function (ev) {
  ev.preventDefault();
  var email = $('#email').value.trim(), w = dig($('#whats').value), err = $('#err-m');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { err.textContent = 'Confira o e-mail.'; $('#email').focus(); return; }
  if (w.length === 10 || w.length === 11) w = '55' + w;
  if (!/^55\d{10,11}$/.test(w)) { err.textContent = 'Confira o WhatsApp, com DDD.'; $('#whats').focus(); return; }
  if (!$('#lgpd').checked) { err.textContent = 'Para continuar, aceite os termos.'; return; }
  st.email = email; st.whats = w;
  fecharModal();
  consultar();
});

// ---------------------------------------------------------------
// Consulta e classificação
// sit 1 = bom fornecedor (gera crédito) · sit 3 = não gera crédito · 'x' = não consultado
// ---------------------------------------------------------------
function espera(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

function buscarCnpj(d, tentativa) {
  tentativa = tentativa || 0;
  var ctl = 'AbortController' in window ? new AbortController() : null;
  var t = ctl && setTimeout(function () { ctl.abort(); }, 20000);
  return fetch(CONFIG.brasilapi + d, ctl ? { signal: ctl.signal } : {}).then(function (r) {
    clearTimeout(t);
    if (r.ok) return r.json();
    if ((r.status === 429 || r.status >= 500) && tentativa < 2) return espera(2000 * (tentativa + 1)).then(function () { return buscarCnpj(d, tentativa + 1); });
    if (r.status === 404 || r.status === 400) return { _erro: 'CNPJ não encontrado na Receita.' };
    return { _erro: 'A consulta falhou (código ' + r.status + '). Tente de novo.' };
  }, function () {
    clearTimeout(t);
    if (tentativa < 2) return espera(1500).then(function () { return buscarCnpj(d, tentativa + 1); });
    return { _erro: 'Sem resposta da Receita agora. Tente de novo em alguns minutos.' };
  });
}

var SIT = {
  1: { ic: '✓', st: 'Bom fornecedor', sub: 'Gera crédito integral', acao: 'As compras deste fornecedor geram crédito integral de CBS/IBS. Pode continuar comprando.' },
  3: { ic: '✕', st: 'Não gera crédito', sub: '', acao: 'Comprar deste fornecedor não dá direito a crédito integral. Avalie trocar por um fornecedor que gere crédito ou negociar um preço menor.' },
  x: { ic: '?', st: 'Não consultado', sub: '', acao: '' }
};
var SITCAD = { BAIXADA: 'encerrado (baixado)', INAPTA: 'irregular (inapto)', SUSPENSA: 'suspenso', NULA: 'anulado' };

function ativoAte(opcao, exclusao, hoje) { return opcao === true && (!exclusao || exclusao.slice(0, 10) > hoje); }

function classificar(it, d) {
  var r = { doc: it.doc, nome: '', local: '', regime: '', situacao: '', nota: '' };
  var hoje = hojeIso();
  if (it.doc.length === 11) {
    r.nome = 'Pessoa física';
    r.sit = 3; r.regime = 'Pessoa física (CPF)'; r.motivo = 'Pessoa física não destaca CBS/IBS na nota';
    return r;
  }
  if (d._erro) { r.sit = 'x'; r.motivo = d._erro; r.nome = 'Não foi possível consultar'; return r; }
  r.nome = d.razao_social || '';
  if (d.nome_fantasia && d.nome_fantasia !== d.razao_social) r.fantasia = d.nome_fantasia;
  r.local = [titulo(d.municipio), d.uf].filter(Boolean).join('/');
  var sc = String(d.descricao_situacao_cadastral || '').toUpperCase();
  r.situacao = sc ? titulo(sc) : 'Não informada';
  var mei = ativoAte(d.opcao_pelo_mei, d.data_exclusao_do_mei, hoje);
  var sim = ativoAte(d.opcao_pelo_simples, d.data_exclusao_do_simples, hoje);
  var reg = (d.regime_tributario || []).slice(-1)[0];
  if (mei) r.regime = 'MEI (Simei), desde ' + dataBr(d.data_opcao_pelo_mei);
  else if (sim) r.regime = 'Simples Nacional, desde ' + dataBr(d.data_opcao_pelo_simples);
  else if (reg && reg.forma_de_tributacao) r.regime = titulo(reg.forma_de_tributacao) + ' (último ano declarado: ' + reg.ano + ')';
  else r.regime = 'Fora do Simples (Lucro Presumido ou Real)';

  if (sc !== 'ATIVA') { r.sit = 3; r.motivo = 'CNPJ ' + (SITCAD[sc] || sc.toLowerCase()) + ' na Receita'; }
  else if (mei) { r.sit = 3; r.motivo = 'Microempreendedor individual (MEI)'; }
  else if (sim) {
    r.sit = 3; r.motivo = 'Empresa do Simples Nacional';
    if (d.data_exclusao_do_simples) r.nota = 'Saída do Simples prevista para ' + dataBr(d.data_exclusao_do_simples) + '. A partir daí, pode passar a gerar crédito integral.';
  } else { r.sit = 1; r.motivo = 'Empresa ativa, fora do Simples'; }
  return r;
}

function consultar() {
  var lote = st.itens.slice(0, CONFIG.gratis);
  st.faltaram = st.itens.length - lote.length;
  var sec = $('#resultado'), pg = $('#progresso'), bar = $('.bar i', pg), txt = $('p', pg);
  sec.classList.remove('hide');
  pg.classList.remove('hide');
  $('#relatorio').innerHTML = '';
  $('#rel-actions').classList.add('hide');
  $('#aviso-rel').textContent = '';
  sec.scrollIntoView({ block: 'start' });
  st.res = [];
  var i = 0;
  (function prox() {
    if (i >= lote.length) {
      bar.style.width = '100%';
      st.quando = new Date();
      setTimeout(function () { pg.classList.add('hide'); mostrarRelatorio(); }, 300);
      return;
    }
    var it = lote[i];
    txt.textContent = 'Consultando ' + fmtDoc(it.doc) + ' (' + (i + 1) + ' de ' + lote.length + ')…';
    bar.style.width = (i / lote.length * 100) + '%';
    var p = it.doc.length === 11 ? Promise.resolve({}) : buscarCnpj(it.doc);
    p.then(function (d) {
      st.res.push(classificar(it, d));
      i++;
      setTimeout(prox, 350);
    });
  })();
}

function ordenados(res) {
  var ordem = { 3: 0, 1: 1, x: 2 };
  return res.slice().sort(function (a, b) { return ordem[a.sit] - ordem[b.sit]; });
}
function contar(res) {
  var c = { 1: 0, 3: 0, x: 0 };
  res.forEach(function (r) { c[r.sit]++; });
  return c;
}
function campos(r) {
  var f = [['CNPJ/CPF', fmtDoc(r.doc)]];
  if (r.fantasia) f.push(['Nome fantasia', r.fantasia]);
  if (r.regime) f.push(['Regime', r.regime]);
  if (r.situacao) f.push(['Situação na Receita', r.situacao]);
  if (r.local) f.push(['Cidade', r.local]);
  if (r.sit !== 'x') f.push(['Motivo', r.motivo]);
  return f;
}

// ---------------------------------------------------------------
// Relatório na tela
// ---------------------------------------------------------------
function mostrarRelatorio() {
  var c = contar(st.res);
  var dt = st.quando.toLocaleDateString('pt-BR') + ' às ' + st.quando.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  var h = '<div class="rel"><div class="rel-head" style="display:flex;gap:14px;align-items:center">' + LOGO +
    '<div><h3>Seus fornecedores</h3><p>Consulta grátis · ' + st.res.length + ' fornecedor(es) · ' + dt + '</p></div></div>' +
    '<div class="kpis"><div class="kpi" style="--c:var(--g)"><b>' + c[1] + '</b><small>bons fornecedores (geram crédito)</small></div>' +
    '<div class="kpi" style="--c:var(--r)"><b>' + c[3] + '</b><small>não geram crédito</small></div></div>';
  if (st.faltaram) h += '<p class="aprox">' + st.faltaram + ' CNPJ(s) da sua lista ficaram para a análise completa, que vai ser liberada com o pagamento.</p>';
  ordenados(st.res).forEach(function (r) {
    var inf = SIT[r.sit], s = r.sit === 'x' ? 's0' : 's' + r.sit;
    var acao = r.sit === 'x' ? r.motivo : inf.acao;
    h += '<article class="fc ' + s + '"><div class="fc-h"><span class="ic">' + inf.ic + '</span><div class="t"><b>' + esc(r.nome) + '</b>' +
      '<span class="st">' + esc(inf.st) + '</span></div></div>' +
      '<p class="ac">' + esc(acao) + '</p>' + (r.nota ? '<p class="mu">' + esc(r.nota) + '</p>' : '') +
      '<dl>' + campos(r).map(function (x) { return '<dt>' + esc(x[0]) + '</dt><dd>' + esc(x[1]) + '</dd>'; }).join('') + '</dl></article>';
  });
  h += '<p class="aprox"><b>Quer saber quanto crédito você perde?</b> A análise completa traz a certidão federal de cada fornecedor e o crédito em reais, ' +
    'calculado com as suas compras. Em breve, com o relatório entregue no seu WhatsApp e e-mail.</p></div>';
  $('#relatorio').innerHTML = h;
  $('#rel-actions').classList.remove('hide');
  $('#aviso-rel').textContent = 'Esta consulta não fica guardada: ao fechar a página, ela é apagada. Baixe o PDF para guardar uma cópia.';
  $('#resultado').scrollIntoView({ block: 'start' });
}

// ---------------------------------------------------------------
// Relatório em PDF, com marca d'água
// ---------------------------------------------------------------
var COR = { navy: [11, 37, 69], blue: [19, 99, 223], g: [18, 161, 80], r: [208, 57, 46], n: [91, 107, 133], mu: [82, 96, 122], bd: [217, 225, 236], bg: [245, 247, 251] };

function svgParaPng(svg, px) {
  return new Promise(function (ok) {
    var img = new Image();
    img.onload = function () {
      var c = D.createElement('canvas');
      c.width = c.height = px;
      c.getContext('2d').drawImage(img, 0, 0, px, px);
      ok(c.toDataURL('image/png'));
    };
    img.onerror = function () { ok(null); };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

function gerarPdf(logo) {
  var doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
  var W = 210, H = 297, M = 15, CW = W - 2 * M, y;
  var dt = st.quando.toLocaleDateString('pt-BR') + ' às ' + st.quando.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  function cor(c, tipo) { doc['set' + tipo + 'Color'](c[0], c[1], c[2]); }

  function cabecalho() {
    cor(COR.navy, 'Fill'); doc.rect(0, 0, W, 30, 'F');
    cor(COR.blue, 'Fill'); doc.rect(0, 30, W, 1.2, 'F');
    if (logo) doc.addImage(logo, 'PNG', M, 6, 18, 18);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text('Consulta Reforma', M + 22, 14.5);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(201, 214, 234);
    doc.text('Relatório de fornecedores · consulta grátis', M + 22, 21);
    doc.text(dt, W - M, 14.5, { align: 'right' });
    y = 42;
  }
  function novaPagina() { doc.addPage(); cabecalho(); }
  function cabe(h) { if (y + h > H - 22) novaPagina(); }

  cabecalho();
  var c = contar(st.res);
  doc.setTextColor.apply(doc, COR.navy);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.text('Resumo', M, y); y += 7;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); cor(COR.mu, 'Text');
  var resumo = doc.splitTextToSize('Com a Reforma Tributária, a empresa só desconta a CBS e o IBS das compras feitas de fornecedores que geram crédito. ' +
    'Veja abaixo a situação de cada fornecedor consultado.', CW);
  doc.text(resumo, M, y); y += resumo.length * 5 + 3;
  var bw = (CW - 6) / 2;
  [[COR.g, c[1], 'bons fornecedores (geram crédito)'], [COR.r, c[3], 'não geram crédito']].forEach(function (k, i) {
    var x = M + i * (bw + 6);
    cor(COR.bg, 'Fill'); cor(COR.bd, 'Draw'); doc.setLineWidth(0.3); doc.roundedRect(x, y, bw, 20, 2.5, 2.5, 'FD');
    cor(k[0], 'Fill'); doc.rect(x, y, bw, 1.6, 'F');
    cor(COR.navy, 'Text'); doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.text(String(k[1]), x + 5, y + 11);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); cor(COR.mu, 'Text'); doc.text(k[2], x + 5, y + 16.5);
  });
  y += 28;
  if (st.faltaram) {
    doc.setFontSize(9.5); cor(COR.mu, 'Text');
    var f = doc.splitTextToSize(st.faltaram + ' CNPJ(s) da sua lista ficaram para a análise completa (paga), que não faz parte deste relatório.', CW);
    doc.text(f, M, y); y += f.length * 4.6 + 3;
  }

  ordenados(st.res).forEach(function (r) {
    var inf = SIT[r.sit], cc = r.sit === 1 ? COR.g : r.sit === 3 ? COR.r : COR.n, tx = CW - 22;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
    var nome = doc.splitTextToSize(r.nome, tx);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
    var acao = doc.splitTextToSize(r.sit === 'x' ? r.motivo : inf.acao, tx);
    var nota = r.nota ? doc.splitTextToSize(r.nota, tx) : [];
    var linhas = campos(r).map(function (k) { return [k[0], doc.splitTextToSize(k[1], tx - 38)]; });
    var hc = 9 + nome.length * 5.2 + 6 + acao.length * 4.4 + 2 + nota.length * 4.4 +
      (nota.length ? 2 : 0) + linhas.reduce(function (s, k) { return s + k[1].length * 4.4 + 0.8; }, 0) + 1;
    cabe(hc);
    cor([255, 255, 255], 'Fill'); cor(COR.bd, 'Draw'); doc.setLineWidth(0.3); doc.roundedRect(M, y, CW, hc, 2.5, 2.5, 'FD');
    cor(cc, 'Fill'); doc.rect(M, y, 2.2, hc, 'F');
    var cx = M + 10, cy = y + 9;
    doc.circle(cx, cy, 4.2, 'F');
    doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.9);
    if (r.sit === 1) doc.lines([[1.5, 1.6], [3, -3.4]], cx - 2.2, cy + 0.1);
    else if (r.sit === 3) { doc.line(cx - 1.7, cy - 1.7, cx + 1.7, cy + 1.7); doc.line(cx + 1.7, cy - 1.7, cx - 1.7, cy + 1.7); }
    else { doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(255, 255, 255); doc.text('?', cx, cy + 1.3, { align: 'center' }); }
    var x = M + 18, yy = y + 8;
    cor(COR.navy, 'Text'); doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text(nome, x, yy); yy += nome.length * 5.2;
    cor(cc, 'Text'); doc.setFontSize(10); doc.text(inf.st + (inf.sub ? ' · ' + inf.sub : ''), x, yy); yy += 6;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); cor(COR.navy, 'Text'); doc.text(acao, x, yy); yy += acao.length * 4.4 + 2;
    if (nota.length) { cor(COR.mu, 'Text'); doc.text(nota, x, yy); yy += nota.length * 4.4 + 2; }
    linhas.forEach(function (k) {
      doc.setFontSize(9); cor(COR.mu, 'Text'); doc.text(k[0], x, yy);
      cor(COR.navy, 'Text'); doc.text(k[1], x + 38, yy);
      yy += k[1].length * 4.4 + 0.8;
    });
    y += hc + 4;
  });

  var up = doc.splitTextToSize('Quer saber quanto crédito você perde? A análise completa traz a certidão federal de cada fornecedor e o crédito em reais, ' +
    'calculado com as suas compras, com o relatório entregue no seu WhatsApp e e-mail. Saiba mais em ' + CONFIG.site + '.', CW - 10);
  var hu = up.length * 4.6 + 8;
  cabe(hu);
  doc.setFillColor(232, 241, 255); doc.roundedRect(M, y, CW, hu, 2.5, 2.5, 'F');
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); cor(COR.navy, 'Text'); doc.text(up, M + 5, y + 6.5);

  // rodapé e marca d'água em todas as páginas
  var n = doc.getNumberOfPages(), wm = 'CONSULTA REFORMA', ang = 42, rad = ang * Math.PI / 180;
  for (var p = 1; p <= n; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); cor(COR.mu, 'Text');
    var disc = doc.splitTextToSize('Classificação com base em dados públicos da Receita Federal na data da consulta. Fora do Simples e CNPJ ativo = gera crédito integral; ' +
      'Simples, MEI, pessoa física ou CNPJ irregular = não gera crédito integral. Não substitui a orientação do seu contador. Gerado para ' + st.email + '.', CW - 22);
    doc.text(disc, M, H - 13);
    doc.text('Página ' + p + ' de ' + n, W - M, H - 13, { align: 'right' });
    doc.setGState(new doc.GState({ opacity: 0.07 }));
    doc.setFont('helvetica', 'bold'); doc.setFontSize(64); cor(COR.navy, 'Text');
    var ww = doc.getTextWidth(wm);
    doc.text(wm, W / 2 - ww / 2 * Math.cos(rad), H / 2 + ww / 2 * Math.sin(rad), { angle: ang });
    if (logo) doc.addImage(logo, 'PNG', W / 2 - 22, H / 2 + 38, 44, 44);
    doc.setGState(new doc.GState({ opacity: 1 }));
  }
  doc.save('Consulta_Reforma_relatorio_' + hojeIso() + '.pdf');
}

$('#baixar').addEventListener('click', function () {
  var b = this;
  if (!window.jspdf) { $('#aviso-rel').textContent = 'Não foi possível gerar o PDF agora. Recarregue a página e tente de novo.'; return; }
  b.disabled = true; b.textContent = 'Gerando PDF…';
  svgParaPng(LOGO.replace('width="40" height="40"', 'width="256" height="256"'), 256).then(function (logo) {
    try { gerarPdf(logo); } catch (e) { $('#aviso-rel').textContent = 'Não foi possível gerar o PDF. Tente de novo.'; }
    b.disabled = false; b.textContent = 'Baixar relatório em PDF';
  });
});
$('#nova').addEventListener('click', function () {
  st.itens = []; st.res = []; st.faltaram = 0;
  desenharLista();
  $('#resultado').classList.add('hide');
  $('#relatorio').innerHTML = '';
  errB.textContent = '';
  $('#inicio').scrollIntoView({ block: 'start' });
  inp.focus();
});

// ---------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------
$('#f-feedback').addEventListener('submit', function (ev) {
  ev.preventDefault();
  var msg = $('#fb-msg').value.trim(), err = $('#err-fb'), ok = $('#ok-fb');
  if (msg.length < 3) { err.textContent = 'Escreva sua mensagem.'; $('#fb-msg').focus(); return; }
  err.textContent = '';
  var nota = ($('input[name=nota]:checked') || {}).value || null;
  var dados = { nota: nota, tipo: $('#fb-tipo').value, mensagem: msg, email: $('#fb-email').value.trim() };
  function pronto(t) { ok.textContent = t; ok.classList.remove('hide'); ev.target.reset(); }
  if (!CONFIG.api) { pronto('Obrigado pelo feedback! Nesta demonstração ele ainda não é enviado ao servidor; o envio será ativado em breve.'); return; }
  fetch(CONFIG.api + '/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) })
    .then(function (r) { if (!r.ok) throw r; pronto('Obrigado pelo feedback! Recebemos sua mensagem.'); })
    .catch(function () { err.textContent = 'Não conseguimos enviar agora. Tente de novo em alguns minutos.'; });
});

desenharLista();
})();
