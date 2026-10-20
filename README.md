# Consulta Reforma — site

Site público do **Consulta Reforma**: a pessoa informa e-mail e WhatsApp, adiciona os CNPJs dos
fornecedores (digitando ou por arquivo CSV/TXT) e recebe um relatório dizendo quais fornecedores
geram crédito de CBS/IBS com a Reforma Tributária. Os 2 primeiros CNPJs são grátis.

Site estático (HTML, CSS e JavaScript puro), publicado pelo GitHub Pages.

## Estado atual (demonstração)

| Função | Situação |
|---|---|
| Cadastro (e-mail, WhatsApp, consentimento) | ✅ funciona (ainda não é gravado em servidor) |
| CNPJs digitados ou por CSV/TXT, validação, limite de 2 grátis | ✅ |
| Situação na Receita, Simples, MEI, regime, matriz/filial | ✅ consulta real (BrasilAPI) |
| Crédito estimado (compras por ano × 8,8%) | ✅ |
| Baixar relatório (HTML) / imprimir em PDF | ✅ |
| Certidão federal (Infosimples) | ⏳ precisa de servidor |
| Pagamento acima de 2 CNPJs | ⏳ precisa de servidor + gateway |
| Envio do relatório por e-mail | ⏳ precisa de servidor |
| Feedback gravado | ⏳ precisa de servidor |
| Notícias, Fórum | ⏳ em breve |

Quando o servidor existir, basta preencher `CONFIG.api` em `assets/app.js`.

## Rodar localmente

```bash
python -m http.server 8765
```

e abrir http://localhost:8765
