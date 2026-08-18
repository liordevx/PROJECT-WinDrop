[Windows.System.UserProfile.LockScreen, Windows.System.UserProfile, ContentType = WindowsRuntime] | Out-Null
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$connectionProfile = [Windows.Networking.Connectivity.NetworkInformation, Windows.Networking.Connectivity, ContentType = WindowsRuntime]::GetInternetConnectionProfile()

if (-not $connectionProfile) {
    $profiles = @([Windows.Networking.Connectivity.NetworkInformation, Windows.Networking.Connectivity, ContentType = WindowsRuntime]::GetConnectionProfiles())
    if ($profiles.Count -gt 0) {
        $connectionProfile = $profiles[0]
    }
}

if ($connectionProfile) {
    $tetheringManager = [Windows.Networking.NetworkOperators.NetworkOperatorTetheringManager, Windows.Networking.NetworkOperators, ContentType = WindowsRuntime]::CreateFromConnectionProfile($connectionProfile)
    $config = $tetheringManager.GetCurrentAccessPointConfiguration()
    $ssid = $config.Ssid
    $pass = $config.Passphrase
    Write-Output "SSID=$ssid"
    Write-Output "PASS=$pass"
} else {
    Write-Error "No network profiles found."
}
