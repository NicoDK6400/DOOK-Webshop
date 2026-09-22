import {readFileSync} from 'node:fs';
// Shared by the dev preview and the production adapter — both use node:sqlite
// (server/db.mjs) via the same sync exec/prepare shape.
export function runMigrations(sql,{journalPath='drizzle/meta/_journal.json',migrationsDir='drizzle'}={}){
 sql.exec('CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY)');
 const journal=JSON.parse(readFileSync(journalPath,'utf8'));
 // A database restored from the legacy export (database/restore.sql) already has the
 // 0000/0001 tables without a recorded migration — detect and skip re-creating them.
 const legacy=!!sql.prepare("SELECT name FROM sqlite_master WHERE name='settings'").get();
 for(const entry of journal.entries){
  if(sql.prepare('SELECT name FROM _migrations WHERE name=?').get(entry.tag))continue;
  if(!(legacy&&entry.idx<2))sql.exec(readFileSync(migrationsDir+'/'+entry.tag+'.sql','utf8'));
  sql.prepare('INSERT INTO _migrations(name) VALUES(?)').run(entry.tag);
 }
}
