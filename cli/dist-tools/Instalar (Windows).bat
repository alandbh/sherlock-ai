@echo off
REM Instalador do Sherlock CLI para Windows.
REM A pessoa so precisa dar um duplo-clique neste arquivo.

setlocal enabledelayedexpansion
cd /d "%~dp0"

echo.
echo ==================================================
echo    Instalando o Sherlock CLI...
echo ==================================================
echo.

REM 1. Verificar se o Node.js esta instalado.
where node >nul 2>nul
if errorlevel 1 (
  echo [X] Node.js nao encontrado.
  echo     Vou abrir a pagina de download. Instale o Node.js ^(versao LTS^),
  echo     depois de um duplo-clique neste instalador de novo.
  start "" "https://nodejs.org/en/download"
  echo.
  pause
  exit /b 1
)

REM 2. Verificar se a versao do Node.js e' 18 ou maior.
for /f "delims=" %%v in ('node -p "process.versions.node.split('.')[0]"') do set NODE_MAJOR=%%v
if !NODE_MAJOR! LSS 18 (
  echo [X] Sua versao do Node.js e' muito antiga ^(precisa ser 18 ou maior^).
  echo     Vou abrir a pagina de download. Atualize e rode este instalador de novo.
  start "" "https://nodejs.org/en/download"
  echo.
  pause
  exit /b 1
)

echo [OK] Node.js encontrado.
echo.
echo Criando o comando 'sherlock'...

REM 3. Criar o comando global 'sherlock'. No Windows o npm global vai para
REM    %AppData%\npm, que ja esta no PATH (sem problema de permissao).
call npm link
if errorlevel 1 (
  echo.
  echo [X] Nao consegui instalar o comando automaticamente.
  echo     Tire um print desta janela e envie para quem te passou o programa.
  echo.
  pause
  exit /b 1
)

echo.
echo ==================================================
echo    Pronto! Instalacao concluida.
echo ==================================================
echo.
echo    Agora feche esta janela, abra o Prompt de Comando
echo    ^(digite "cmd" no menu Iniciar^) e digite:
echo.
echo        sherlock projects
echo.
echo    (Se aparecer a lista de projetos, esta tudo certo.)
echo.
pause
