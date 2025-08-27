#!/usr/bin/env pwsh

Write-Host "🚀 Starting KayodManage Development Servers..." -ForegroundColor Green
Write-Host ""

Write-Host "🔧 Checking dependencies..." -ForegroundColor Yellow
Write-Host ""

$backendPath = "C:\Users\melvi\Documents\GitHub\KayodManage\Backend"
$frontendPath = "C:\Users\melvi\Documents\GitHub\KayodManage\Frontend"

# Check and install backend dependencies
Write-Host "📦 Checking Backend Dependencies..." -ForegroundColor Cyan
Set-Location -Path $backendPath
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing backend dependencies..." -ForegroundColor Yellow
    & pnpm install
}

# Check and install frontend dependencies  
Write-Host "📦 Checking Frontend Dependencies..." -ForegroundColor Cyan
Set-Location -Path $frontendPath
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
    & npm install
}

Write-Host "📂 Starting Backend Server..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendPath'; Write-Host 'Backend Server Starting...' -ForegroundColor Green; pnpm run dev"

Start-Sleep -Seconds 3

Write-Host "📂 Starting Frontend Server..." -ForegroundColor Yellow  
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$frontendPath'; Write-Host 'Frontend Server Starting...' -ForegroundColor Green; npm run dev"

Write-Host ""
Write-Host "✅ Both servers are starting up..." -ForegroundColor Green
Write-Host "🌐 Frontend will be available at: http://localhost:5173" -ForegroundColor Cyan
Write-Host "🔧 Backend API available at: http://localhost:5000" -ForegroundColor Cyan
Write-Host ""
Write-Host "📝 Default admin credentials:" -ForegroundColor Yellow
Write-Host "   Username: admin" -ForegroundColor White
Write-Host "   Password: admin" -ForegroundColor White
Write-Host ""

Read-Host "Press Enter to exit..."
