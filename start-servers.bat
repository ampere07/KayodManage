@echo off
echo 🚀 Starting KayodManage Development Servers...
echo.

echo 🔧 Checking dependencies...
echo.

echo 📦 Installing Backend Dependencies...
cd /d "C:\Users\melvi\Documents\GitHub\KayodManage\Backend"
if not exist node_modules (pnpm install)

echo 📦 Installing Frontend Dependencies...
cd /d "C:\Users\melvi\Documents\GitHub\KayodManage\Frontend"
if not exist node_modules (npm install)

echo.
echo 📂 Starting Backend Server...
start cmd /k "cd /d C:\Users\melvi\Documents\GitHub\KayodManage\Backend && echo Backend Server Starting... && pnpm run dev"

timeout /t 3 /nobreak >nul

echo 📂 Starting Frontend Server...
start cmd /k "cd /d C:\Users\melvi\Documents\GitHub\KayodManage\Frontend && echo Frontend Server Starting... && npm run dev"

echo.
echo ✅ Both servers are starting up...
echo 🌐 Frontend will be available at: http://localhost:5173
echo 🔧 Backend API available at: http://localhost:5000
echo.
echo 📝 Default admin credentials:
echo    Username: admin
echo    Password: admin
echo.
pause
