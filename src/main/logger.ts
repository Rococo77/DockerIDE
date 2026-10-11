import { app } from 'electron';
import log from 'electron-log/main';

log.initialize();
log.transports.file.level = 'info';
// `electron-forge start` doesn't set NODE_ENV: show everything in the console whenever the app isn't packaged
log.transports.console.level = app.isPackaged ? 'warn' : 'debug';

export default log;
