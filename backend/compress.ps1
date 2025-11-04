$source = "C:\Users\Porto\Desktop\bot-bora\backend"
$temp = "$env:TEMP\backend-temp"
$zip = "C:\Users\Porto\Desktop\backend-deploy.zip"

if (Test-Path $temp) { Remove-Item $temp -Recurse -Force }
if (Test-Path $zip) { Remove-Item $zip -Force }

New-Item -ItemType Directory -Path $temp -Force | Out-Null

Write-Host "Copiando src..."
Copy-Item -Path "$source\src" -Destination "$temp\src" -Recurse -Force

Write-Host "Copiando package.json..."
Copy-Item -Path "$source\package.json" -Destination "$temp\" -Force

Write-Host "Copiando package-lock.json..."
Copy-Item -Path "$source\package-lock.json" -Destination "$temp\" -Force

Write-Host "Copiando .env..."
Copy-Item -Path "$source\.env" -Destination "$temp\" -Force

Write-Host "Compactando..."
Compress-Archive -Path "$temp\*" -DestinationPath $zip

Remove-Item $temp -Recurse -Force

Write-Host "Pronto: $zip"

