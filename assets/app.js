(function () {
'use strict';

// ---------------------------------------------------------------
// Configuração
// api vazio = modo demonstração: a situação na Receita, o Simples e o MEI
// são consultados de verdade (BrasilAPI); a certidão federal, o pagamento,
// o envio por e-mail e o feedback dependem do servidor e ficam desligados.
// ---------------------------------------------------------------
var CONFIG = {
  gratis: 2,
  cbs: 0.088,
  api: '',
  brasilapi: 'https://brasilapi.com.br/api/cnpj/v1/'
};

var LOGO = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="40" height="40" aria-hidden="true">' +
  '<line x1="41" y1="41" x2="57" y2="57" stroke="#fff" stroke-width="9" stroke-linecap="round"/>' +
  '<circle cx="27" cy="27" r="19" fill="#fff" stroke="#1363df" stroke-width="6"/>' +
  '<path d="M18 27.5l6.5 6.5L37 21" fill="none" stroke="#12a150" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

var D = document;
function $(s, c) { return (c || D).querySelector(s); }
function $$(s, c) { return Array.prototype.slice.call((c || D).querySelectorAll(s)); }

var st = { email: '', whats: '', itens: [], res: [], quando: null };

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
function matrizDe(d) { var b = d.slice(0, 8) + '0001'; return b + dvCnpj(b); }

// "120.000,00" "150000,00" "150000" "1.500" "1500.50" -> número
function num(s) {
  s = String(s || '').replace(/[R$\s"]/g, '');
  if (!s) return null;
  if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  var v = parseFloat(s);
  return isFinite(v) && v >= 0 ? v : null;
}

// ---------------------------------------------------------------
// Assistente (etapas)
// ---------------------------------------------------------------
function irPara(n) {
  $$('.step').forEach(function (el) { el.classList.toggle('hide', el.getAttribute('data-step') !== String(n)); });
  $$('.wiz li').forEach(function (li) {
    var k = +li.getAttribute('data-step');
    li.classList.toggle('on', k === n);
    li.classList.toggle('done', k < n);
  });
  $('#consultar').scrollIntoView({ block: 'start' });
}
$$('[data-back]').forEach(function (b) { b.addEventListener('click', function () { irPara(+b.getAttribute('data-back')); }); });

// Etapa 1 - contato
$('#f-contato').addEventListener('submit', function (ev) {
  ev.preventDefault();
  var email = $('#email').value.trim(), w = dig($('#whats').value), err = $('#err1');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { err.textContent = 'Confira o e-mail.'; $('#email').focus(); return; }
  if (w.length === 10 || w.length === 11) w = '55' + w;
  if (!/^55\d{10,11}$/.test(w)) { err.textContent = 'Confira o WhatsApp, com DDD.'; $('#whats').focus(); return; }
  if (!$('#lgpd').checked) { err.textContent = 'Para continuar, marque a concordância.'; return; }
  err.textContent = '';
  st.email = email; st.whats = w;
  irPara(2);
});

// Etapa 2 - fornecedores
$$('.tabs button').forEach(function (b) {
  b.addEventListener('click', function () {
    var t = b.getAttribute('data-tab');
    $$('.tabs button').forEach(function (x) { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b); });
    $$('.tabp').forEach(function (p) { p.classList.toggle('hide', p.getAttribute('data-tab') !== t); });
  });
});

function adicionar(raw, valor) {
  var d = dig(raw);
  if (d.length === 14 && !cnpjValido(d)) return 'CNPJ inválido: ' + fmtDoc(d);
  if (d.length === 11 && !cpfValido(d)) return 'CPF inválido: ' + fmtDoc(d);
  if (d.length !== 14 && d.length !== 11) return 'Digite um CNPJ com 14 números.';
  var ex = st.itens.filter(function (i) { return i.doc === d; })[0];
  if (ex) { if (valor != null) ex.valor = valor; return null; }
  st.itens.push({ doc: d, valor: valor });
  return null;
}

$('#cnpj').addEventListener('input', function (e) {
  var d = dig(e.target.value).slice(0, 14), partes = [2, 3, 3, 4, 2], sep = ['', '.', '.', '/', '-'], out = '', k = 0;
  for (var i = 0; i < partes.length && k < d.length; i++) { out += sep[i] + d.slice(k, k + partes[i]); k += partes[i]; }
  e.target.value = out;
});

$('#add-manual').addEventListener('submit', function (ev) {
  ev.preventDefault();
  var e = adicionar($('#cnpj').value, num($('#valor').value));
  $('#err2').textContent = e || '';
  if (!e) { $('#cnpj').value = ''; $('#valor').value = ''; $('#cnpj').focus(); }
  desenharLista();
});

var RE_DOC = /(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2}|\d{14}|\d{11})/;
function lerTexto(txt) {
  var ok = 0, ruins = [];
  txt.split(/\r?\n/).forEach(function (linha) {
    var m = linha.match(RE_DOC);
    if (!m) return;
    var resto = linha.slice(m.index + m[0].length).replace(/^[\s;,\t"]+/, '').split(/[;\t]/)[0];
    var e = adicionar(m[0], num(resto));
    if (e) ruins.push(fmtDoc(dig(m[0]))); else ok++;
  });
  var msg = '';
  if (!ok && !ruins.length) msg = 'Não encontramos nenhum CNPJ no arquivo.';
  else if (ruins.length) msg = ruins.length + ' número(s) inválido(s) ignorado(s): ' + ruins.slice(0, 3).join(', ') + (ruins.length > 3 ? '…' : '');
  $('#err2').textContent = msg;
  desenharLista();
}
function lerArquivo(f) {
  if (!f) return;
  if (f.size > 2e6) { $('#err2').textContent = 'Arquivo muito grande (máximo 2 MB).'; return; }
  var r = new FileReader();
  r.onload = function () { lerTexto(String(r.result)); $('#arq').value = ''; };
  r.readAsText(f, /\.csv$/i.test(f.name) ? 'ISO-8859-1' : 'UTF-8');
}
$('#arq').addEventListener('change', function (e) { lerArquivo(e.target.files[0]); });
var drop = $('#drop');
['dragenter', 'dragover'].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
['dragleave', 'drop'].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
drop.addEventListener('drop', function (e) { lerArquivo(e.dataTransfer.files[0]); });

function desenharLista() {
  var ul = $('#lista'), n = st.itens.length, g = CONFIG.gratis;
  ul.innerHTML = st.itens.map(function (it, i) {
    return '<li><div class="d"><b>' + fmtDoc(it.doc) + '</b><small>' +
      (it.valor != null ? 'Compras por ano: ' + brl(it.valor) : 'Sem valor de compras') + '</small></div>' +
      '<span class="tag ' + (i < g ? 'free">Grátis' : 'paid">Pago') + '</span>' +
      '<button class="rm" type="button" data-i="' + i + '" aria-label="Remover ' + fmtDoc(it.doc) + '">×</button></li>';
  }).join('');
  var pay = $('#paywall');
  if (n > g) {
    pay.classList.remove('hide');
    pay.innerHTML = '<b>Você adicionou ' + n + ' fornecedores.</b> Os ' + g + ' primeiros são grátis. ' +
      'Para consultar ' + (n - g === 1 ? 'o outro' : 'os outros ' + (n - g)) + ', a consulta é paga.' +
      (CONFIG.api ? '' : '<br>O pagamento online está sendo ativado. Por enquanto, consultamos os ' + g + ' grátis.') +
      '<br><button class="btn" type="button" disabled>Pagar e consultar todos · em breve</button>';
  } else pay.classList.add('hide');
  var b = $('#go-consulta');
  b.disabled = !n;
  b.textContent = n > g ? 'Consultar os ' + g + ' grátis' : 'Consultar agora';
}
$('#lista').addEventListener('click', function (e) {
  var b = e.target.closest('.rm');
  if (!b) return;
  st.itens.splice(+b.getAttribute('data-i'), 1);
  desenharLista();
});

// ---------------------------------------------------------------
// Consulta e classificação
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
  1: { ic: '✓', st: 'Em dia', acao: 'Gera crédito e está regular. Pode continuar comprando normalmente.' },
  2: { ic: '!', st: 'Atenção', acao: 'Gera crédito, mas a Receita não emitiu a certidão federal. Peça ao fornecedor a certidão negativa de débitos (CND). Sem ela, o crédito fica em risco.' },
  3: { ic: '✕', st: 'Não gera crédito', acao: 'Comprar deste fornecedor não dá direito a crédito integral. Avalie trocar por um fornecedor que gere crédito ou negociar um preço menor.' },
  0: { ic: '?', st: 'Gera crédito · certidão em verificação', acao: 'Fornecedor fora do Simples: as compras dele geram crédito. A verificação automática da certidão federal está sendo ativada; até lá, vale pedir ao fornecedor a certidão negativa de débitos (CND).' }
};
var SITCAD = { BAIXADA: 'encerrado (baixado)', INAPTA: 'irregular (inapto)', SUSPENSA: 'suspenso', NULA: 'anulado' };

function ativoAte(opcao, exclusao, hoje) { return opcao === true && (!exclusao || exclusao.slice(0, 10) > hoje); }

function classificar(it, d) {
  var r = { doc: it.doc, valor: it.valor, nome: '', local: '', det: [], nota: '' };
  var hoje = hojeIso();
  if (it.doc.length === 11) {
    r.nome = 'Pessoa física';
    r.sit = 3; r.motivo = 'Pessoa física (CPF): não destaca CBS/IBS';
    return r;
  }
  if (d._erro) { r.sit = 'x'; r.motivo = d._erro; r.nome = 'Não foi possível consultar'; return r; }
  r.nome = d.razao_social || '';
  if (d.nome_fantasia && d.nome_fantasia !== d.razao_social) r.fantasia = d.nome_fantasia;
  r.local = [d.municipio, d.uf].filter(Boolean).join('/');
  var sc = String(d.descricao_situacao_cadastral || '').toUpperCase();
  var mei = ativoAte(d.opcao_pelo_mei, d.data_exclusao_do_mei, hoje);
  var sim = ativoAte(d.opcao_pelo_simples, d.data_exclusao_do_simples, hoje);
  r.det.push(['Situação na Receita', sc ? sc.charAt(0) + sc.slice(1).toLowerCase() : 'Não informada']);
  r.det.push(['Simples Nacional', sim ? 'Sim, desde ' + dataBr(d.data_opcao_pelo_simples) : 'Não']);
  if (mei) r.det.push(['MEI', 'Sim, desde ' + dataBr(d.data_opcao_pelo_mei)]);
  var reg = (d.regime_tributario || []).slice(-1)[0];
  if (reg && reg.forma_de_tributacao) r.det.push(['Último regime declarado', reg.forma_de_tributacao.charAt(0) + reg.forma_de_tributacao.slice(1).toLowerCase() + ' (' + reg.ano + ')']);
  if (d.identificador_matriz_filial === 2) r.det.push(['Filial', 'A certidão federal é a da matriz, CNPJ ' + fmtDoc(matrizDe(it.doc))]);

  if (sc !== 'ATIVA') { r.sit = 3; r.motivo = 'CNPJ ' + (SITCAD[sc] || sc.toLowerCase()) + ' na Receita'; }
  else if (mei) { r.sit = 3; r.motivo = 'Microempreendedor individual (MEI)'; }
  else if (sim) {
    r.sit = 3; r.motivo = 'Empresa do Simples Nacional';
    if (d.data_exclusao_do_simples) r.nota = 'Este fornecedor tem saída do Simples prevista para ' + dataBr(d.data_exclusao_do_simples) + '. A partir daí, pode passar a gerar crédito integral.';
  } else { r.sit = 0; r.motivo = 'Fora do Simples (Lucro Presumido, Real ou Arbitrado)'; }
  return r;
}

$('#go-consulta').addEventListener('click', function () {
  var lote = st.itens.slice(0, CONFIG.gratis);
  if (!lote.length) return;
  irPara(3);
  var pg = $('#progresso'), bar = $('.bar i', pg), txt = $('p', pg);
  pg.classList.remove('hide');
  $('#relatorio').innerHTML = '';
  $('#rel-actions').classList.add('hide');
  $('#aviso-email').textContent = '';
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
});

// ---------------------------------------------------------------
// Relatório
// ---------------------------------------------------------------
function htmlRelatorio(res, quando) {
  var cont = { 1: 0, 2: 0, 3: 0, 0: 0, x: 0 }, ok = 0, risco = 0, perde = 0, temValor = false;
  res.forEach(function (r) {
    cont[r.sit]++;
    if (r.valor == null) return;
    temValor = true;
    var c = r.valor * CONFIG.cbs;
    if (r.sit === 1 || r.sit === 0) ok += c; else if (r.sit === 2) risco += c; else if (r.sit === 3) perde += c;
  });
  var dt = quando.toLocaleDateString('pt-BR') + ' às ' + quando.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  var h = '<div class="rel"><div class="rel-head" style="display:flex;gap:14px;align-items:center">' + LOGO +
    '<div><h3>Relatório de fornecedores</h3><p>Consulta Reforma · ' + res.length + ' fornecedor(es) · ' + dt + '</p></div></div>';

  h += '<div class="kpis">' +
    '<div class="kpi" style="--c:var(--g)"><b>' + (cont[1] + cont[0]) + '</b><small>geram crédito</small></div>' +
    (cont[2] ? '<div class="kpi" style="--c:var(--y)"><b>' + cont[2] + '</b><small>com pendência</small></div>' : '') +
    '<div class="kpi" style="--c:var(--r)"><b>' + cont[3] + '</b><small>não geram crédito</small></div>';
  if (temValor) {
    h += '<div class="kpi" style="--c:var(--g)"><b>' + brl(ok) + '</b><small>crédito estimado por ano' + (cont[0] ? ' (a confirmar com a certidão)' : '') + '</small></div>' +
      (risco ? '<div class="kpi" style="--c:var(--y)"><b>' + brl(risco) + '</b><small>crédito em risco por ano</small></div>' : '') +
      '<div class="kpi" style="--c:var(--r)"><b>' + brl(perde) + '</b><small>crédito que você deixa de ter por ano</small></div>';
  }
  h += '</div>';

  var ordem = { 3: 0, 2: 1, 0: 2, 1: 3, x: 4 };
  res.slice().sort(function (a, b) { return ordem[a.sit] - ordem[b.sit] || (b.valor || 0) - (a.valor || 0); }).forEach(function (r) {
    var s = r.sit === 'x' ? 0 : r.sit, inf = SIT[s];
    var stx = r.sit === 'x' ? 'Não consultado' : inf.st;
    var acao = r.sit === 'x' ? r.motivo : inf.acao;
    var dl = [['CNPJ/CPF', fmtDoc(r.doc)]];
    if (r.fantasia) dl.push(['Nome fantasia', r.fantasia]);
    if (r.local) dl.push(['Cidade', r.local]);
    if (r.sit !== 'x') dl.push(['Motivo', r.motivo]);
    dl = dl.concat(r.det);
    if (r.valor != null) {
      dl.push(['Compras por ano', brl(r.valor)]);
      var c = brl(r.valor * CONFIG.cbs);
      if (r.sit === 3) dl.push(['Crédito que você deixa de ter', c + ' por ano']);
      else if (r.sit === 2) dl.push(['Crédito em risco', c + ' por ano']);
      else if (r.sit !== 'x') dl.push(['Crédito estimado', c + ' por ano']);
    }
    h += '<article class="fc s' + s + '"><div class="fc-h"><span class="ic">' + inf.ic + '</span><div class="t"><b>' + esc(r.nome) + '</b>' +
      '<span class="st">' + esc(stx) + '</span></div></div>' +
      '<p class="ac">' + esc(acao) + '</p>' + (r.nota ? '<p class="mu">' + esc(r.nota) + '</p>' : '') +
      '<dl>' + dl.map(function (x) { return '<dt>' + esc(x[0]) + '</dt><dd>' + esc(x[1]) + '</dd>'; }).join('') + '</dl></article>';
  });

  h += '<p class="aprox"><b>Valores aproximados.</b> O crédito usa a alíquota da CBS prevista para 2027, cerca de 8,8%, que ainda pode mudar, ' +
    'sobre o valor de compras informado, sem separar produtos com alíquota reduzida. Situação cadastral, Simples e MEI: dados públicos da Receita Federal. ' +
    'Este relatório não substitui a orientação do seu contador.</p></div>';
  return h;
}

function mostrarRelatorio() {
  $('#relatorio').innerHTML = htmlRelatorio(st.res, st.quando);
  $('#rel-actions').classList.remove('hide');
  $('#aviso-email').textContent = CONFIG.api
    ? 'Também enviamos este relatório para ' + st.email + '.'
    : 'Na versão final, este relatório também será enviado para ' + st.email + '. Nesta demonstração, use o botão Baixar relatório.';
  $('#consultar').scrollIntoView({ block: 'start' });
}

function cssDaPagina() {
  var out = '';
  try {
    $$('link[rel=stylesheet]').forEach(function (l) {
      Array.prototype.forEach.call(l.sheet.cssRules, function (r) { if (!/^@media print/.test(r.cssText)) out += r.cssText + '\n'; });
    });
  } catch (e) { out = ''; }
  return out;
}

$('#baixar').addEventListener('click', function () {
  var doc = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>Consulta Reforma · relatório de fornecedores</title><style>' + cssDaPagina() +
    'body{padding:16px}.rel{margin:0 auto}</style></head><body>' + htmlRelatorio(st.res, st.quando) + '</body></html>';
  var a = D.createElement('a');
  a.href = URL.createObjectURL(new Blob([doc], { type: 'text/html;charset=utf-8' }));
  a.download = 'Consulta_Reforma_relatorio_' + hojeIso() + '.html';
  D.body.appendChild(a); a.click(); a.remove();
});
$('#imprimir').addEventListener('click', function () { window.print(); });
$('#nova').addEventListener('click', function () {
  st.itens = []; st.res = [];
  desenharLista();
  $('#err2').textContent = '';
  irPara(2);
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
