# This script uses the Windows Runtime API to natively turn on the Windows 10/11 Mobile Hotspot.
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | ? { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]

Function Await($WinRtTask, $ResultType) {
    $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
    $netTask = $asTask.Invoke($null, @($WinRtTask))
    $netTask.Wait(-1) | Out-Null
    $netTask.Result
}

Try {
    $connectionProfile = [Windows.Networking.Connectivity.NetworkInformation,Windows.Networking.Connectivity,ContentType=WindowsRuntime]::GetInternetConnectionProfile()
    
    if (-not $connectionProfile) {
        $profiles = @([Windows.Networking.Connectivity.NetworkInformation,Windows.Networking.Connectivity,ContentType=WindowsRuntime]::GetConnectionProfiles())
        if ($profiles.Count -gt 0) {
            $connectionProfile = $profiles[0]
        }
    }

    if (-not $connectionProfile) {
        Write-Host "No network profiles found. Cannot manage Mobile Hotspot."
        exit
    }

    $tetheringManager = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager,Windows.Networking.NetworkOperators,ContentType=WindowsRuntime]::CreateFromConnectionProfile($connectionProfile)

    # Check if it's already running
    if ($tetheringManager.TetheringOperationalState -ne 1) {
        Write-Host "Turning on Mobile Hotspot..."
        $tetheringManager.StartTetheringAsync() | Out-Null
        Write-Host "Hotspot started successfully."
    } else {
        Write-Host "Mobile Hotspot is already running."
    }
} Catch {
    Write-Host "Failed to start Mobile Hotspot. Error: $_"
}
