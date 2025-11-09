# Example PowerShell Backup Script with Status Reporting
# Usage: .\example-backup.ps1 -ServerName "server1" -ApiUrl "http://backup-server:3000"

param(
    [string]$ServerName = "server1",
    [string]$ApiUrl = "http://localhost:3000",
    [string]$BackupSource = "C:\Data",
    [string]$BackupDestination = "\\backup-server\backups"
)

# Function to send status to the API
function Send-BackupStatus {
    param(
        [string]$Status,
        [string]$Message,
        [int]$Progress = 0,
        [hashtable]$Data = $null
    )
    
    $body = @{
        status = $Status
        message = $Message
        progress = $Progress
    }
    
    if ($Data) {
        $body.data = $Data
    }
    
    try {
        Invoke-RestMethod -Uri "$ApiUrl/api/status/$ServerName" `
            -Method Post `
            -Body ($body | ConvertTo-Json) `
            -ContentType "application/json" `
            -ErrorAction Stop
    } catch {
        Write-Warning "Failed to send status: $_"
    }
}

# Start the backup
Write-Host "Starting backup for $ServerName..."
Send-BackupStatus -Status "running" -Message "Backup started" -Progress 0

try {
    # Simulate backup process (replace with your actual backup logic)
    
    # Step 1: Check source
    Send-BackupStatus -Status "running" -Message "Checking source directory..." -Progress 10
    Start-Sleep -Seconds 2
    
    if (-not (Test-Path $BackupSource)) {
        throw "Source directory does not exist: $BackupSource"
    }
    
    # Step 2: Calculate size
    Send-BackupStatus -Status "running" -Message "Calculating backup size..." -Progress 20
    $sourceSize = (Get-ChildItem -Path $BackupSource -Recurse -File | Measure-Object -Property Length -Sum).Sum
    $sizeMB = [math]::Round($sourceSize / 1MB, 2)
    Start-Sleep -Seconds 2
    
    # Step 3: Create backup folder
    Send-BackupStatus -Status "running" -Message "Creating backup destination..." -Progress 30
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $destFolder = Join-Path $BackupDestination "$ServerName`_$timestamp"
    New-Item -Path $destFolder -ItemType Directory -Force | Out-Null
    Start-Sleep -Seconds 1
    
    # Step 4: Copy files (simulated with progress updates)
    $files = Get-ChildItem -Path $BackupSource -Recurse -File
    $totalFiles = $files.Count
    $copiedFiles = 0
    
    foreach ($file in $files) {
        # Copy file (simplified - replace with robust copy logic)
        $relativePath = $file.FullName.Substring($BackupSource.Length)
        $destPath = Join-Path $destFolder $relativePath
        $destDir = Split-Path $destPath -Parent
        
        if (-not (Test-Path $destDir)) {
            New-Item -Path $destDir -ItemType Directory -Force | Out-Null
        }
        
        Copy-Item -Path $file.FullName -Destination $destPath -Force
        
        $copiedFiles++
        $progress = [math]::Round(30 + (($copiedFiles / $totalFiles) * 60))
        
        # Send progress every 10%
        if ($copiedFiles % [math]::Max(1, [math]::Floor($totalFiles / 10)) -eq 0) {
            Send-BackupStatus -Status "running" `
                -Message "Copying files... $copiedFiles/$totalFiles" `
                -Progress $progress
        }
    }
    
    # Step 5: Verify backup
    Send-BackupStatus -Status "running" -Message "Verifying backup..." -Progress 95
    Start-Sleep -Seconds 2
    
    $backupSize = (Get-ChildItem -Path $destFolder -Recurse -File | Measure-Object -Property Length -Sum).Sum
    $backupSizeMB = [math]::Round($backupSize / 1MB, 2)
    
    # Success!
    Send-BackupStatus -Status "completed" `
        -Message "Backup completed successfully!" `
        -Progress 100 `
        -Data @{
            sourceSize = "$sizeMB MB"
            backupSize = "$backupSizeMB MB"
            filesBackedUp = $totalFiles
            backupLocation = $destFolder
            duration = "Simulated backup"
        }
    
    Write-Host "Backup completed successfully!" -ForegroundColor Green
    
} catch {
    # Error occurred
    $errorMessage = $_.Exception.Message
    Write-Host "Backup failed: $errorMessage" -ForegroundColor Red
    
    Send-BackupStatus -Status "failed" `
        -Message "Backup failed: $errorMessage" `
        -Progress 0 `
        -Data @{
            error = $errorMessage
            timestamp = (Get-Date).ToString()
        }
}
