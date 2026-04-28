@echo off
title Logistique D3 — Démarrage
color 0A

echo.
echo  =============================================
echo   LOGISTIQUE D3 — Lancement en cours...
echo  =============================================
echo.

:: Tuer l'ancien processus sur le port 3000 si existant
echo  [1/3] Arrêt de l'ancienne session...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 " ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)
timeout /t 1 /nobreak >nul

:: Lancer le serveur Node.js en arrière-plan
echo  [2/3] Démarrage du serveur...
cd /d "%~dp0backend"
start /B node dist\main > "%TEMP%\logistique-d3.log" 2>&1

:: Attendre que le serveur soit prêt
echo  [3/3] Attente du démarrage (5 secondes)...
timeout /t 5 /nobreak >nul

:: Ouvrir le navigateur
echo.
echo  ✓ Application lancée !
echo  ✓ Ouverture du navigateur...
echo.
start http://localhost:3000

echo  =============================================
echo   URL  : http://localhost:3000
echo   Login: admin@logistique-d3.fr
echo   MDP  : Admin2025!
echo  =============================================
echo.
echo  Cette fenêtre peut être fermée.
echo  Pour arrêter l'application, fermez la fenêtre
echo  noire "node" dans la barre des tâches.
echo.
pause
