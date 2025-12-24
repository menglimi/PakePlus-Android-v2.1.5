Write-Host "明惠地产营销系统启动脚本" -ForegroundColor Cyan

# 检查依赖
Write-Host "[1/3] 检查依赖..." -ForegroundColor Green
if (-not (Test-Path "node_modules")) {
    Write-Host "依赖未安装，开始安装..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "依赖安装失败" -ForegroundColor Red
        exit 1
    }
    Write-Host "依赖安装完成" -ForegroundColor Green
} else {
    Write-Host "依赖已安装" -ForegroundColor Green
}

# 启动开发服务器
Write-Host "[2/3] 启动开发服务器..." -ForegroundColor Green
try {
    Write-Host "服务器将在 http://localhost:3000 启动" -ForegroundColor Yellow
    $job = Start-Job -ScriptBlock { npm run dev }
    
    # 等待服务器启动
    Start-Sleep -Seconds 5
    
    # 自动打开Edge浏览器
    Write-Host "[3/3] 自动打开浏览器..." -ForegroundColor Green
    Start-Process "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" -ArgumentList "http://localhost:3000"
    
    # 等待服务器进程
    Receive-Job -Job $job -Wait
    
} catch {
    Write-Host "启动失败: $_" -ForegroundColor Red
    exit 1
}