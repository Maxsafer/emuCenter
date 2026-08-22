Add-Type -AssemblyName PresentationFramework

$openFileDialog = New-Object Microsoft.Win32.OpenFileDialog
$openFileDialog.Filter = "Executables (*.exe)|*.exe|All Files (*.*)|*.*"
$openFileDialog.Title = "Select Emulator Executable"

if ($openFileDialog.ShowDialog() -eq $true) {
    Write-Output $openFileDialog.FileName
}
