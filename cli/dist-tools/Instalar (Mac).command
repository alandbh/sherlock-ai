#!/bin/bash
# Instalador do Sherlock CLI para macOS.
# A pessoa só precisa dar um duplo-clique neste arquivo.

# Vai para a pasta onde este instalador está (a raiz do Sherlock CLI).
cd "$(dirname "$0")" || exit 1

echo ""
echo "=================================================="
echo "   Instalando o Sherlock CLI..."
echo "=================================================="
echo ""

# 1. Verificar se o Node.js está instalado.
if ! command -v node >/dev/null 2>&1; then
  echo "[X] Node.js nao encontrado."
  echo "    Vou abrir a pagina de download. Instale o Node.js (versao LTS),"
  echo "    depois de um duplo-clique neste instalador de novo."
  open "https://nodejs.org/pt-br/download"
  echo ""
  read -n 1 -s -r -p "Pressione qualquer tecla para fechar."
  echo ""
  exit 1
fi

# 2. Verificar se a versao do Node.js e' 18 ou maior.
NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]" 2>/dev/null)
if [ -z "$NODE_MAJOR" ] || [ "$NODE_MAJOR" -lt 18 ]; then
  echo "[X] Sua versao do Node.js e' muito antiga (precisa ser 18 ou maior)."
  echo "    Vou abrir a pagina de download. Atualize e rode este instalador de novo."
  open "https://nodejs.org/pt-br/download"
  echo ""
  read -n 1 -s -r -p "Pressione qualquer tecla para fechar."
  echo ""
  exit 1
fi

echo "[OK] Node.js $(node -v) encontrado."
echo ""
echo "Criando o comando 'sherlock'..."

# 3. Criar o comando global 'sherlock' com npm link.
#    Se falhar por permissao, usa um prefixo npm na pasta do usuario (sem senha).
if npm link >/dev/null 2>&1; then
  echo "[OK] Comando 'sherlock' instalado."
else
  echo "Ajustando permissoes (sem precisar de senha)..."
  npm config set prefix "$HOME/.npm-global" >/dev/null 2>&1

  # Garante que a pasta de comandos do usuario esteja no PATH do zsh.
  PROFILE="$HOME/.zshrc"
  LINE='export PATH="$HOME/.npm-global/bin:$PATH"'
  if ! grep -qF "$LINE" "$PROFILE" 2>/dev/null; then
    echo "$LINE" >> "$PROFILE"
  fi
  export PATH="$HOME/.npm-global/bin:$PATH"

  if npm link >/dev/null 2>&1; then
    echo "[OK] Comando 'sherlock' instalado."
  else
    echo ""
    echo "[X] Nao consegui instalar o comando automaticamente."
    echo "    Tire um print desta janela e envie para quem te passou o programa."
    echo ""
    read -n 1 -s -r -p "Pressione qualquer tecla para fechar."
    echo ""
    exit 1
  fi
fi

echo ""
echo "=================================================="
echo "   Pronto! Instalacao concluida."
echo "=================================================="
echo ""
echo "   Agora FECHE E REABRA o Terminal e digite:"
echo ""
echo "       sherlock projects"
echo ""
echo "   (Se aparecer a lista de projetos, esta tudo certo.)"
echo ""
read -n 1 -s -r -p "Pressione qualquer tecla para fechar."
echo ""
