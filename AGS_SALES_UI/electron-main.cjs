const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

const configPath = path.join(app.getPath('userData'), 'config.json');

function createWindow() {
  const isDev = process.env.NODE_ENV === 'development';
  const iconPath = isDev 
    ? path.join(__dirname, 'public', 'icon.png')
    : path.join(__dirname, 'dist', 'icon.png');

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false, // Ocultar hasta maximizar para evitar parpadeos
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false, // For simplicity in this demo, allows easy IPC
      webSecurity: false,
    },
    title: "AGS_SALES ERP",
    icon: iconPath,
  });

  mainWindow.maximize();
  mainWindow.show();

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[RENDERER CONSOLE] ${message} (at ${sourceId}:${line})`);
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC handlers for Configuration
ipcMain.handle('get-config', () => {
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Failed to read config', error);
  }
  return null;
});

// IPC handler to get app version from package.json (always correct, never 0.0.0)
ipcMain.handle('get-app-version', () => {
  try {
    const pkgPath = path.join(__dirname, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return pkg.version || '0.0.0';
  } catch (e) {
    return '0.0.0';
  }
});

// IPC handler to get machine unique ID (Motherboard UUID)
ipcMain.handle('get-machine-id', () => {
  try {
    const { execSync } = require('child_process');
    let id = '';
    if (process.platform === 'win32') {
      id = execSync('powershell -Command "(Get-CimInstance Win32_ComputerSystemProduct).UUID"', { encoding: 'utf8' }).trim();
    } else if (process.platform === 'darwin') {
      id = execSync("ioreg -rd1 -c IOPlatformExpertDevice | awk '/IOPlatformUUID/ { split($0, line, \"=\"); print line[2] }'", { encoding: 'utf8' }).replace(/[ \"]/g, "").trim();
    } else {
      id = execSync('cat /var/lib/dbus/machine-id 2>/dev/null || cat /etc/machine-id 2>/dev/null', { encoding: 'utf8' }).trim();
    }
    return id || 'unknown-device';
  } catch (e) {
    console.error('Failed to get machine id', e);
    return 'unknown-device';
  }
});

ipcMain.handle('save-config', (event, config) => {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Failed to save config', error);
    return false;
  }
});

// Upload update file via axios stream (avoids Chromium fetch memory limits for large files)
ipcMain.handle('upload-update-file', async (event, { apiUrl, token, version, filePath }) => {
  try {
    const axios = require('axios');
    const FormData = require('form-data');

    const form = new FormData();
    form.append('version', version);
    form.append('file', fs.createReadStream(filePath), path.basename(filePath));

    const response = await axios.post(`${apiUrl}users/upload-update/`, form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${token}`
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    return { ok: true, data: response.data };
  } catch (error) {
    const msg = error.response?.data?.error || error.message || 'Error desconocido';
    return { ok: false, error: msg };
  }
});

// Printer integration
ipcMain.handle('get-printers', async () => {
  try {
    if (mainWindow) {
      const printers = await mainWindow.webContents.getPrintersAsync();
      return printers;
    }
    return [];
  } catch (error) {
    console.error('Failed to get printers', error);
    return [];
  }
});

// Native file dialog for images
ipcMain.handle('select-image', async () => {
  if (mainWindow) {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['jpg', 'png', 'jpeg', 'webp'] }]
    });
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
  }
  return null;
});

// Native message box dialog
ipcMain.handle('show-alert', async (event, options) => {
  if (mainWindow) {
    dialog.showMessageBoxSync(mainWindow, {
      type: options.type || 'info',
      title: options.title || 'Información',
      message: options.message,
      buttons: ['Aceptar']
    });
  }
});

// Silent background printing
ipcMain.handle('print-silent', async (event, htmlContent, printerName) => {
  return new Promise((resolve) => {
    let printWin = new BrowserWindow({
      show: false,
      webPreferences: { 
        nodeIntegration: true, 
        contextIsolation: false,
        webSecurity: false // Allow file:// protocols for images
      }
    });

    const os = require('os');
    const tempPath = path.join(os.tmpdir(), `ticket_${Date.now()}.html`);
    fs.writeFileSync(tempPath, htmlContent, 'utf8');

    printWin.loadFile(tempPath);
    
    printWin.webContents.on('did-finish-load', () => {
      // Pequeno timeout para garantizar render de fuentes e imagenes
      setTimeout(() => {
        printWin.webContents.print({
          silent: true,
          deviceName: printerName,
          margins: { marginType: 'none' }
        }, (success, failureReason) => {
          printWin.close();
          try { fs.unlinkSync(tempPath); } catch(e){}
          resolve({ success, failureReason });
        });
      }, 500);
    });
  });
});

// Native exit application
ipcMain.handle('exit-app', () => {
  app.quit();
});

// Open external URLs (e.g. for downloading updates in the default browser)
ipcMain.handle('open-external', async (event, url) => {
  const { shell } = require('electron');
  await shell.openExternal(url);
});

// Update Downloader
ipcMain.handle('download-update', async (event, url) => {
  return new Promise(async (resolve, reject) => {
    try {
      const os = require('os');
      const fs = require('fs');
      const path = require('path');
      const axios = require('axios');
      const { spawn } = require('child_process');

      const tempPath = path.join(os.tmpdir(), `AGS_SALES_Update_${Date.now()}.exe`);
      
      const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream'
      });

      const totalLength = response.headers['content-length'];
      
      const writer = fs.createWriteStream(tempPath);
      
      let downloaded = 0;
      response.data.on('data', (chunk) => {
        downloaded += chunk.length;
        if (totalLength) {
          const percent = Math.round((downloaded / totalLength) * 100);
          if (mainWindow) {
            mainWindow.webContents.send('update-progress', percent);
          }
        }
      });

      response.data.pipe(writer);

      writer.on('close', () => {
        if (mainWindow) {
          mainWindow.webContents.send('update-complete');
        }
        
        // Small delay to ensure Windows releases the file lock
        setTimeout(() => {
          try {
            // Execute the installer
            const child = spawn(tempPath, [], {
              detached: true,
              stdio: 'ignore'
            });
            
            child.unref();
            
            // Quit current app so installer can run
            app.quit();
            resolve(true);
          } catch (e) {
            console.error("Spawn error:", e);
            reject(e);
          }
        }, 1000);
      });

      writer.on('error', (err) => {
        console.error("Download write error:", err);
        reject(err);
      });

    } catch (error) {
      console.error("Download error:", error);
      reject(error);
    }
  });
});
