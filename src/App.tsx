import { useState, useCallback } from "react";
import { ToolCard } from "./components/ToolCard";
import {
  X,
  Minus,
  Maximize2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface FunctionItem {
  index: number;
  title: string;
  commandType: "cmd" | "ps";
  command: string;
}

const functions: FunctionItem[] = [
  {
    index: 1,
    title: "查看系统版本",
    commandType: "ps",
    command: `$os=Get-CimInstance Win32_OperatingSystem; $cs=Get-CimInstance Win32_ComputerSystem; Write-Output "OSName: $($os.Caption)"; Write-Output "Version: $($os.Version)"; Write-Output "Build: $($os.BuildNumber)"; Write-Output "Arch: $($os.OSArchitecture)"; Write-Output "Manufacturer: $($cs.Manufacturer)"; Write-Output "Model: $($cs.Model)";`,
  },
  {
    index: 2,
    title: "开启 WSL + 虚拟机平台",
    commandType: "cmd",
    command: "dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart && dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart",
  },
  {
    index: 3,
    title: "批量开放端口",
    commandType: "cmd",
    command: 'for /l %P in (31400,1,31409) do (netsh advfirewall firewall add rule name="Pi_TCP_%P" dir=in action=allow protocol=TCP localport=%P >nul && netsh advfirewall firewall add rule name="Pi_UDP_%P" dir=in action=allow protocol=UDP localport=%P >nul && echo [OK] 端口 %P)',
  },
  {
    index: 4,
    title: "优化电源设置",
    commandType: "cmd",
    command: "powercfg -h off && powercfg /change disk-timeout-ac 0 && powercfg /change monitor-timeout-ac 5",
  },
  {
    index: 5,
    title: "Windows 更新管理",
    commandType: "ps",
    command: "",
  },
  {
    index: 6,
    title: "开启 Hyper-V 组件",
    commandType: "cmd",
    command: "dism /online /enable-feature /featurename:Microsoft-Hyper-V-All /all /norestart",
  },
  {
    index: 7,
    title: "关闭 Windows Defender",
    commandType: "cmd",
    command: 'reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows Defender" /v DisableRealtimeMonitoring /t REG_DWORD /d 1 /f && reg add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows Defender" /v DisableAntiSpyware /t REG_DWORD /d 1 /f',
  },
  {
    index: 8,
    title: "安装最新版 WSL",
    commandType: "ps",
    command: "",
  },
  {
    index: 9,
    title: "设置 WSL2 为默认",
    commandType: "cmd",
    command: "wsl --set-default-version 2",
  },
  {
    index: 10,
    title: "自动拉取 Pi 镜像",
    commandType: "ps",
    command: "",
  },
];

interface DialogState {
  visible: boolean;
  type: "confirm" | "update" | "defender";
  item: FunctionItem | null;
}

interface ResultDialogData {
  title: string;
  rows: { label: string; value: string }[];
}

declare global {
  interface Window {
    electronAPI: {
      runCommand: (cmd: string) => Promise<{ success: boolean; output: string }>;
      runPowerShell: (cmd: string) => Promise<{ success: boolean; output: string }>;
      downloadFile: (url: string, dest: string) => Promise<{ success: boolean; path?: string; error?: string }>;
      checkLatestWSL: () => Promise<{ success: boolean; url?: string; name?: string; error?: string }>;
      checkLatestPiImage: () => Promise<{ success: boolean; tag?: string; fullImage?: string; allTags?: string[]; error?: string }>;
      getTempPath: () => Promise<string>;
      openExternal: (url: string) => void;
      windowMinimize: () => void;
      windowMaximize: () => Promise<boolean>;
      windowClose: () => void;
    };
  }
}

function App() {
  const [output, setOutput] = useState<string[]>([]);
  const [runningIndex, setRunningIndex] = useState<number | null>(null);
  const [showOutput, setShowOutput] = useState(false);
  const [, setIsMaximized] = useState(false);
  const [dialog, setDialog] = useState<DialogState>({ visible: false, type: "confirm", item: null });
  const [resultDialog, setResultDialog] = useState<ResultDialogData | null>(null);

  const addOutput = useCallback((text: string) => {
    setOutput((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${text}`]);
  }, []);

  const closeDialog = useCallback(() => {
    setDialog({ visible: false, type: "confirm", item: null });
  }, []);

  const closeResult = useCallback(() => {
    setResultDialog(null);
  }, []);

  const parseKeyValueLines = useCallback((text: string): { label: string; value: string }[] => {
    return text.split("\n")
      .map((l) => l.trim())
      .filter((l) => l.includes(":"))
      .map((l) => {
        const idx = l.indexOf(":");
        return { label: l.slice(0, idx).trim(), value: l.slice(idx + 1).trim() };
      });
  }, []);

  const executeAction = useCallback(async (item: FunctionItem) => {
    setRunningIndex(item.index);
    setShowOutput(true);
    addOutput(`正在执行 [${item.index}] ${item.title}`);

    try {
      let success = false;

      if (item.index === 5) {
        const result = await window.electronAPI.runCommand(
          'for %s in (WaaSMedicSvc wuauserv bits dosvc) do (sc stop %s >nul 2>&1 & sc config %s start= disabled >nul 2>&1) & schtasks /Change /TN "\\Microsoft\\Windows\\WindowsUpdate\\Scheduled Start" /Disable >nul 2>&1'
        );
        success = result.success;
      } else if (item.index === 8) {
        const wslInfo = await window.electronAPI.checkLatestWSL();
        if (wslInfo.success && wslInfo.url) {
          const tempPath = await window.electronAPI.getTempPath();
          const dest = `${tempPath}\\wsl_update_x64.msi`;
          const dl = await window.electronAPI.downloadFile(wslInfo.url, dest);
          if (dl.success) {
            const install = await window.electronAPI.runCommand(`msiexec.exe /i "${dest}" /qn /norestart`);
            success = install.success;
          }
        }
      } else if (item.index === 10) {
        const imageInfo = await window.electronAPI.checkLatestPiImage();
        const tag = imageInfo.success && imageInfo.fullImage
          ? imageInfo.fullImage
          : "pinetwork/pi-node-docker:community-v1.0-p26.0.1";
        await window.electronAPI.runPowerShell(
          `if (-not (Test-Path "$env:USERPROFILE\\.docker")) { md "$env:USERPROFILE\\.docker" | Out-Null }; '{"registry-mirrors":["https://docker.m.daocloud.io","https://hub.rat.dev","https://dockerproxy.com"]}' | Out-File "$env:USERPROFILE\\.docker\\daemon.json" -Encoding ascii`
        );
        await window.electronAPI.runCommand("net stop com.docker.service >nul 2>&1 & net start com.docker.service >nul 2>&1");
        const pullResult = await window.electronAPI.runCommand(`docker pull ${tag}`);
        success = pullResult.success;
      } else {
        const result = item.commandType === "ps"
          ? await window.electronAPI.runPowerShell(item.command)
          : await window.electronAPI.runCommand(item.command);
        success = result.success;

        if (item.index === 1 && result.output) {
          const rows = parseKeyValueLines(result.output);
          setResultDialog({ title: "查看系统版本", rows });
        }
      }

      addOutput(success ? "执行完成" : "执行出错");
    } catch {
      addOutput("执行出错");
    }
    setRunningIndex(null);
  }, [addOutput, parseKeyValueLines]);

  const handleCardClick = useCallback((item: FunctionItem) => {
    if (item.index === 5) {
      setDialog({ visible: true, type: "update", item });
    } else if (item.index === 7) {
      setDialog({ visible: true, type: "defender", item });
    } else {
      setDialog({ visible: true, type: "confirm", item });
    }
  }, []);

  const handleConfirmYes = useCallback(() => {
    if (!dialog.item) return;
    const item = dialog.item;
    closeDialog();
    executeAction(item);
  }, [dialog.item, executeAction, closeDialog]);

  return (
    <div className="h-screen flex flex-col bg-black text-white font-sans select-none">
      <div className="flex items-center justify-between px-4 h-10 bg-black/80 backdrop-blur border-b border-slate-800/50 flex-shrink-0" style={{ WebkitAppRegion: "drag" } as any}>
        <div className="flex items-center gap-2" style={{ WebkitAppRegion: "no-drag" } as any}>
          <span className="text-xs font-semibold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">Pi 节点工具箱</span>
          <span className="text-[10px] text-slate-500">by Yegou</span>
        </div>
        <div className="flex items-center gap-1" style={{ WebkitAppRegion: "no-drag" } as any}>
          <button onClick={() => window.electronAPI?.windowMinimize()} className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded transition-colors"><Minus className="h-3 w-3" /></button>
          <button onClick={async () => { const m = await window.electronAPI?.windowMaximize(); setIsMaximized(m); }} className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded transition-colors"><Maximize2 className="h-3 w-3" /></button>
          <button onClick={() => window.electronAPI?.windowClose()} className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded transition-colors"><X className="h-3 w-3" /></button>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden p-4 md:p-6 lg:p-8">
        <div className="text-center mb-6 flex-shrink-0">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-300 via-purple-400 to-pink-400 bg-clip-text text-transparent">Pi 节点工具箱</h1>
          <p className="mt-2 text-sm text-slate-400">Pi Node Toolbox · 作者: Yegou</p>
        </div>

        <div className="flex-shrink-0 max-w-6xl mx-auto w-full">
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {functions.map((item) => (
              <ToolCard key={item.index} index={item.index} title={item.title}
                onClick={() => handleCardClick(item)} isRunning={runningIndex === item.index} />
            ))}
          </ul>
        </div>

        <div className="flex-shrink-0 max-w-6xl mx-auto w-full mt-4">
          <button onClick={() => setShowOutput(!showOutput)}
            className="w-full flex items-center justify-between px-4 py-2 rounded-lg bg-slate-900/50 border border-slate-800/50 hover:border-purple-700/30 transition-colors text-sm text-slate-400">
            <span>执行日志</span>
            {showOutput ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
          {showOutput && (
            <div className="mt-2 p-4 rounded-lg bg-slate-900/80 border border-slate-800/50 h-48 overflow-y-auto">
              {output.length === 0 ? (
                <p className="text-sm text-slate-500 italic">点击上方功能卡开始执行...</p>
              ) : (
                output.map((line, i) => (
                  <pre key={i} className={`text-xs font-mono leading-relaxed whitespace-pre-wrap ${line.includes("执行完成") ? "text-green-400" : line.includes("执行出错") ? "text-red-400" : "text-slate-300"}`}>{line}</pre>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {resultDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={closeResult}>
          <div className="bg-slate-900 border border-slate-700/60 rounded-xl shadow-2xl w-[420px] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="relative px-6 pt-6 pb-4 border-b border-slate-700/50">
              <button onClick={closeResult} className="absolute top-3 right-3 p-1 rounded-lg text-slate-500 hover:text-white hover:bg-slate-700 transition-colors"><X className="h-4 w-4" /></button>
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 grid grid-cols-2 gap-0.5">
                  <div className="bg-blue-500 rounded-tl-lg" /><div className="bg-blue-500 rounded-tr-lg" />
                  <div className="bg-blue-500 rounded-bl-lg" /><div className="bg-blue-500 rounded-br-lg" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-blue-400">{resultDialog.title}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Microsoft Windows</p>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 space-y-3">
              {resultDialog.rows.map((row, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="text-xs text-slate-500 w-24 flex-shrink-0 pt-0.5">{row.label}</span>
                  <span className="text-sm text-slate-200 break-all">{row.value}</span>
                </div>
              ))}
            </div>
            <div className="px-6 py-3 bg-slate-800/50 flex justify-end">
              <button onClick={closeResult} className="px-6 py-1.5 text-sm text-white bg-purple-600 hover:bg-purple-500 rounded-lg border border-purple-500/50 transition-colors shadow-lg shadow-purple-600/20">确定</button>
            </div>
          </div>
        </div>
      )}

      {dialog.visible && dialog.type === "confirm" && dialog.item && (
        <Overlay>
          <Panel title={dialog.item.title} onClose={closeDialog}>
            <p className="text-sm text-slate-400 leading-relaxed">确定要执行「{dialog.item.title}」吗？</p>
            <div className="flex justify-end gap-3 mt-5">
              <Btn onClick={closeDialog}>否(N)</Btn>
              <Btn primary onClick={handleConfirmYes}>是(Y)</Btn>
            </div>
          </Panel>
        </Overlay>
      )}

      {dialog.visible && dialog.type === "update" && dialog.item && (
        <Overlay>
          <Panel title="Windows 更新管理" onClose={closeDialog}>
            <p className="text-sm text-slate-400 leading-relaxed mb-4">选择要执行的 Windows 更新操作</p>
            <div className="flex gap-3">
              <button onClick={() => { closeDialog(); executeAction(dialog.item!); }}
                className="flex-1 px-4 py-2 text-sm text-white bg-purple-600 hover:bg-purple-500 rounded-lg border border-purple-500/50 transition-colors shadow-lg shadow-purple-600/20">禁用 Windows 更新</button>
              <button onClick={() => {
                  closeDialog();
                  setRunningIndex(dialog.item!.index);
                  setShowOutput(true);
                  addOutput(`正在执行 [${dialog.item!.index}] 还原 Windows 更新`);
                  window.electronAPI.runCommand(
                    'for %s in (WaaSMedicSvc wuauserv bits dosvc) do (sc config %s start= delayed-auto >nul 2>&1 & sc start %s >nul 2>&1) & schtasks /Change /TN "\\Microsoft\\Windows\\WindowsUpdate\\Scheduled Start" /Enable >nul 2>&1'
                  ).then((r) => { addOutput(r.success ? "执行完成" : "执行出错"); setRunningIndex(null); });
                }}
                className="flex-1 px-4 py-2 text-sm text-slate-300 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors">还原 Windows 更新</button>
            </div>
          </Panel>
        </Overlay>
      )}

      {dialog.visible && dialog.type === "defender" && dialog.item && (
        <Overlay>
          <Panel title="关闭 Windows Defender" onClose={closeDialog}>
            <p className="text-sm text-slate-400 leading-relaxed">将写入 Defender 策略注册表项，重启后生效。<br />确定要执行吗？</p>
            <div className="flex justify-end gap-3 mt-5">
              <Btn onClick={closeDialog}>否(N)</Btn>
              <Btn primary onClick={() => { closeDialog(); executeAction(dialog.item!); }}>是(Y)</Btn>
            </div>
          </Panel>
        </Overlay>
      )}
    </div>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">{children}</div>;
}

function Panel({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="bg-slate-900 border border-slate-700/60 rounded-xl shadow-2xl w-96 overflow-hidden relative">
      <button onClick={onClose} className="absolute top-3 right-3 p-1 rounded-lg text-slate-500 hover:text-white hover:bg-slate-700 transition-colors z-10"><X className="h-4 w-4" /></button>
      <div className="px-6 py-4 border-b border-slate-700/50 flex items-center gap-2">
        <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0"><span className="text-blue-400 text-xs font-bold">?</span></div>
        <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

function Btn({ primary, onClick, children }: { primary?: boolean; onClick: () => void; children: React.ReactNode }) {
  if (primary) {
    return <button onClick={onClick} className="px-5 py-1.5 text-sm text-white bg-purple-600 hover:bg-purple-500 rounded-lg border border-purple-500/50 transition-colors shadow-lg shadow-purple-600/20">{children}</button>;
  }
  return <button onClick={onClick} className="px-5 py-1.5 text-sm text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">{children}</button>;
}

export default App;
