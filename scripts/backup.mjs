import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,readdirSync,statSync,rmSync,cpSync,existsSync} from 'node:fs';
import {join} from 'node:path';

// VACUUM INTO produces a single, consistent snapshot file even while the live server keeps
// writing to the database (WAL mode) — a plain file copy of dook.sqlite could otherwise miss
// recent writes still sitting in the -wal file, or copy it mid-write.
export function runBackup({dbPath,mediaPath,backupDir,keep}){
 const stamp=new Date().toISOString().replace(/[:.]/g,'-');
 const dest=join(backupDir,stamp);
 mkdirSync(dest,{recursive:true});
 const db=new DatabaseSync(dbPath);
 db.prepare('VACUUM INTO ?').run(join(dest,'dook.sqlite'));
 db.close();
 if(existsSync(mediaPath))cpSync(mediaPath,join(dest,'media'),{recursive:true});
 const entries=readdirSync(backupDir).filter(d=>statSync(join(backupDir,d)).isDirectory()).sort();
 let pruned=0;
 while(entries.length-pruned>keep){rmSync(join(backupDir,entries[pruned]),{recursive:true,force:true});pruned++}
 return {dest,pruned,kept:entries.length-pruned};
}

if(import.meta.url===`file://${process.argv[1]}`){
 const {dest,pruned,kept}=runBackup({
  dbPath:process.env.DB_PATH||'./data/dook.sqlite',
  mediaPath:process.env.MEDIA_PATH||'./data/media',
  backupDir:process.env.BACKUP_DIR||'./backups',
  keep:Number(process.env.BACKUP_KEEP)||14
 });
 console.log(`Backup written to ${dest}. Pruned ${pruned} old backup(s), ${kept} kept.`);
}
