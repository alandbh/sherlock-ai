# Sherlock CLI

Ferramenta de linha de comando para análise heurística de UX em e-commerces e aplicativos, utilizando a API do Google Gemini para avaliar vídeos e imagens de evidência.

---

## Índice

- [O que é](#o-que-é)
- [Como funciona](#como-funciona)
- [Pré-requisitos](#pré-requisitos)
- [Instalação](#instalação)
- [Configuração](#configuração)
- [Como usar](#como-usar)
- [Comandos](#comandos)
  - [Análise simples](#análise-simples)
  - [projects](#projects)
  - [heuristics](#heuristics)
  - [init](#init)
  - [Em lote](#batch)
- [Projetos](#projetos)
- [Projetos Retail vs Finance](#projetos-retail-vs-finance)
- [Formatos de saída](#formatos-de-saída)
- [Exemplos](#exemplos)

---

## O que é

O **Sherlock CLI** é uma interface de terminal que permite realizar avaliações heurísticas de UX sem usar o navegador. Você envia vídeos ou imagens de evidência e o Sherlock utiliza o modelo Gemini 2.5 Pro para analisar cada heurística, retornando score (1–5) e justificativa.

Principais características:

- Análise de vídeos e imagens locais (um ou vários por heurística)
- Suporte a múltiplos projetos (cada um com heurísticas e prompts próprios)
- Nome parcial de arquivo (ex: `v2-web-m` encontra `v2-web-mobile-amazon.mov`)
- Análise em lote via arquivo TXT ou JSON
- Saída em TXT ou JSON

---

## Como funciona

1. **Upload**: O vídeo/imagem é enviado para a API Files do Gemini
2. **Processamento**: O Gemini processa o arquivo até ficar disponível (ACTIVE)
3. **Análise**: O Sherlock monta um prompt com as heurísticas selecionadas e o system prompt do projeto
4. **Resultado**: O Gemini retorna score e justificativa em JSON, exibidos no terminal ou salvos em arquivo

O CLI funciona de qualquer diretório do computador, não requer servidor local e não depende do Cursor ou de qualquer IDE estar aberto.

---

## Pré-requisitos

- **Node.js** 18 ou superior
- **Chave da API do Gemini** ([Google AI Studio](https://aistudio.google.com/apikey))

---

## Instalação

```bash
cd cli
npm install
npm link
```

O comando `npm link` instala o `sherlock` globalmente, permitindo usá-lo de qualquer pasta.

---

## Configuração

1. Copie o arquivo de exemplo e edite com sua chave:

```bash
cp .env.example .env
```

1. Edite o `.env` e adicione sua chave do Gemini:

```
GEMINI_API_KEY=sua-chave-aqui
```

O arquivo `.env` fica na pasta `cli/` e é carregado automaticamente a cada execução.

---

## Como usar

### Uso básico

```bash
# Navegue até a pasta onde estão os vídeos
cd ~/evidencias/web-mobile

# Execute uma análise
sherlock video.mp4 3.16
```

### Projetos

Cada projeto tem suas próprias heurísticas e system prompt. Use a flag `-p` para escolher:

```bash
# Retail - só heurística + evidência
sherlock -p retail6 video.mp4 3.16

# Finance - exige jornada (-j com slug)
sherlock -p finance5 -j abertura video.mp4 1.3
sherlock -p finance5 -j app video.mp4 3.16
```

Ou vincule o diretório atual a um projeto para não precisar da flag:

```bash
sherlock init retail6
sherlock video.mp4 3.16   # Usa retail6 automaticamente
```

---

## Comandos

### Análise simples

Analisa um ou mais vídeos/imagens com as heurísticas informadas.

```bash
sherlock <video> <heuristicas> [opções]
```


| Argumento     | Descrição                                                                 |
| ------------- | ------------------------------------------------------------------------- |
| `video`       | Caminho do vídeo ou imagem (aceita nome parcial). Vários: `v1.mp4,v2.mp4` |
| `heuristicas` | Números das heurísticas separados por vírgula (ex: 3.16,3.18)             |



| Opção                    | Descrição                                                    |
| ------------------------ | ------------------------------------------------------------ |
| `-p, --project <nome>`   | Nome do projeto (retail6, finance5, etc)                     |
| `-j, --journey <slug>`   | Jornada (obrigatório em projetos Finance; ex: abertura, app) |
| `-c, --context <texto>`  | Contexto adicional para a análise                            |
| `-o, --output <arquivo>` | Salvar resultado (txt, json, ou nome.ext)                    |
| `-v, --version`          | Exibir versão do CLI                                         |
| `-h, --help`             | Exibir ajuda                                                 |


**Exemplos:**

```bash
sherlock video.mp4 3.16
sherlock -p finance5 -j abertura video.mp4 1.3
sherlock v2-web-m 3.10,3.16 -c "Magazine Luiza App"
sherlock evidencia.png 4.10 -o resultado.txt
sherlock video.mp4 3.16 -o json

# Múltiplos vídeos (ex.: heurísticas 2.2 Cindy vs Mike, 3.16 Cindy vs Miranda)
sherlock cindy.mp4,miranda.mp4 2.2
sherlock v-cindy.mp4,v-miranda.mp4 3.16
```

---

### projects

Lista todos os projetos disponíveis e a quantidade de heurísticas de cada um.

```bash
sherlock projects
```

**Exemplo de saída:**

```
📁 Projetos disponíveis:

  retail6 - Heurísticas para e-commerce e varejo (Retail 6)
    46 heurísticas
```

---

### heuristics

Lista as heurísticas de um projeto, agrupadas por categoria.

```bash
sherlock heuristics [opções]
```


| Opção                  | Descrição                                      |
| ---------------------- | ---------------------------------------------- |
| `-p, --project <nome>` | Nome do projeto (usa default se não informado) |
| `-g, --group <numero>` | Filtrar por número do grupo (ex: 3)            |
| `-j, --journey <slug>` | Filtrar por jornada (projetos Finance)         |
| `-h, --help`           | Exibir ajuda                                   |


**Exemplos:**

```bash
sherlock heuristics
sherlock heuristics -p retail6
sherlock heuristics -p finance5 -j abertura
sherlock heuristics -g 3
```

---

### init

Vincula o diretório atual a um projeto, criando um arquivo `.sherlock.json`. A partir daí, o comando `sherlock` usa esse projeto automaticamente sem a flag `-p`.

```bash
sherlock init <projeto>
```

**Exemplo:**

```bash
cd ~/projetos/mercado-livre
sherlock init retail6
# Agora: sherlock video.mp4 3.16 usa retail6 automaticamente
```

---

### Análise em lote

Analisa múltiplas heurísticas em sequência, cada uma com seu respectivo vídeo/imagem, a partir de um arquivo de lista.

```bash
sherlock batch <arquivo> [opções]
```


| Argumento | Descrição                                              |
| --------- | ------------------------------------------------------ |
| `arquivo` | Caminho do arquivo TXT ou JSON com a lista de análises |



| Opção                    | Descrição                                               |
| ------------------------ | ------------------------------------------------------- |
| `-p, --project <nome>`   | Nome do projeto                                         |
| `-c, --context <texto>`  | Contexto global (aplicado a todas as análises)          |
| `-o, --output <arquivo>` | Formato de saída (txt, json, ou nome.ext). Default: txt |
| `--continue-on-error`    | Continuar mesmo se uma análise falhar                   |
| `-h, --help`             | Exibir ajuda                                            |


**Formato TXT:**

```
# Comentários são ignorados
# Retail:
3.10 v3-mercadolivre.mp4
3.16 v4-mercadolivre.mp4

# Finance (heuristica:jornada):
1.3:abertura v1-abertura.mp4
3.16:app v2-app.mp4

# Múltiplos vídeos (separados por vírgula):
3.16 v-cindy.mp4,v-miranda.mp4
2.2:abertura cindy.mp4,mike.mp4
```

**Formato JSON:**

```json
[
  { "heuristic": "3.10", "evidence": "v3-mercadolivre.mp4" },
  { "heuristic": "1.3", "journey": "abertura", "evidence": "v1-abertura.mp4" },
  { "heuristic": "3.16", "evidence": "v4-mercadolivre.mp4", "context": "Persona Miranda" },
  { "heuristic": "2.2", "evidence": ["cindy.mp4", "mike.mp4"] }
]
```

`evidence` pode ser string (um arquivo), string com vírgulas (`"v1.mp4,v2.mp4"`) ou array (`["v1.mp4","v2.mp4"]`).

**Exemplos:**

```bash
sherlock batch lista.txt
sherlock batch lista.txt -o json
sherlock batch lista.txt -c "Mercado Livre iOS" -o analise.txt
sherlock batch lista.json --continue-on-error
```

**Saída padrão:** O batch salva automaticamente em `results_<nome-do-arquivo>.txt`. Use `-o json` para salvar em JSON.

---

## Projetos Retail vs Finance

**Retail** (retail6, etc.): Cada heurística tem número único. Informe apenas heurística + evidência.

**Finance** (finance5, etc.): Heurísticas podem ter o mesmo número em jornadas diferentes. É obrigatório informar a jornada pelo slug:

- Análise simples: `sherlock -p finance5 -j abertura video.mp4 1.3`
- Batch TXT: `1.3:abertura v1.mp4` (formato `heuristica:jornada arquivo`)
- Batch JSON: `{ "heuristic": "1.3", "journey": "abertura", "evidence": "v1.mp4" }`

Use `sherlock heuristics -p finance5 -j abertura` para listar heurísticas de uma jornada.

---

## Projetos

Os projetos ficam em `cli/projects/`. Cada projeto é uma pasta com:

- `heuristics.json` – lista de heurísticas
- `system_prompt.txt` – instruções para o Gemini
- `meta.json` – metadados (opcional)

Para adicionar um novo projeto, crie uma pasta em `projects/` com esses arquivos:

```
cli/projects/
├── retail6/
│   ├── heuristics.json
│   ├── system_prompt.txt
│   └── meta.json
├── finance/
│   ├── heuristics.json
│   └── system_prompt.txt
└── ...
```

---

## Formatos de saída

### TXT (padrão no batch)

Arquivo legível com cabeçalho, scores e justificativas:

```
# Análise Sherlock (Batch) - 24/02/2026 14:30:00
# Projeto: retail6
# Arquivo: lista.txt

## 3.10 - It's possible to make a image-based search
Arquivo: v3-mercadolivre.mp4
Score: 5/5

A plataforma oferece busca por imagem funcional...

---
```

### JSON

Estrutura completa com resultados, metadados e uso de tokens.

---

## Exemplos

```bash
# Análise única
sherlock video.mp4 3.16

# Múltiplas heurísticas
sherlock video.mp4 3.10,3.16,4.10

# Nome parcial de arquivo
sherlock v2-web-m 3.10

# Com contexto e salvando
sherlock video.mp4 3.16 -c "App iOS" -o resultado.txt

# Finance - com jornada
sherlock -p finance5 -j abertura video.mp4 1.3

# Múltiplos vídeos (heurísticas comparativas)
sherlock cindy.mp4,miranda.mp4 2.2

# Análise em lote (Retail)
sherlock batch lista.txt

# Análise em lote (Finance - formato 3.16:abertura)
sherlock batch lista-finance.txt -p finance5

# Batch com JSON de saída
sherlock batch lista.txt -o json

# Listar heurísticas do grupo 3
sherlock heuristics -g 3

# Listar heurísticas da jornada abertura (Finance)
sherlock heuristics -p finance5 -j abertura

# Vincular diretório ao projeto retail6
sherlock init retail6
```

