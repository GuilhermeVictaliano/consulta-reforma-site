# Consulta Reforma — site

Site público do **Consulta Reforma**: a pessoa informa e-mail e WhatsApp, adiciona os CNPJs dos
fornecedores (digitando ou por arquivo CSV/TXT) e recebe um relatório dizendo quais fornecedores
geram crédito de CBS/IBS com a Reforma Tributária. Os 2 primeiros CNPJs são grátis.

Site estático (HTML, CSS e JavaScript puro), publicado pelo GitHub Pages.

## Como funciona

1. Na tela inicial, a pessoa digita o CNPJ na barra de busca (o **+** adiciona mais um) ou envia
   uma lista CSV/TXT.
2. Um pop-up pede e-mail, WhatsApp e o aceite dos termos. Acima de 2 CNPJs, mostra o valor da
   análise completa (`CONFIG.precoPorCnpj` em `assets/app.js`, hoje **R$ 4,90 de exemplo**).
3. O resultado aparece na hora, e a pessoa baixa o relatório em **PDF com marca d'água**
   (gerado no navegador com jsPDF 4.2.1, em `assets/vendor/`).

## Planos

| Grátis (2 CNPJs) | Análise completa (paga, em breve) |
|---|---|
| Bom fornecedor ou não (gera crédito?) | Quantos CNPJs quiser |
| Regime: Simples, MEI, Lucro Presumido/Real | Certidão federal de cada fornecedor |
| Situação do CNPJ na Receita | Crédito em reais, com base nas compras |
| Relatório em PDF | Relatório no WhatsApp e no e-mail |

## Privacidade

O site roda só no GitHub Pages, sem servidor. A consulta acontece no navegador de quem usa:
os CNPJs vão direto para a BrasilAPI (base pública de CNPJ), nada é gravado no GitHub nem no
navegador, e tudo some ao fechar a página. Fica só o PDF que a pessoa baixar.

## O que fica para quando houver servidor

Análise completa paga (certidão federal pela Infosimples e crédito em reais), pagamento, envio
do PDF por WhatsApp e e-mail e gravação do feedback. Quando o servidor existir, basta preencher
`CONFIG.api` em `assets/app.js`.

## Rodar localmente

```bash
python -m http.server 8765
```

e abrir http://localhost:8765
