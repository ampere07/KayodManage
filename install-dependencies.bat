@echo off
echo 🔧 Installing missing dependencies...
echo.

echo 📦 Installing Backend Dependencies...
cd /d C:\Users\melvi\Documents\GitHub\KayodManage\Backend
pnpm install

echo.
echo 📦 Installing Frontend Dependencies...
cd /d C:\Users\melvi\Documents\GitHub\KayodManage\Frontend
npm install

echo.
echo ✅ All dependencies installed!
echo 🚀 Now run the start-servers.bat to launch both servers
echo.
pause
