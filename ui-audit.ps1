[CmdletBinding()]
param([string]$Root=$PSScriptRoot,[string]$DesktopToken='',[string]$OutputDir='',[string]$Origin='',[switch]$Json)
$ErrorActionPreference='Stop'
$arguments=@((Join-Path $PSScriptRoot 'ui-audit.py'),$Root)
if($DesktopToken){$arguments+=@('--desktop-token',$DesktopToken)}
if($OutputDir){$arguments+=@('--output-dir',$OutputDir)}
if($Origin){$arguments+=@('--origin',$Origin)}
if($Json){$arguments+='--json'}
& python @arguments
exit $LASTEXITCODE
