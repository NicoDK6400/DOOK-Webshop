import {runBackup} from './backup.mjs';
// Runs inside the optional `backup` service in docker-compose.yml — a sidecar sharing the
// app's data volume read-write, writing snapshots out to a separate, host-mounted directory
// so a lost or corrupted data volume doesn't also take the backups with it.
const opts={
 dbPath:process.env.DB_PATH||'./data/dook.sqlite',
 mediaPath:process.env.MEDIA_PATH||'./data/media',
 backupDir:process.env.BACKUP_DIR||'./backups',
 keep:Number(process.env.BACKUP_KEEP)||14
};
const intervalMs=(Number(process.env.BACKUP_INTERVAL_HOURS)||24)*3600000;
function tick(){
 try{const {dest,pruned,kept}=runBackup(opts);console.log(`[backup] wrote ${dest}, pruned ${pruned}, kept ${kept}`)}
 catch(error){console.error('[backup] failed',error)}
}
tick();
setInterval(tick,intervalMs);
