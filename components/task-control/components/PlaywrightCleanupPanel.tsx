"use client";

import {useState} from "react";
import styles from "../styles/playwright-ops.module.css";

type Candidate={path:string;size:number;ageDays:number;modified:string;category:string;source:string};
type Scan={token:string;at:string;minAgeDays:number;total:number;totals:{bytes:number;screenshot:number;trace:number;log:number;snapshot:number};
  candidates:Candidate[];scannedDirectories:number;truncated:boolean;unreadableDirectories:number;ignoredSymlinks:number};
type TrashItem={id:string;path:string;size:number;archivedAt:string;status:string;category:string};
type Trash={total:number;bytes:number;items:TrashItem[]};
type ArchiveResult={moved:number;bytes:number;failed:{path:string;reason:string}[]};
type PurgeResult={purged:number;bytes:number;failed:{id:string;reason:string}[]};
type RestoreResult={restored:number;failed:{id:string;reason:string}[]};
type Api=<T>(p:string,method?:string,body?:unknown)=>Promise<T>;
const mb=(n:number)=>(n/1024/1024).toLocaleString("vi-VN",{maximumFractionDigits:2})+" MB";

export default function PlaywrightCleanupPanel({api}:{api:Api}){
  const [age,setAge]=useState(15);
  const [scan,setScan]=useState<Scan|null>(null);
  const [trash,setTrash]=useState<Trash|null>(null);
  const [selected,setSelected]=useState<string[]>([]);
  const [selectedTrash,setSelectedTrash]=useState<string[]>([]);
  const [filter,setFilter]=useState("");
  const [kind,setKind]=useState("all");
  const [page,setPage]=useState(0);
  const [trashPage,setTrashPage]=useState(0);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [status,setStatus]=useState("");
  const [confirmation,setConfirmation]=useState("");
  const filtered=scan?.candidates.filter(c=>(kind==="all"||c.category===kind) && c.path.toLowerCase().includes(filter.toLowerCase()))||[];
  const size=filtered.filter(x=>selected.includes(x.path)).reduce((sum,x)=>sum+x.size,0);
  async function work(fn:()=>Promise<void>){
    setError("");setStatus("");setBusy(true);
    try{await fn();}catch(e){setError(String(e));}finally{setBusy(false);}
  }
  async function refreshTrash(){
    setTrash(await api<Trash>("/cleanup/trash"));
  }
  async function scanAll(){
    await work(async()=>{
      const found=await api<Scan>("/cleanup/scan","POST",{minAgeDays:age});
      setScan(found);setSelected([]);setPage(0);
      await refreshTrash();
      setStatus("Scan complete. No files have been moved or deleted.");
    });
  }
  async function archive(){
    if(!scan||selected.length===0)return;
    const confirmationMessage="Move "+selected.length+" selected evidence files ("+mb(size)+") into _delete? This can be restored.";
    if(!window.confirm(confirmationMessage))return;
    await work(async()=>{
      let moved=0,failed=0,bytes=0;
      for(let n=0;n<selected.length;n+=1000){
        const result=await api<ArchiveResult>("/cleanup/archive","POST",{token:scan.token,paths:selected.slice(n,n+1000)});
        moved+=result.moved;bytes+=result.bytes;failed+=result.failed.length;
        if(n+1000<selected.length&&result.moved>0)break; // one snapshot expires after first batch; rescan before further moves
      }
      setStatus(moved+" files moved to _delete ("+mb(bytes)+"). "+(failed?failed+" skipped due to changed files.":"Restore is available below."));
      setSelected([]);setScan(null);await refreshTrash();
    });
  }
  async function restore(){
    if(!selectedTrash.length)return;
    await work(async()=>{
      const response=await api<RestoreResult>("/cleanup/restore","POST",{ids:selectedTrash.slice(0,1000)});
      setStatus(response.restored+" files restored. "+response.failed.length+" skipped.");
      setSelectedTrash([]);await refreshTrash();
    });
  }
  async function permanentlyDelete(){
    if(!selectedTrash.length||confirmation!=="DELETE PERMANENTLY")return;
    if(!window.confirm("FINAL CONFIRMATION: Permanently delete "+selectedTrash.length+" archived files? This frees disk space and cannot be undone."))return;
    await work(async()=>{
      const response=await api<PurgeResult>("/cleanup/purge","POST",
        {ids:selectedTrash.slice(0,1000),confirmation});
      setStatus(response.purged+" archived files permanently deleted; "+mb(response.bytes)+" reclaimed. "+response.failed.length+" skipped.");
      setSelectedTrash([]);setConfirmation("");await refreshTrash();
    });
  }
  function toggle(item:string,items:string[],setter:(s:string[])=>void){
    setter(items.includes(item)?items.filter(x=>x!==item):[...items,item]);
  }
  return <div className={styles.cleanup}>
    <section className={styles.panel}>
      <div className={styles.heading}><div>
        <strong>Old Playwright Artifacts Cleanup</strong>
        <p>Scans browser-generated screenshots, trace ZIPs, console logs and page snapshots in Playwright/test-output folders. Project design assets, source code, baselines, models and browser profiles are excluded.</p>
      </div></div>
      <div className={styles.tools}>
        <label>Old file threshold
          <select aria-label="Minimum screenshot age" value={age} onChange={e=>{setAge(Number(e.target.value));setScan(null);setSelected([]);}}>
            <option value={15}>Older than 15 days (default)</option>
            <option value={7}>Older than 7 days</option>
            <option value={1}>Older than 1 day</option>
            <option value={0}>All ages — manual selection only</option>
            <option value={30}>Older than 30 days</option>
            <option value={90}>Older than 90 days</option>
          </select>
        </label>
        <button disabled={busy} onClick={()=>void scanAll()}>{busy?"Scanning / applying...":"Scan screenshots"}</button>
      </div>
      {scan&&<>
        <div className={styles.stats}><strong>{scan.total} files</strong><strong>{mb(scan.totals.bytes)}</strong>
          <span>{scan.totals.screenshot} screenshots · {scan.totals.trace} traces · {scan.totals.log} logs · {scan.totals.snapshot} snapshots</span></div>
        <p className={styles.hint}>Scanned {scan.scannedDirectories} folders. {scan.truncated?"Results truncated; inspect before cleanup.":"Complete within safe scan scope."} Only explicitly selected files are moved.</p>
        <div className={styles.tools}>
          <input aria-label="Filter cleanup candidates" value={filter} onChange={e=>{setFilter(e.target.value);setPage(0);}} placeholder="Filter by project, filename..."/>
          <select aria-label="Filter artifact type" value={kind} onChange={e=>{setKind(e.target.value);setPage(0);setSelected([]);}}>
            <option value="all">All artifacts</option><option value="screenshot">Screenshots only</option><option value="trace">Trace ZIP only</option><option value="log">Console logs only</option><option value="snapshot">Page snapshots only</option>
          </select>
          <button disabled={busy||filtered.length===0} onClick={()=>setSelected(filtered.slice(0,1000).map(x=>x.path))}>Select all matching (max 1000)</button>
          <button disabled={!selected.length} onClick={()=>setSelected([])}>Clear selection</button>
        </div>
        <div className={styles.tableScroll}>
          <table><thead><tr><th>Select</th><th>Path</th><th>Type</th><th>Age</th><th>Size</th></tr></thead>
          <tbody>{filtered.slice(page*100,page*100+100).map(f=><tr key={f.path}>
            <td><input aria-label={"Select "+f.path} type="checkbox" checked={selected.includes(f.path)}
              onChange={()=>toggle(f.path,selected,setSelected)}/></td>
            <td style={{wordBreak:"break-all"}}>{f.path}</td><td>{f.category}</td><td>{f.ageDays} d</td><td>{mb(f.size)}</td>
          </tr>)}</tbody></table>
        </div>
        <div className={styles.tools}><button disabled={page===0} onClick={()=>setPage(x=>x-1)}>Previous</button>
          <span>{Math.min(filtered.length,page*100+1)}–{Math.min(filtered.length,(page+1)*100)} / {filtered.length}</span>
          <button disabled={(page+1)*100>=filtered.length} onClick={()=>setPage(x=>x+1)}>Next</button></div>
        <div className={styles.heading}><span>{selected.length} selected · {mb(size)}</span>
          <button disabled={busy||!selected.length} onClick={()=>void archive()}>Move selected to _delete</button></div>
      </>}
      {!scan&&<p className={styles.empty}>Choose an age threshold and scan first. Nothing is deleted automatically from other projects.</p>}
      {error&&<p role="alert" className={styles.error}>{error}</p>}
      {status&&<p role="status" className={styles.notice}>{status}</p>}
    </section>
    <section className={styles.panel}>
      <div className={styles.heading}><div><strong>Recovery &amp; Disk Space</strong>
        <p>Files moved into _delete remain recoverable and still occupy disk space. Only archive records created by this cleanup tool can be permanently purged here.</p></div>
        <button disabled={busy} onClick={()=>void work(async()=>{await refreshTrash();setStatus("Trash refreshed");})}>Refresh Trash</button>
      </div>
      {trash&&<>
        <div className={styles.stats}><strong>{trash.total} archived files</strong><strong>{mb(trash.bytes)} still on disk</strong></div>
        <div className={styles.tools}>
          <button disabled={!trash.total} onClick={()=>setSelectedTrash(trash.items.slice(0,1000).map(x=>x.id))}>Select all (max 1000)</button>
          <button disabled={!selectedTrash.length} onClick={()=>setSelectedTrash([])}>Clear selection</button>
        </div>
        <div className={styles.tableScroll}><table><thead><tr><th>Select</th><th>Original path</th><th>Archived</th><th>Size</th></tr></thead><tbody>
          {trash.items.slice(trashPage*50,trashPage*50+50).map(f=><tr key={f.id}>
            <td><input type="checkbox" aria-label={"Select archived "+f.id} checked={selectedTrash.includes(f.id)}
              onChange={()=>toggle(f.id,selectedTrash,setSelectedTrash)}/></td>
            <td style={{wordBreak:"break-all"}}>{f.path}</td>
            <td>{new Date(f.archivedAt).toLocaleDateString("vi-VN")}</td><td>{mb(f.size)}</td>
          </tr>)}
        </tbody></table></div>
        <div className={styles.tools}><button disabled={trashPage===0} onClick={()=>setTrashPage(p=>p-1)}>Previous</button>
          <span>Page {trashPage+1}/{Math.max(1,Math.ceil(trash.total/50))}</span>
          <button disabled={(trashPage+1)*50>=trash.total} onClick={()=>setTrashPage(p=>p+1)}>Next</button></div>
        <div className={styles.tools}>
          <button disabled={busy||!selectedTrash.length} onClick={()=>void restore()}>Restore selected</button>
        </div>
        <p className={styles.error}>Permanent deletion is irreversible. Only purge selected files after reviewing their original paths.</p>
        <div className={styles.tools}>
          <input aria-label="Permanent deletion confirmation" value={confirmation} onChange={e=>setConfirmation(e.target.value)}
            placeholder="Type DELETE PERMANENTLY"/>
          <button disabled={busy||!selectedTrash.length||confirmation!=="DELETE PERMANENTLY"}
            onClick={()=>void permanentlyDelete()}>Permanently delete selected</button>
        </div>
      </>}
      {!trash&&<p className={styles.empty}>Click Refresh Trash or Scan Screenshots to load the managed archive.</p>}
    </section>
  </div>;
}
