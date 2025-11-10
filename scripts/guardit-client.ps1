# GuardIT Client Script
# This script registers backup tasks with GuardIT and sends status updates
# Usage: .\guardit-client.ps1 -Register -TaskID "prod-01-db" -DisplayName "Production Server 1 - Database Backup" -GuardITURL "http://guardit-server:3000"

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("Register", "Status")]
    [string]$Action,

    [Parameter(Mandatory=$false)]
    [string]$TaskID,

    [Parameter(Mandatory=$false)]
    [string]$DisplayName,

    [Parameter(Mandatory=$false)]
    [string]$TaskType = "backup",

    [Parameter(Mandatory=$false)]
    [string]$GuardITURL = "http://localhost:3000",

    [Parameter(Mandatory=$false)]
    [string]$Status = "running",

    [Parameter(Mandatory=$false)]
    [string]$Message = "",

    [Parameter(Mandatory=$false)]
    [int]$Progress = 0,

    [Parameter(Mandatory=$false)]
    [string]$Description = ""
)

# Function to register backup task with GuardIT
function Register-GuardITTask {
    param(
        [string]$TaskID,
        [string]$DisplayName,
        [string]$TaskType,
        [string]$GuardITURL,
        [string]$Description
    )

    Write-Host "Registering task '$TaskID'..."
    Write-Host "  Display Name: $DisplayName"
    Write-Host "  Task Type: $TaskType"

    $body = @{
        taskId = $TaskID
        displayName = $DisplayName
        taskType = $TaskType
        description = $Description
    } | ConvertTo-Json

    try {
        $response = Invoke-WebRequest -Uri "$GuardITURL/api/tasks/register" `
            -Method POST `
            -ContentType "application/json" `
            -Body $body `
            -ErrorAction Stop

        Write-Host "✓ Task registered successfully!"
        Write-Host "Task ID: $TaskID"
        Write-Host "Display Name: $DisplayName"
        Write-Host "Task Type: $TaskType"
        Write-Host ""
        Write-Host "You can now send status updates using:"
        Write-Host ".\guardit-client.ps1 -Action Status -TaskID '$TaskID' -Status 'running' -Message 'Backup in progress' -Progress 50 -GuardITURL '$GuardITURL'"
    }
    catch {
        Write-Error "Failed to register task: $_"
        exit 1
    }
}

# Function to send status update
function Send-StatusUpdate {
    param(
        [string]$TaskID,
        [string]$Status,
        [string]$Message,
        [int]$Progress,
        [string]$GuardITURL
    )

    Write-Host "Sending status update for $TaskID..."

    $body = @{
        status = $Status
        message = $Message
        progress = $Progress
    } | ConvertTo-Json

    try {
        $response = Invoke-WebRequest -Uri "$GuardITURL/api/status/$TaskID" `
            -Method POST `
            -ContentType "application/json" `
            -Body $body `
            -ErrorAction Stop

        Write-Host "✓ Status update sent successfully!"
        Write-Host "Status: $Status | Message: $Message | Progress: $Progress%"
    }
    catch {
        Write-Error "Failed to send status update: $_"
        exit 1
    }
}

# Main execution
switch ($Action) {
    "Register" {
        if (-not $TaskID -or -not $DisplayName) {
            Write-Error "Register action requires -TaskID and -DisplayName parameters"
            exit 1
        }
        Register-GuardITTask -TaskID $TaskID -DisplayName $DisplayName -TaskType $TaskType -GuardITURL $GuardITURL -Description $Description
    }

    "Status" {
        if (-not $TaskID) {
            Write-Error "Status action requires -TaskID parameter"
            exit 1
        }
        Send-StatusUpdate -TaskID $TaskID -Status $Status -Message $Message -Progress $Progress -GuardITURL $GuardITURL
    }

    default {
        Write-Error "Unknown action: $Action"
        exit 1
    }
}
