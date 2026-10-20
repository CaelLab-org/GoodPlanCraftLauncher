; GoodPlanCraftLauncher installer (Inno Setup 6.5+).
; Build with scripts/build-installer.mjs, which injects the version from package.json.

#define AppName "GoodPlanCraftLauncher"
#define AppExeName "GoodPlanCraftLauncher.exe"
#define AppPublisher "CaelLab"
#define AppContact "gamets@caellab.com"
#define AppURL "https://gamets.caellab.com/gpcl/"
#define GroupName "CaelLab"

; GUID electron-builder derives from appId (com.caellab.gamets.gpcl) for its NSIS
; installer; used to take over an existing NSIS install and to refuse a leftover
; per-machine one.
#define OldNsGuid "3ba2ea27-c03b-5187-9f73-05821ec8353b"

#ifndef AppVersion
  #error AppVersion is not defined (pass /DAppVersion=x.y.z)
#endif
#ifndef VersionInfoVersion
  #define VersionInfoVersion "0.0.0.0"
#endif
#ifndef PayloadDir
  #define PayloadDir "..\release\win-unpacked"
#endif
#ifndef InnoOutputDir
  #define InnoOutputDir "..\release"
#endif
#ifndef InnoOutputName
  #define InnoOutputName "GPCL-" + AppVersion + "-Setup"
#endif

