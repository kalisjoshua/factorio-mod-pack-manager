const { app, BrowserWindow } = require('electron')

let mainWindow

function appWindow() {
  mainWindow = new BrowserWindow({
    height: 1000,
    width: 1000,
  })

  mainWindow
    .on('closed', () => { mainWindow = null })

  mainWindow
    .loadURL(`file://${__dirname}/index.html`)
}

app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    appWindow()
  }
})

app.on('ready', appWindow)

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
