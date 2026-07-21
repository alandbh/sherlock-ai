# Sherlock CLI — Guia Rápido

Bem-vindo(a)! O **Sherlock** é uma ferramenta que analisa vídeos e imagens de evidência e dá uma nota (1 a 5) para cada heurística de UX, com justificativa. Você usa tudo pelo **Terminal** — sem navegador, sem código.

Você só precisa fazer a instalação **uma vez**. Depois, é só usar.

---

## Passo 1 — Instalar o Node.js (uma vez só)

O Sherlock precisa de um programa gratuito chamado **Node.js**.

1. Acesse: **https://nodejs.org**
2. Baixe a versão **LTS** (o botão da esquerda).
3. Abra o arquivo baixado e clique **Avançar → Avançar → Concluir**.

> Se você já tem o Node.js instalado, pode pular este passo.

---

## Passo 2 — Instalar o Sherlock (uma vez só)

1. **Descompacte** o arquivo `sherlock-cli.zip` (clique com o botão direito → Extrair).
2. Abra a pasta que apareceu e dê **duplo-clique** no instalador do seu sistema:
   - **Mac:** `Instalar (Mac).command`
   - **Windows:** `Instalar (Windows).bat`
3. Uma janela preta vai abrir e fazer tudo sozinha. Quando aparecer **"Pronto! Instalação concluída"**, feche a janela.

> **No Mac**, na primeira vez o sistema pode bloquear o arquivo. Se isso acontecer:
> vá em **Ajustes do Sistema → Privacidade e Segurança**, role até o final e clique em **"Abrir Mesmo Assim"**. Depois dê o duplo-clique de novo.

Depois de instalar, **feche e reabra o Terminal** e digite:

```
sherlock projects
```

Se aparecer a lista de projetos (retail6, finance5, rnortham1), está tudo certo! 🎉

---

## Passo 3 — Usar no dia a dia

### 3.1 — Abra o Terminal **na pasta onde estão os vídeos**

- **Mac:** abra o Terminal e **arraste a pasta dos vídeos para cima da janela do Terminal** (ou clique com o botão direito na pasta → *Novo Terminal na Pasta*).
- **Windows:** abra a pasta dos vídeos no Explorer, clique na **barra de endereço**, digite `cmd` e aperte Enter.

### 3.2 — Analise um vídeo

O comando é: `sherlock` + o nome do vídeo + o número da heurística.

```
sherlock video.mp4 3.16
```

Exemplos úteis:

```
sherlock video.mp4 3.10,3.16          (várias heurísticas de uma vez)
sherlock v2-web-m 3.10                 (nome parcial: acha "v2-web-mobile.mov")
sherlock -p rnortham1 video.mp4 3.16   (escolhendo o projeto com -p)
```

### 3.3 — O jeito mais fácil: **análise em lote**

Em vez de rodar um por um, crie um arquivo de texto simples (ex.: `lista.txt`) com uma linha por análise:

```
3.10 video-busca.mp4
3.16 video-checkout.mp4
2.2 cindy.mp4,miranda.mp4
```

Depois rode **um comando só**:

```
sherlock batch lista.txt
```

O resultado é salvo automaticamente em `results_lista.txt`, na mesma pasta.

> Veja mais modelos de lista prontos na pasta `examples/` e a documentação completa no `readme.md`.

---

## Onde ficam os resultados?

- Análise em lote: salva sozinho em `results_<nome-do-arquivo>.txt`.
- Análise avulsa: aparece no Terminal. Para salvar num arquivo, adicione `-o resultado.txt`:

```
sherlock video.mp4 3.16 -o resultado.txt
```

---

## Recebi heurísticas ou projetos atualizados. E agora?

- **Heurísticas** se atualizam **sozinhas** toda vez que você roda o Sherlock (ele busca a versão mais recente automaticamente). Você não precisa fazer nada.
- Se te enviarem uma **pasta de projeto atualizada** (ex.: `rnortham1`), basta colocá-la dentro da pasta `projects/` da sua instalação, substituindo a antiga.

---

## Problemas comuns

| Aconteceu isso | Faça isso |
| --- | --- |
| `command not found: sherlock` (ou "não é reconhecido") | Feche e reabra o Terminal. Se persistir, rode o instalador de novo. |
| Apareceu um aviso amarelo sobre "sincronizar heurísticas" | Normal — significa que o servidor de heurísticas está fora do ar ou você está sem VPN. O Sherlock continua funcionando com as heurísticas que já vêm no pacote. |
| "Node.js não encontrado" | Volte ao **Passo 1** e instale o Node.js. |
| Deu erro que você não entendeu | Tire um print do Terminal e envie para quem te passou o programa. |
