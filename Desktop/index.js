const shelljs = require('shelljs');
const { app, shell, BrowserWindow, dialog, Menu } = require('electron');
const settings = require('electron-settings');
const path = require('path');
const getPort = require('get-port');
const aboutPage = require('./aboutPage');

let mainWindow;
let server;

function findFile(basePath, fileName) {
  if (basePath.length < 3) {
    return null;
  }
  const results = shelljs.find(basePath).filter((file) => {
    return (path.basename(file) === fileName);
  });

  if (results.length > 0) {
    return results[0];
  }
  return findFile(path.dirname(basePath), fileName);
}

function updateConfig(basepath) {
  const config = {};
  config.pvbatch = findFile(basepath[0], 'pvpython');
  config.divvy = findFile(basepath[0], 'pvw-divvy.py');
  if (config.divvy) {
    config.divvywww = path.join(path.dirname(path.dirname(config.divvy)), 'www');
  }
  settings.set('paraview', config);
  if (config.pvbatch && config.divvy && config.divvywww) {
    if (mainWindow) {
      mainWindow.close();
      mainWindow = null;
    }
    if (server) {
      server.kill('SIGINT');
      server = null;
    }
  }
  startServer();
}

function openFile(filePathToLoad) {
  startServer(filePathToLoad);
}

function createMenu() {
  const menuTemplate = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open data',
          accelerator: 'CmdOrCtrl+O',
          click() { dialog.showOpenDialog(mainWindow, { title: 'Open data file', properties: ['openFile'] }, openFile); },
        }, {
          label: 'Configure ParaView',
          accelerator: 'CmdOrCtrl+P',
          click() { dialog.showOpenDialog(mainWindow, { title: 'Configure ParaView', properties: ['openFile', 'openDirectory'] }, updateConfig); },
        },
      ],
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'Learn More',
          click() { shell.openExternal('https://kitware.github.io/divvy'); },
        },
      ],
    },
  ];

  if (process.platform === 'darwin') {
    const name = app.getName();
    menuTemplate.unshift({
      label: name,
      submenu: [
        aboutPage,
        { type: 'separator' },
        { role: 'services', submenu: [] },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideothers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    });
  } else {
    menuTemplate[menuTemplate.length - 1].submenu.push(aboutPage);
  }

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
}

function createWindow(portToUse = 8080) {
  if (!mainWindow) {
    mainWindow = new BrowserWindow({ fullscreen: false, icon: `${__dirname}/src/icon.png` });
    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  }
  mainWindow.loadURL(`http://localhost:${portToUse}`);
}

function startServer(fileToLoad) {
  if (settings.get('paraview.pvbatch') && settings.get('paraview.divvy') && fileToLoad) {
    shelljs.env.PV_ALLOW_BATCH_INTERACTION = '1';
    getPort().then((port) => {
      const cmd = [
        `"${settings.get('paraview.pvbatch')}"`,
        '--force-offscreen-rendering',
        `"${settings.get('paraview.divvy')}"`,
        '--content',
        `"${settings.get('paraview.divvywww')}"`,
        '--data',
        `"${fileToLoad}"`,
        '--port',
        `${port}`,
      ].join(' ');
      server = shelljs.exec(cmd, { async: true });
      server.stdout.on('data', (data) => {
        if (data.indexOf('Starting factory') !== -1) {
          createWindow(port);
        }
      });
      server.stderr.on('data', (data) => {
        if (data.indexOf('Starting factory') !== -1) {
          createWindow(port);
        }
      });
    });
  } else if (!settings.get('paraview.pvbatch') || !settings.get('paraview.divvy')) {
    // Need configuration
    mainWindow = new BrowserWindow({ fullscreen: false, icon: `${__dirname}/src/icon.png` });
    mainWindow.loadURL(`file://${__dirname}/configure.html`);
    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  } else {
    // Need data
    mainWindow = new BrowserWindow({ fullscreen: false, icon: `${__dirname}/src/icon.png` });
    mainWindow.loadURL(`file://${__dirname}/openFile.html`);
    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  }
}

app.on('ready', () => {
  startServer();
  createMenu();
});

// Quit when all windows are closed.
function exit() {
  if (server) {
    server.kill('SIGINT');
    server = null;
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
  process.exit(0);
}
app.on('window-all-closed', exit);

// app.on('activate', () => {
//   if (mainWindow === null) {
//     startServer();
//   }
// });

// app.setAboutPanelOptions({
//   applicationName: 'ParaViewWeb - Visualizer',
//   copyright: 'Kitware 2017',
// });
