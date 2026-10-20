# Consulta Reforma — site

Site público do **Consulta Reforma**: a pessoa informa e-mail e WhatsApp, adiciona os CNPJs dos
fornecedores (digitando ou por arquivo CSV/TXT) e recebe um relatório dizendo quais fornecedores
geram crédito de CBS/IBS com a Reforma Tributária. Os 2 primeiros CNPJs são grátis.

Site estático (HTML, CSS e JavaScript puro), publicado pelo GitHub Pages.

## Como funciona

1. Na tela inicial, a pessoa digita o CNPJ na barra de busca (o **+** adiciona mais um) ou envia
   uma lista CSV/TXT.
2. Um pop-up pede e-mail, WhatsApp e o aceite dos termos. Acima de 2 CNPJs, mostra o valor
   (`CONFIG.precoPorCnpj` em `assets/app.js`, hoje um **valor de exemplo**).
3. O resultado aparece na hora, com opção de baixar ou imprimir.

## Privacidade

O site roda só no GitHub Pages, sem servidor. A consulta acontece no navegador de quem usa:
os CNPJs vão direto para a BrasilAPI (base pública de CNPJ), nada é gravado no GitHub nem no
navegador, e tudo some ao fechar a página. Fica só o relatório que a pessoa baixar.

## O que fica para quando houver servidor

Certidão federal automática (Infosimples), pagamento, envio por e-mail e gravação do feedback.
Por enquanto, o relatório traz um botão para a pessoa emitir a certidão grátis no site da
Receita. Quando o servidor existir, basta preencher `CONFIG.api` em `assets/app.js`.

## Rodar localmente

```bash
python -m http.server 8765
```

e abrir http://localhost:8765
