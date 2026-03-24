# Ensure running as admin
if (-not ([Security.Principal.WindowsBuiltinRole]::Administrator -in (New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())).IsInRole)) {
    Write-Host "Please run PowerShell as Administrator."
    exit 1
}

# Enable WSL and VirtualMachinePlatform
Write-Host "Enabling WSL and VirtualMachinePlatform..."
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart

Write-Host "Restart your machine if asked!"

Write-Host "WSL has been setup! Please refer to the README for further instructions."