[Setup]
AppId={{2F979A9F-5DC0-4B20-B21F-3C94A0803BAC}
AppName={#AppName}
AppVersion={#AppVersion}
AppVerName={#AppName} {#AppVersion}
AppPublisher={#AppPublisher}
AppPublisherURL={#AppURL}
AppSupportURL={#AppURL}
AppUpdatesURL={#AppURL}
AppComments={#AppName} - Minecraft 启动器
AppContact={#AppContact}
DefaultDirName={localappdata}\Programs\{#AppName}
DefaultGroupName={#GroupName}
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
MinVersion=10.0
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir={#InnoOutputDir}
OutputBaseFilename={#InnoOutputName}
SetupIconFile=..\icon.ico
UninstallDisplayName={#AppName} {#AppVersion}
UninstallDisplayIcon={app}\{#AppExeName}
DisableWelcomePage=no
WizardStyle=dynamic includetitlebar
Compression=lzma2/max
SolidCompression=yes
CloseApplications=yes
RestartApplications=no
VersionInfoCompany={#AppPublisher}
VersionInfoDescription={#AppName} Setup
VersionInfoVersion={#VersionInfoVersion}
VersionInfoTextVersion={#AppVersion}
VersionInfoCopyright=Copyright (C) 2026 Yunyun(云云) by CaelLab

[Languages]
Name: "chinesesimplified"; MessagesFile: "lang\ChineseSimplified.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[CustomMessages]
chinesesimplified.WelcomeExtra={#AppName} 是一款轻量高效的 Minecraft 启动器，支持正版登录、版本管理与 Forge / Fabric / OptiFine 一键安装。由虚舟实验室（CaelLab）开发并维护，以 CaelLab BY-SA Code License v3 开源。
english.WelcomeExtra={#AppName} is a lightweight Minecraft launcher with account login, version management and one-click Forge / Fabric / OptiFine installs. Developed and maintained by CaelLab, released under the CaelLab BY-SA Code License v3.
chinesesimplified.UpgradeNotice=检测到本机已有的 {#AppName}（旧安装器安装）。将就地升级：安装目录不变，你的游戏版本和设置都会保留。
english.UpgradeNotice=An existing {#AppName} installation was found. Setup will upgrade it in place: same folder, your versions and settings are kept.
chinesesimplified.AllUsersBlocked=检测到为「所有用户」安装的旧版本。请先在 Windows 的「设置 → 应用」里卸载它，再运行本安装程序。
english.AllUsersBlocked=A per-machine installation of an older version was found. Uninstall it from Windows Settings > Apps first, then run this installer again.

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: checkedonce

[Files]
Source: "{#PayloadDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#AppName}"; Filename: "{app}\{#AppExeName}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#AppExeName}"; Description: "{cm:LaunchProgram,{#AppName}}"; Flags: nowait postinstall skipifsilent
Filename: "{app}\{#AppExeName}"; Flags: nowait; Check: RelaunchAfterSilentInstall

[Code]
var
  OldInstallDir: String;

function RelaunchAfterSilentInstall: Boolean;
begin
  Result := WizardSilent and (ExpandConstant('{param:RELAUNCH|0}') = '1');
end;

function OldNsKey: String;
begin
  Result := 'Software\Microsoft\Windows\CurrentVersion\Uninstall\{#OldNsGuid}';
end;

function OldNsInstallPresent: Boolean;
begin
  Result := RegKeyExists(HKEY_CURRENT_USER, OldNsKey);
end;

function OpenProcess(dwDesiredAccess: Cardinal; bInheritHandle: Boolean; dwProcessId: Cardinal): Cardinal;
  external 'OpenProcess@kernel32.dll stdcall';
function WaitForSingleObject(hHandle: Cardinal; dwMilliseconds: Cardinal): Cardinal;
  external 'WaitForSingleObject@kernel32.dll stdcall';
function CloseHandle(hObject: Cardinal): Boolean;
  external 'CloseHandle@kernel32.dll stdcall';

// Waits for the launcher (passed as /WAITPID=) to finish exiting before touching
// its files. Restart Manager cannot reliably close an Electron process that is
// already in its quit sequence, so the launcher spawns Setup and then exits.
procedure WaitForLauncherExit;
var
  WaitPid: Integer;
  ProcHandle: Cardinal;
begin
  WaitPid := StrToIntDef(ExpandConstant('{param:WAITPID|0}'), 0);
  if WaitPid <= 0 then Exit;
  ProcHandle := OpenProcess($00100000, False, WaitPid);
  if ProcHandle <> 0 then
  begin
    WaitForSingleObject(ProcHandle, 120000);
    CloseHandle(ProcHandle);
  end;
end;

function InitializeSetup: Boolean;
begin
  Result := True;
  WaitForLauncherExit;
  if OldNsInstallPresent then
    RegQueryStringValue(HKEY_CURRENT_USER, 'Software\{#OldNsGuid}', 'InstallLocation', OldInstallDir)
  else if RegKeyExists(HKEY_LOCAL_MACHINE, 'Software\Microsoft\Windows\CurrentVersion\Uninstall\{#OldNsGuid}') then
  begin
    SuppressibleMsgBox(ExpandConstant('{cm:AllUsersBlocked}'), mbCriticalError, MB_OK, IDOK);
    Result := False;
  end;
end;

procedure InitializeWizard;
begin
  if OldNsInstallPresent and (OldInstallDir <> '') and DirExists(OldInstallDir) then
    WizardForm.DirEdit.Text := OldInstallDir;

  WizardForm.WelcomeLabel2.Caption := WizardForm.WelcomeLabel2.Caption + #13#10#13#10 +
    ExpandConstant('{cm:WelcomeExtra}');
  if OldNsInstallPresent then
    WizardForm.WelcomeLabel2.Caption := WizardForm.WelcomeLabel2.Caption + #13#10#13#10 +
      ExpandConstant('{cm:UpgradeNotice}');
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if (CurStep = ssInstall) and OldNsInstallPresent then
  begin
    RegDeleteKeyIncludingSubkeys(HKEY_CURRENT_USER, OldNsKey);
    RegDeleteKeyIncludingSubkeys(HKEY_CURRENT_USER, 'Software\{#OldNsGuid}');
    DeleteFile(ExpandConstant('{app}\Uninstall {#AppName}.exe'));
  end;
end;

function ShouldSkipPage(PageID: Integer): Boolean;
begin
  // Upgrading an NSIS install must reuse the old directory; changing it leaves an orphaned install.
  Result := (PageID = wpSelectDir) and OldNsInstallPresent and (OldInstallDir <> '');
end;
