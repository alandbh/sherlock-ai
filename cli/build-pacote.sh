#!/bin/bash
# Monta o pacote de distribuicao do Sherlock CLI (sherlock-cli.zip)
# para enviar aos colegas. Rode este script na sua maquina (Mac):
#
#   bash build-pacote.sh
#
set -euo pipefail

# Pasta do CLI (onde este script vive), independente de onde for chamado.
CLI_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$CLI_DIR"

PKG_NAME="sherlock-cli"
DIST_DIR="$CLI_DIR/dist"
STAGE_DIR="$DIST_DIR/$PKG_NAME"
ZIP_PATH="$DIST_DIR/$PKG_NAME.zip"

echo "==> Limpando build anterior..."
rm -rf "$STAGE_DIR" "$ZIP_PATH"
mkdir -p "$STAGE_DIR"

# 1. Verificacoes de seguranca: o .env compartilhado precisa existir e
#    node_modules precisa estar instalado (para ir embutido no pacote).
if [ ! -f "$CLI_DIR/.env" ]; then
  echo "ERRO: .env nao encontrado em $CLI_DIR. Configure a chave Gemini antes de empacotar." >&2
  exit 1
fi
if [ ! -d "$CLI_DIR/node_modules" ]; then
  echo "ERRO: node_modules nao encontrado. Rode 'npm install' antes de empacotar." >&2
  exit 1
fi

echo "==> Copiando CLI (codigo + dados + dependencias + .env)..."
cp -R bin lib projects node_modules "$STAGE_DIR/"
cp package.json package-lock.json readme.md .env "$STAGE_DIR/"

echo "==> Copiando instaladores e guias..."
cp "dist-tools/Instalar (Mac).command" "$STAGE_DIR/"
cp "dist-tools/Instalar (Windows).bat" "$STAGE_DIR/"
cp "dist-tools/LEIA-ME-PRIMEIRO.md" "$STAGE_DIR/"
cp "dist-tools/README-FIRST.md" "$STAGE_DIR/"

echo "==> Removendo arquivos locais que nao devem viajar..."
find "$STAGE_DIR" -name ".sherlock.json" -delete
find "$STAGE_DIR" -name "*.output.json" -delete
find "$STAGE_DIR" -name ".DS_Store" -delete

echo "==> Dando permissao de execucao ao instalador do Mac..."
chmod +x "$STAGE_DIR/Instalar (Mac).command"

echo "==> Gerando o zip..."
( cd "$DIST_DIR" && zip -r -q "$PKG_NAME.zip" "$PKG_NAME" )

echo ""
echo "=================================================="
echo "  Pacote criado com sucesso!"
echo "=================================================="
echo "  Arquivo: $ZIP_PATH"
echo -n "  Tamanho: "; du -h "$ZIP_PATH" | cut -f1
echo ""
echo "  Envie o sherlock-cli.zip para o(s) colega(s)."
echo "  Eles devem seguir o LEIA-ME-PRIMEIRO.md (ou README-FIRST.md)."
echo ""
