# GuardIT Client Script
# This script registers a backup server with GuardIT and sends status updates
# Usage: .\guardit-client.ps1 -Register -ServerID "server1" -DisplayName "Production Server 1" -GuardITURL "http://guardit-server:3000"

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("Register", "Status")]
    [string]$Action,

    [Parameter(Mandatory=$false)]
    [string]$ServerID,

    [Parameter(Mandatory=$false)]
    [string]$DisplayName,

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

# Function to register server with GuardIT
function Register-GuardITServer {
    param(
        [string]$ServerID,
        [string]$DisplayName,
        [string]$GuardITURL,
        [string]$Description
    )

    # Get local IP address (exclude loopback)
    $ipAddress = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IpAddress -notlike "127.*"} | Select-Object -First 1).IPAddress

    if (-not $ipAddress) {
        Write-Error "Could not determine IP address"
        exit 1
    }

    Write-Host "Registering server '$ServerID' with IP $ipAddress..."

    $body = @{
        serverId = $ServerID
        displayName = $DisplayName
        ipAddress = $ipAddress
        description = $Description
    } | ConvertTo-Json

    try {
        $response = Invoke-WebRequest -Uri "$GuardITURL/api/servers/register" `
            -Method POST `
            -ContentType "application/json" `
            -Body $body `
            -ErrorAction Stop

        Write-Host "✓ Server registered successfully!"
        Write-Host "Server ID: $ServerID"
        Write-Host "Display Name: $DisplayName"
        Write-Host "IP Address: $ipAddress"
        Write-Host ""
        Write-Host "You can now send status updates using:"
        Write-Host ".\guardit-client.ps1 -Action Status -ServerID '$ServerID' -Status 'running' -Message 'Backup in progress' -Progress 50 -GuardITURL '$GuardITURL'"
    }
    catch {
        Write-Error "Failed to register server: $_"
        exit 1
    }
}

# Function to send status update
function Send-StatusUpdate {
    param(
        [string]$ServerID,
        [string]$Status,
        [string]$Message,
        [int]$Progress,
        [string]$GuardITURL
    )

    Write-Host "Sending status update for $ServerID..."

    $body = @{
        status = $Status
        message = $Message
        progress = $Progress
    } | ConvertTo-Json

    try {
        $response = Invoke-WebRequest -Uri "$GuardITURL/api/status/$ServerID" `
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
        if (-not $ServerID -or -not $DisplayName) {
            Write-Error "Register action requires -ServerID and -DisplayName parameters"
            exit 1
        }
        Register-GuardITServer -ServerID $ServerID -DisplayName $DisplayName -GuardITURL $GuardITURL -Description $Description
    }

    "Status" {
        if (-not $ServerID) {
            Write-Error "Status action requires -ServerID parameter"
            exit 1
        }
        Send-StatusUpdate -ServerID $ServerID -Status $Status -Message $Message -Progress $Progress -GuardITURL $GuardITURL
    }

    default {
        Write-Error "Unknown action: $Action"
        exit 1
    }
}
