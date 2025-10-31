$ErrorActionPreference = "Stop"

$sourceDir = "C:\Users\Porto\Desktop\bot-bora\backend"
$tempDir = "$env:TEMP\backend-deploy-temp"
$destZip = "C:\Users\Porto\Desktop\backend-deploy.zip"

# Remover temp e zip antigos
if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force }
if (Test-Path $destZip) { Remove-Item $destZip -Force }

Write-Host "Criando pasta temporaria..."
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

Write-Host "Copiando arquivos (excluindo node_modules, sessions, .git)..."

# Copiar src
Write-Host "  - Copiando src/"
Copy-Item -Path "$sourceDir\src" -Destination "$tempDir\src" -Recurse -Force

# Copiar arquivos raiz importantes
Write-Host "  - Copiando arquivos raiz"
$files = @("package.json", "package-lock.json", ".env", "nodemon.json", "README.md")
foreach ($file in $files) {
    $filePath = "$sourceDir\$file"
    if (Test-Path $filePath) {
        Copy-Item -Path $filePath -Destination "$tempDir\" -Force
        Write-Host "    ✓ $file"
    }
}

Write-Host "Compactando..."
Compress-Archive -Path "$tempDir\*" -DestinationPath $destZip -CompressionLevel Fastest

Write-Host "Limpando temporarios..."
Remove-Item $tempDir -Recurse -Force

Write-Host ""
Write-Host "✅ Arquivo criado: $destZip"
$size = (Get-Item $destZip).Length / 1MB
Write-Host "Tamanho: $([math]::Round($size, 2)) MB"

