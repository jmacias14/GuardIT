@echo off
REM Example Batch Backup Script with Status Reporting
REM Usage: example-backup.bat [ServerName] [ApiUrl]

setlocal enabledelayedexpansion

REM Configuration
set SERVER_NAME=%1
if "%SERVER_NAME%"=="" set SERVER_NAME=server2

set API_URL=%2
if "%API_URL%"=="" set API_URL=http://localhost:3000

set BACKUP_SOURCE=C:\Data
set BACKUP_DEST=\\backup-server\backups

echo Starting backup for %SERVER_NAME%...

REM Function to send status (using curl - ensure curl is installed)
call :SendStatus "running" "Backup started" 0
timeout /t 2 /nobreak >nul

REM Check if source exists
call :SendStatus "running" "Checking source directory..." 10
if not exist "%BACKUP_SOURCE%" (
    call :SendStatus "failed" "Source directory does not exist" 0
    echo ERROR: Source directory does not exist
    exit /b 1
)

REM Create backup folder
call :SendStatus "running" "Creating backup destination..." 30
set TIMESTAMP=%date:~-4%%date:~-10,2%%date:~-7,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set TIMESTAMP=%TIMESTAMP: =0%
set DEST_FOLDER=%BACKUP_DEST%\%SERVER_NAME%_%TIMESTAMP%
mkdir "%DEST_FOLDER%" 2>nul

REM Copy files
call :SendStatus "running" "Copying files..." 50
xcopy "%BACKUP_SOURCE%" "%DEST_FOLDER%\" /E /I /H /Y >nul 2>&1

if errorlevel 1 (
    call :SendStatus "failed" "File copy failed" 0
    echo ERROR: File copy failed
    exit /b 1
)

REM Verify
call :SendStatus "running" "Verifying backup..." 90
timeout /t 2 /nobreak >nul

REM Success
call :SendStatus "completed" "Backup completed successfully!" 100
echo Backup completed successfully!

exit /b 0

REM Function to send status via curl
:SendStatus
set STATUS=%~1
set MESSAGE=%~2
set PROGRESS=%~3

set JSON_DATA={"status":"%STATUS%","message":"%MESSAGE%","progress":%PROGRESS%}

curl -X POST "%API_URL%/api/status/%SERVER_NAME%" ^
     -H "Content-Type: application/json" ^
     -d "%JSON_DATA%" ^
     --silent >nul 2>&1

goto :eof
