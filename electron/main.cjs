const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const https = require('https');
const fs = require('fs');
const os = require('os');

// ============ Global Error Handling ============
process.on('uncaughtException', (err) => {
  try {
    const logPath = path.join(os.tmpdir(), 'pi-toolbox-error.log');
    fs.writeFileSync(logPath, `[${new Date().toISOString()}] ${err.stack || err.message}\n`);
  } catch (_) {}
});

process.on('unhandledRejection', (reason) => {
  try {
    const logPath = path.join(os.tmpdir(), 'pi-toolbox-error.log');
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] Unhandled Rejection: ${reason}\n`);
  } catch (_) {}
});

// ============ Use SwiftShader software rendering to prevent GPU crash ============
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('use-gl', 'swiftshader');
app.commandLine.appendSwitch('no-sandbox');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#000000',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Show window when ready to avoid flash of white
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ============ IPC Handlers ============

// Run a CMD command
ipcMain.handle('run-command', async (_event, command) => {
  return new Promise((resolve) => {
    exec(`chcp 65001 >nul && ${command}`, { shell: 'cmd.exe' }, (error, stdout, stderr) => {
      const output = stdout || stderr || '';
      resolve({ success: !error, output: output.trim() });
    });
  });
});

// Run PowerShell command
ipcMain.handle('run-powershell', async (_event, command) => {
  return new Promise((resolve) => {
    exec(
      `chcp 65001 >nul && powershell -NoProfile -Command "${command.replace(/\"/g, '\\"')}"`,
      { shell: 'cmd.exe' },
      (error, stdout, stderr) => {
        const output = stdout || stderr || '';
        resolve({ success: !error, output: output.trim() });
      }
    );
  });
});

// Download file (follows redirects manually for Electron's older Node)
ipcMain.handle('download-file', async (_event, url, dest) => {
  return new Promise((resolve) => {
    const doDownload = (targetUrl) => {
      const file = fs.createWriteStream(dest);
      https.get(targetUrl, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          file.close();
          fs.unlink(dest, () => {});
          doDownload(response.headers.location);
          return;
        }
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve({ success: true, path: dest });
        });
      }).on('error', (err) => {
        fs.unlink(dest, () => {});
        resolve({ success: false, error: err.message });
      });
    };
    doDownload(url);
  });
});

// Check latest WSL download URL
ipcMain.handle('check-latest-wsl', async () => {
  const wslUrls = [
    'https://wslstorestorage.blob.core.windows.net/wslblob/wsl_update_x64.msi',
    'https://aka.ms/wsl2kernel',
    'https://github.com/microsoft/WSL/releases/latest/download/wsl.2.x64.msi',
  ];

  for (const url of wslUrls) {
    try {
      const check = await new Promise((resolve) => {
        const req = https.get(url, (res) => {
          resolve(res.statusCode === 200 || res.statusCode === 302 || res.statusCode === 301);
          res.destroy();
        });
        req.on('error', () => resolve(false));
        req.setTimeout(5000, () => { req.destroy(); resolve(false); });
      });
      if (check) {
        return { success: true, url, name: path.basename(url) };
      }
    } catch (_) {}
  }

  return { success: true, url: wslUrls[0], name: 'wsl_update_x64.msi' };
});

// Check latest Pi Network Docker image tag from Docker Hub API
ipcMain.handle('check-latest-pi-image', async () => {
  try {
    const result = await new Promise((resolve, reject) => {
      const req = https.get('https://hub.docker.com/v2/repositories/pinetwork/pi-node-docker/tags?page_size=50&ordering=last_updated', (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => resolve(data));
      });
      req.on('error', reject);
      req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
    });

    if (!result) return { success: false, error: '无法连接到 Docker Hub' };

    const json = JSON.parse(result);
    const tags = json.results || [];

    const communityTags = tags
      .filter(t => t.name && /^community-v1\.\d+-p[\d.]+/.test(t.name))
      .sort((a, b) => {
        const extractVer = (tag) => {
          const m = tag.name.match(/p([\d.]+)/);
          return m ? m[1].split('.').map(n => parseInt(n) || 0) : [0];
        };
        const va = extractVer(a);
        const vb = extractVer(b);
        for (let i = 0; i < Math.max(va.length, vb.length); i++) {
          const diff = (vb[i] || 0) - (va[i] || 0);
          if (diff !== 0) return diff;
        }
        return 0;
      });

    if (communityTags.length > 0) {
      const latest = communityTags[0].name;
      return {
        success: true,
        tag: latest,
        fullImage: `pinetwork/pi-node-docker:${latest}`,
        allTags: communityTags.map(t => t.name),
      };
    }

    return { success: false, error: '未找到 community 镜像标签' };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Open external URL
ipcMain.handle('open-external', async (_event, url) => {
  shell.openExternal(url);
});

// Get temp path
ipcMain.handle('get-temp-path', () => os.tmpdir());

// Window controls
ipcMain.handle('window-minimize', () => {
  mainWindow?.minimize();
  return true;
});

ipcMain.handle('window-maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
  return mainWindow?.isMaximized() || false;
});

ipcMain.handle('window-close', () => {
  mainWindow?.close();
  return true;
});
