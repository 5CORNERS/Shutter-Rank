@echo off
echo.
echo === Starting Photo Contest Deployment ===
echo.

echo 1. Changing to the project directory...
cd /d "C:\Users\ILYA\Documents\My Projects\photo-voting-app-5"

echo.
echo 2. Building the application (npm run build)...
echo    This might take a moment...
CALL npm run build

echo.
echo 3. Deploying to Firebase (firebase deploy)...
CALL firebase deploy

echo.
echo === Deployment complete! ===
echo.
pause