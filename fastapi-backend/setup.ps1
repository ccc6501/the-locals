# FastAPI Backend Setup Script for Windows
# Run this script to quickly setup and start the backend

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  FastAPI Admin Panel Backend Setup   " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check Python installation
Write-Host "Checking Python installation..." -ForegroundColor Yellow
try {
    $pythonVersion = python --version 2>&1
    Write-Host "✓ Found: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "✗ Python not found! Please install Python 3.9+ from python.org" -ForegroundColor Red
    exit 1
}

# Create virtual environment
Write-Host ""
Write-Host "Creating virtual environment..." -ForegroundColor Yellow
if (Test-Path "venv") {
    Write-Host "✓ Virtual environment already exists" -ForegroundColor Green
} else {
    python -m venv venv
    Write-Host "✓ Virtual environment created" -ForegroundColor Green
}

# Activate virtual environment
Write-Host ""
Write-Host "Activating virtual environment..." -ForegroundColor Yellow
& ".\venv\Scripts\Activate.ps1"
Write-Host "✓ Virtual environment activated" -ForegroundColor Green

# Install dependencies
Write-Host ""
Write-Host "Installing dependencies..." -ForegroundColor Yellow
Write-Host "(This may take a few minutes...)" -ForegroundColor Gray
pip install -r requirements.txt --quiet
Write-Host "✓ Dependencies installed" -ForegroundColor Green

# Setup .env file
Write-Host ""
Write-Host "Setting up environment configuration..." -ForegroundColor Yellow
if (Test-Path ".env") {
    Write-Host "✓ .env file already exists" -ForegroundColor Green
} else {
    Copy-Item ".env.example" ".env"
    
    # Generate a random secret key
    $secretKey = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
    
    # Update .env with generated secret key
    (Get-Content ".env") -replace "your-secret-key-here-change-in-production", $secretKey | Set-Content ".env"
    
    Write-Host "✓ .env file created with random SECRET_KEY" -ForegroundColor Green
    Write-Host "  Edit .env to add API keys for OpenAI, AWS, etc." -ForegroundColor Gray
}

# Initialize database
Write-Host ""
Write-Host "Initializing database..." -ForegroundColor Yellow
if (Test-Path "admin_panel.db") {
    $response = Read-Host "Database already exists. Recreate it? (y/N)"
    if ($response -eq "y" -or $response -eq "Y") {
        Remove-Item "admin_panel.db"
        python init_db.py
    } else {
        Write-Host "✓ Using existing database" -ForegroundColor Green
    }
} else {
    python init_db.py
}

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "         Setup Complete! 🎉            " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Default Login:" -ForegroundColor Yellow
Write-Host "  Email:    admin@example.com" -ForegroundColor White
Write-Host "  Password: admin123" -ForegroundColor White
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Review and edit .env file for API keys" -ForegroundColor White
Write-Host "  2. Run: python main.py" -ForegroundColor White
Write-Host "  3. Visit: http://localhost:8000/docs" -ForegroundColor White
Write-Host ""
Write-Host "Optional Configuration:" -ForegroundColor Yellow
Write-Host "  • OpenAI: Add OPENAI_API_KEY to .env" -ForegroundColor Gray
Write-Host "  • Ollama: Install from https://ollama.ai" -ForegroundColor Gray
Write-Host "  • AWS S3: Add AWS credentials to .env" -ForegroundColor Gray
Write-Host ""

# Ask if user wants to start the server
$startServer = Read-Host "Start the server now? (Y/n)"
if ($startServer -ne "n" -and $startServer -ne "N") {
    Write-Host ""
    Write-Host "Starting FastAPI server..." -ForegroundColor Yellow
    Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Gray
    Write-Host ""
    python main.py
} else {
    Write-Host ""
    Write-Host "To start the server later, run: python main.py" -ForegroundColor Yellow
    Write-Host ""
}
