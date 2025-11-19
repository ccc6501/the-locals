# Stop any running backend
$procs = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*fastapi-backend*main.py*' }
foreach ($p in $procs) {
    try {
        Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
        Write-Output "Stopped PID $($p.ProcessId)"
    } catch {}
}

Start-Sleep -Seconds 1

# Start backend
$pythonPath = "C:/Users/Chance/AppData/Local/Programs/Python/Python312/python.exe"
$mainPath = "c:\Users\Chance\Downloads\fastapi-backend\main.py"

Start-Process -FilePath $pythonPath -ArgumentList $mainPath -WindowStyle Hidden
Write-Output "Backend started"

Start-Sleep -Seconds 2

# Verify health
try {
    $health = (Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8000/api/health).Content
    Write-Output "Health check: $health"
} catch {
    Write-Output "Health check failed: $($_.Exception.Message)"
}
