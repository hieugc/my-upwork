"use client";

/* eslint-disable @next/next/no-img-element -- Local cross-origin screenshots need CORS-aware native images; no Next image optimizer is available on loopback. */
import { useCallback, useEffect, useState } from "react";
import styles from "../styles/playwright-ops.module.css";
import PlaywrightCleanupPanel from "./PlaywrightCleanupPanel";

const API = "http://127.0.0.1:8095";
type FileItem = { name:string;path:string;kind:"file"|"directory"|"symlink";size:number;modified:string;writable:boolean };
type Files = {path:string;entries:FileItem[];truncated:boolean;writable:boolean;managedDirs:string[]};
type OpenFile = {path:string;content:string;sha256:string;writable:boolean};
type Session = {id:string;startedAt:string;source:string;tabs:{index:number;url:string}[]};
type Job = {id:string;status:string;urls:string[];completed:{url:string;screenshot:string}[];error?:string;startedAt:string};
type ImageFile = {name:string;at:string;bytes:number};
type Log = {at:string;kind:string;message:string};
type GatewayRun = {project:string;taskId?:string|null;runId?:string|null;status:string;heartbeatAt?:string|null;runtimeSource?:string;eventCount?:number|null};
type Profile = {profileId:string;category:string};
type Checkpoint = {profileId:string;projectId?:string;taskId?:string;sessionId?:string;updatedAt:string;lastTool:string};

// CSRF token comes only from the local service to the approved dashboard Origin.
// Renew once after service restart; never store the token in localStorage or URLs.
let csrf:Promise<string>|null=null;
async function mutationToken():Promise<string>{
  csrf??=fetch(API+"/csrf",{cache:"no-store"})
    .then(async r=>{if(!r.ok)throw Error("Ops authorization unavailable");return (await r.json()).token as string;});
  return csrf;
}
async function request<T>(path:string,method="GET",body?:unknown):Promise<T>{
  for(let attempt=0;attempt<2;attempt++){
    const headers:Record<string,string>={};
    if(body!==undefined){headers["Content-Type"]="application/json";headers["X-Ops-Token"]=await mutationToken();}
    const response=await fetch(API+path,{method,cache:"no-store",headers,
      ...(body===undefined?{}:{body:JSON.stringify(body)})});
    const data=await response.json().catch(()=>({}));
    if(response.status===403 && data.error==="INVALID_MUTATION_TOKEN" && attempt===0){csrf=null;continue;}
    if(!response.ok)throw new Error(data.error||"HTTP "+response.status);
    return data as T;
  }
  throw new Error("Ops token renewal failed");
}
function parent(p:string){const parts=p.split("/").filter(x=>x&&x!==".");parts.pop();return parts.join("/")||".";}
function encode(p:string){return encodeURIComponent(p);}
export default function PlaywrightOpsConsole({gatewayRuns=[],onOpenGatewayWorkflow}: {gatewayRuns?:GatewayRun[];onOpenGatewayWorkflow?:()=>void}){
  const [tab,setTab]=useState<"files"|"sessions"|"profiles"|"workflows"|"artifacts"|"cleanup">("files");
  const [available,setAvailable]=useState(false);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [cwd,setCwd]=useState(".");
  const [folderName,setFolderName]=useState("");
  const [fileFilter,setFileFilter]=useState("");
  const [renamePath,setRenamePath]=useState("");
  const [renameName,setRenameName]=useState("");
  const [profileSearch,setProfileSearch]=useState("");
  const [profilePage,setProfilePage]=useState(1);
  const [files,setFiles]=useState<Files|null>(null);
  const [selected,setSelected]=useState<OpenFile|null>(null);
  const [draft,setDraft]=useState("");
  const [sessions,setSessions]=useState<Session[]>([]);
  const [profiles,setProfiles]=useState<Profile[]>([]);
  const [checkpoints,setCheckpoints]=useState<Checkpoint[]>([]);
  const [profileError,setProfileError]=useState("");
  const [address,setAddress]=useState("https://example.com");
  const [visible,setVisible]=useState(false);
  const [jobUrls,setJobUrls]=useState("https://example.com");
  const [jobs,setJobs]=useState<Job[]>([]);
  const [shots,setShots]=useState<ImageFile[]>([]);
  const [traces,setTraces]=useState<ImageFile[]>([]);
  const [logs,setLogs]=useState<Log[]>([]);

  const update=useCallback(async()=>{
    try {
      const health=await request<{ok:boolean}>("/health");
      setAvailable(health.ok);
      const [s,j,a,l,t]=await Promise.all([
        request<{sessions:Session[]}>("/sessions"),
        request<{jobs:Job[]}>("/workflows"),
        request<{entries:ImageFile[]}>("/screenshots"),
        request<{entries:Log[]}>("/logs"),
        request<{entries:ImageFile[]}>("/traces")
      ]);
      setSessions(s.sessions);setJobs(j.jobs);setShots(a.entries);setLogs(l.entries);setTraces(t.entries);
    } catch(e){setAvailable(false);setError(String(e));}
  },[]);
  const loadFiles=useCallback(async(p:string)=>{
    const data=await request<Files>("/files?path="+encode(p));
    setFiles(data);setCwd(data.path);setSelected(null);
  },[]);
  const loadProfiles=useCallback(async()=>{
    try{
      const response=await fetch("/mcp-admin/playwright/profiles",{cache:"no-store"});
      if(!response.ok)throw new Error("Gateway HTTP "+response.status);
      const data=await response.json();
      setProfiles(Array.isArray(data.profiles)?data.profiles:[]);
      setCheckpoints(Array.isArray(data.sessions)?data.sessions:[]);
      setProfileError("");
    }catch(e){setProfileError(String(e));}
  },[]);
  useEffect(()=>{
    const initial=setTimeout(()=>{void update();void loadFiles(".").catch(e=>setError(String(e)));void loadProfiles();},0);
    const polling=setInterval(()=>{void update();},4000);
    return ()=>{clearTimeout(initial);clearInterval(polling);};
  },[update,loadFiles,loadProfiles]);
  async function run(work:()=>Promise<unknown>,success:string){
    setBusy(true);setError("");setMessage("");
    try{await work();setMessage(success);await update();}
    catch(e){setError(String(e));}finally{setBusy(false);}
  }
  async function openFile(path:string){
    await run(async()=>{const next=await request<OpenFile>("/file?path="+encode(path));setSelected(next);setDraft(next.content);},"File loaded");
  }
  async function save(){
    if(!selected||!selected.writable)return;
    await run(async()=>{
      const result=await request<{sha256:string}>("/file","PUT",{path:selected.path,content:draft,sha256:selected.sha256});
      setSelected({...selected,content:draft,sha256:result.sha256});
    },"File saved with SHA-256 concurrency check");
  }
  async function upload(file:File){
    await run(async()=>{
      if(file.size>4*1024*1024)throw new Error("Upload limit: 4 MB");
      const buffer=await file.arrayBuffer();
      const bytes=new Uint8Array(buffer);let binary="";
      for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
      await request("/upload","POST",{path:cwd,name:file.name,base64:btoa(binary)});
      await loadFiles(cwd);
    },"File uploaded");
  }
  async function download(path:string){
    await run(async()=>{
      const r=await fetch(API+"/download?path="+encode(path));
      if(!r.ok){const data=await r.json().catch(()=>({error:"HTTP "+r.status}));throw Error(data.error);}
      const url=URL.createObjectURL(await r.blob());
      const a=document.createElement("a");a.href=url;a.download=path.split("/").at(-1)||"file";document.body.appendChild(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),5000);
    },"Download requested");
  }
  async function downloadTrace(name:string){
    await run(async()=>{
      const response=await fetch(API+"/trace?name="+encode(name));
      if(!response.ok)throw new Error("Trace HTTP "+response.status);
      const objectUrl=URL.createObjectURL(await response.blob());
      const a=document.createElement("a");a.href=objectUrl;a.download=name;
      document.body.appendChild(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(objectUrl),5000);
    },"Trace archive download requested");
  }
  async function downloadShot(name:string){
    await run(async()=>{
      const response=await fetch(API+"/screenshot?name="+encode(name));
      if(!response.ok)throw new Error("Screenshot HTTP "+response.status);
      const objectUrl=URL.createObjectURL(await response.blob());
      const anchor=document.createElement("a");anchor.href=objectUrl;anchor.download=name;
      document.body.appendChild(anchor);anchor.click();anchor.remove();
      setTimeout(()=>URL.revokeObjectURL(objectUrl),5000);
    },"Screenshot download requested");
  }
  async function createFolder(){
    await run(async()=>{await request("/folder","POST",{path:cwd,name:folderName});setFolderName("");await loadFiles(cwd);},"Folder created");
  }
  async function rename(){
    await run(async()=>{await request("/rename","POST",{path:renamePath,name:renameName});setRenamePath("");setRenameName("");await loadFiles(cwd);},"Renamed");
  }
  async function trash(path:string){
    if(!window.confirm("Move this item to global _delete/playwright-ops? This does not permanently delete it."))return;
    await run(async()=>{await request("/trash","POST",{path});await loadFiles(cwd);},"Moved to trash");
  }
  async function sessionOp(data:Record<string,unknown>,label:string){
    await run(async()=>{await request("/sessions/action","POST",data);},label);
  }
  return <section className={styles.shell}>
    <div className={styles.top}>
      <div><strong>Local Playwright Operations</strong><p>Workspace files, disposable browser sessions, MCP profile inventory, capture workflows and evidence.</p></div>
      <span className={available?styles.online:styles.offline}>{available?"LOCAL SERVICE ONLINE":"LOCAL SERVICE OFFLINE"}</span>
    </div>
    {!available&&<p className={styles.notice}>Start the loopback service from my-upwork with <code>pnpm ops:start</code>. Existing Gateway and sessions remain independent.</p>}
    <div className={styles.tabs} role="tablist" aria-label="Playwright operations">
      {(["files","sessions","profiles","workflows","artifacts","cleanup"] as const).map(x=>
        <button key={x} type="button" className={tab===x?styles.active:""} onClick={()=>{setTab(x);if(x==="profiles")void loadProfiles();}}>{({files:"Files",sessions:"Browser Sessions",profiles:"Profiles",workflows:"Workflows",artifacts:"Screenshots & Logs",cleanup:"Cleanup Old Files"})[x]}</button>)}
    </div>
    {error&&<p role="alert" className={styles.error}>{error}</p>}
    {message&&<p role="status" className={styles.notice}>{message}</p>}
    {tab==="files"&&<div className={styles.grid}>
      <section className={styles.panel}>
        <div className={styles.heading}><strong>Workspace / {cwd}</strong><button onClick={()=>void run(()=>loadFiles(cwd),"Refreshed")} disabled={busy}>Refresh</button></div>
        <div className={styles.tools}><button disabled={cwd==="."||busy} onClick={()=>void run(()=>loadFiles(parent(cwd)),"Opened parent")}>↑ Parent</button>
          <button onClick={()=>void run(()=>loadFiles("input/playwright-ops"),"Input sandbox")}>Input</button>
          <button onClick={()=>void run(()=>loadFiles("output/playwright-ops"),"Output sandbox")}>Output</button>
          <button onClick={()=>void run(()=>loadFiles("artifacts/playwright-ops"),"Artifact sandbox")}>Artifacts</button>
          <label className={styles.upload} style={{opacity:files?.writable?1:0.4}}>+ Upload<input aria-label="Upload file" disabled={!files?.writable||busy} type="file" onChange={e=>{const f=e.target.files?.[0];if(f)void upload(f);e.target.value="";}} /></label>
        </div>
        <p className={styles.path}>{files?.writable?"Writable sandbox: protected by file SHA checks.":"Read-only source directory: Gateway writer lease required for code changes."}</p>
        {files?.writable&&<div className={styles.tools}><input aria-label="New folder name" placeholder="New folder name" value={folderName} onChange={e=>setFolderName(e.target.value)}/><button disabled={busy||!folderName.trim()} onClick={()=>void createFolder()}>+ Folder</button></div>}
        <input aria-label="Filter workspace files" value={fileFilter} onChange={e=>setFileFilter(e.target.value)} placeholder="Filter files and folders..."/>
        <div className={styles.fileList} aria-label="Workspace files">
          {files?.entries.filter(item=>item.name.toLowerCase().includes(fileFilter.toLowerCase())).map(item=><div key={item.path} className={styles.fileRow}>
            <button disabled={item.kind==="symlink"||busy} onClick={()=>item.kind==="directory"?void run(()=>loadFiles(item.path),"Opened directory"):void openFile(item.path)}>
              <span>{item.kind==="directory"?"▣":item.kind==="symlink"?"↗":"▤"}</span> {item.name}</button>
            {item.kind==="file"&&<button className={styles.secondary} title="Download file" onClick={()=>void download(item.path)}>↓</button>}
            {item.writable&&<button className={styles.secondary} title={"Rename "+item.name} onClick={()=>{setRenamePath(item.path);setRenameName(item.name);}}>Rename</button>}
            {item.writable&&<button className={styles.secondary} title={"Move "+item.name+" to trash"} onClick={()=>void trash(item.path)}>Trash</button>}
          </div>)}
          {renamePath&&<div className={styles.tools}><span>Rename {renamePath}</span><input aria-label="Rename to" value={renameName} onChange={e=>setRenameName(e.target.value)}/><button disabled={!renameName.trim()||busy} onClick={()=>void rename()}>Apply</button><button onClick={()=>setRenamePath("")}>Cancel</button></div>}
          {files?.truncated&&<small>Showing first 500 entries.</small>}
          {files?.entries.length===0&&<p>Folder is empty.</p>}
        </div>
      </section>
      <section className={styles.panel}>
        <div className={styles.heading}><strong>Editor</strong>{selected&&<button disabled={busy||!selected.writable||draft===selected.content} onClick={()=>void save()}>Save</button>}</div>
        {selected?<><p className={styles.path}>{selected.path}</p><textarea aria-label="File editor" spellCheck={false} readOnly={!selected.writable} value={draft} onChange={e=>setDraft(e.target.value)} rows={22}/><small>{selected.writable?"SHA-256 guarded save; concurrent source writers are not allowed.":"Read-only: this file is outside console-owned folders and may belong to a leased coding worker."}</small></>
          :<p className={styles.empty}>Select a supported text file to read or edit. Binary files can be downloaded.</p>}
      </section>
    </div>}
    {tab==="sessions"&&<section className={styles.panel}>
      <div className={styles.heading}><div><strong>Isolated browser sessions</strong><p>These sessions are created by this console only. Existing MCP browser profiles are never opened or terminated.</p></div><button disabled={busy} onClick={()=>void run(()=>request("/sessions","POST",{visible}),"Browser started")}>+ New browser</button></div>
      <label className={styles.inline}><input type="checkbox" checked={visible} onChange={e=>setVisible(e.target.checked)}/> Visible browser window (otherwise headless)</label>
      <label className={styles.address}>Navigate URL <input aria-label="Navigate URL" value={address} onChange={e=>setAddress(e.target.value)}/></label>
      {sessions.map(s=><article key={s.id} className={styles.session}>
        <div className={styles.heading}><div><strong>{s.id}</strong><small>Created {new Date(s.startedAt).toLocaleString()} · {s.source}</small></div><div className={styles.tools}><button disabled={busy} onClick={()=>void sessionOp({id:s.id,action:"new-tab"},"Tab opened")}>+ Tab</button><button disabled={busy} onClick={()=>void sessionOp({id:s.id,action:"close"},"Browser closed")}>Close browser</button></div></div>
        {s.tabs.map(t=><div className={styles.tabRow} key={t.index}><span>Tab {t.index+1}: {t.url}</span><div className={styles.tools}>
          <button disabled={busy} onClick={()=>void sessionOp({id:s.id,tab:t.index,action:"navigate",url:address},"Navigated")}>Go</button>
          <button disabled={busy} onClick={()=>void sessionOp({id:s.id,tab:t.index,action:"screenshot"},"Screenshot saved")}>Capture</button>
          <button disabled={busy} onClick={()=>void sessionOp({id:s.id,tab:t.index,action:"close-tab"},"Tab closed")}>×</button>
        </div></div>)}
      </article>)}
      {sessions.length===0&&<p className={styles.empty}>No console-owned browser sessions currently open.</p>}
    </section>}
    {tab==="profiles"&&<section className={styles.panel}>
      <div className={styles.heading}><div><strong>Existing MCP Playwright profiles</strong><p>Read-only registry / last checkpoints. Cookies, passwords and authentication contents are not displayed.</p></div><button onClick={()=>void loadProfiles()}>Refresh</button></div>
      {profileError&&<p role="alert" className={styles.error}>Gateway profiles unavailable: {profileError}</p>}
      <div className={styles.stats}><span>{profiles.length} profiles discovered</span><span>{checkpoints.length} recorded checkpoints</span></div>
      <label className={styles.address}>Find profile or project
        <input aria-label="Search Playwright profiles" value={profileSearch} onChange={e=>{setProfileSearch(e.target.value);setProfilePage(1);}} placeholder="Profile, category, project, task..."/>
      </label>
      <div className={styles.tableScroll}><table><thead><tr><th>Profile</th><th>Category</th><th>Project</th><th>Last tool</th><th>Checkpoint</th></tr></thead>
        <tbody>{profiles.filter(p=>{const c=checkpoints.find(s=>s.profileId===p.profileId||s.profileId==="account:"+p.profileId||s.profileId==="context:"+p.profileId);return [p.profileId,p.category,c?.projectId,c?.taskId,c?.sessionId].some(v=>String(v||"").toLowerCase().includes(profileSearch.toLowerCase()));}).slice((profilePage-1)*25,profilePage*25).map(p=>{const c=checkpoints.find(s=>s.profileId===p.profileId||s.profileId==="account:"+p.profileId||s.profileId==="context:"+p.profileId);return <tr key={p.profileId}><td>{p.profileId}</td><td>{p.category}</td><td>{c?.projectId||"—"}</td><td>{c?.lastTool||"—"}</td><td>{c?.updatedAt||"—"}</td></tr>;})}</tbody>
      </table></div>
      <div className={styles.tools}>
        <button disabled={profilePage<=1} onClick={()=>setProfilePage(p=>p-1)}>Previous</button>
        <span>Page {profilePage} / {Math.max(1,Math.ceil(profiles.filter(p=>{const c=checkpoints.find(s=>s.profileId===p.profileId||s.profileId==="account:"+p.profileId||s.profileId==="context:"+p.profileId);return [p.profileId,p.category,c?.projectId,c?.taskId,c?.sessionId].some(v=>String(v||"").toLowerCase().includes(profileSearch.toLowerCase()));}).length/25))}</span>
        <button disabled={profilePage*25>=profiles.filter(p=>{const c=checkpoints.find(s=>s.profileId===p.profileId||s.profileId==="account:"+p.profileId||s.profileId==="context:"+p.profileId);return [p.profileId,p.category,c?.projectId,c?.taskId,c?.sessionId].some(v=>String(v||"").toLowerCase().includes(profileSearch.toLowerCase()));}).length} onClick={()=>setProfilePage(p=>p+1)}>Next</button>
      </div>
      <small>Checkpoints do not establish whether a profile is currently locked, a browser is active or login remains valid. Do not start a second writer for an existing profile.</small>
    </section>}
    {tab==="workflows"&&<section className={styles.panel}>
      <div className={styles.heading}><div><strong>Capture workflow</strong><p>Visits 1–10 URLs in a fresh isolated browser and saves a full-page screenshot for each. Pausing takes effect between URLs.</p></div></div>
      <textarea aria-label="Workflow URLs" value={jobUrls} onChange={e=>setJobUrls(e.target.value)} rows={4} placeholder="One https:// URL per line"/>
      <div className={styles.tools}><button disabled={busy} onClick={()=>void run(()=>request("/workflows","POST",{urls:jobUrls.split("\n").map(x=>x.trim()).filter(Boolean)}),"Capture workflow started")}>Start capture workflow</button></div>
      {jobs.map(j=><article key={j.id} className={styles.session}>
        <div className={styles.heading}><div><strong>{j.id}</strong><small>{j.status} · {j.completed.length}/{j.urls.length} captured</small></div>
          <div className={styles.tools}>{j.status==="RUNNING"&&<button onClick={()=>void run(()=>request("/workflows/action","POST",{id:j.id,action:"pause"}),"Pause requested; applies at next checkpoint")}>Pause</button>}
          {["PAUSED","INTERRUPTED"].includes(j.status)&&<button onClick={()=>void run(()=>request("/workflows/action","POST",{id:j.id,action:"resume"}),"Resume requested")}>{j.status==="INTERRUPTED"?"Recover run":"Resume"}</button>}
          {["QUEUED","RUNNING","PAUSED","PAUSE_REQUESTED"].includes(j.status)&&<button onClick={()=>void run(()=>request("/workflows/action","POST",{id:j.id,action:"stop"}),"Stop requested; waits for safe checkpoint")}>Stop</button>}</div></div>
        {j.error&&<p role="alert" className={styles.error}>{j.error}</p>}
        {j.completed.map(c=><div className={styles.tabRow} key={c.screenshot}><span>{c.url}</span><button onClick={()=>setTab("artifacts")}>{c.screenshot} →</button></div>)}
      </article>)}
      <p className={styles.hint}>Capture-job checkpoints persist across service restarts. An interrupted run remains INTERRUPTED until explicitly recovered. Pause/stop only take effect at safe boundaries between URLs.</p>
      <div className={styles.session}>
        <div className={styles.heading}><div><strong>Gateway-owned runs (read-only)</strong><p>Existing MCP tasks are observed, not controlled, by this console. Gateway does not yet expose authenticated pause/stop for its active DAG/crawlers.</p></div>
          {onOpenGatewayWorkflow&&<button onClick={onOpenGatewayWorkflow}>Open Gateway Workflow Studio →</button>}
        </div>
        {gatewayRuns.filter(x=>Boolean(x.runId)).slice(0,20).map(x=><div key={x.project+":"+x.runId} className={styles.tabRow}><span><strong>{x.project}</strong> · {x.taskId||x.runId} · {x.status} · {x.runtimeSource||"unverified"}</span><small>Owner-controlled actions: BLOCKED without receiver lease &amp; authenticated operator API</small></div>)}
        {!gatewayRuns.some(x=>x.runId)&&<p className={styles.empty}>No Gateway runs with recorded run IDs in the current project snapshot.</p>}
      </div>
    </section>}
    {tab==="cleanup"&&<PlaywrightCleanupPanel api={request}/>}
    {tab==="artifacts"&&<div className={styles.grid}>
      <section className={styles.panel}><div className={styles.heading}><strong>Screenshots ({shots.length})</strong><button onClick={()=>void update()}>Refresh</button></div>
        <div className={styles.shots}>{shots.map(a=><button type="button" key={a.name} onClick={()=>void downloadShot(a.name)} title="Download full resolution screenshot">
          {/* Explicit CORS mode sends the approved local Origin to the loopback API. */}
          <img crossOrigin="anonymous" src={API+"/screenshot?name="+encode(a.name)} alt={"Screenshot "+a.name}/><span>{a.name}</span><small>{new Date(a.at).toLocaleString()}</small>
        </button>)}</div>
        {!shots.length&&<p className={styles.empty}>No console screenshots yet.</p>}
        <div className={styles.heading} style={{marginTop:20}}><strong>Playwright trace archives ({traces.length})</strong></div>
        <div className={styles.traces}>{traces.map(t=><button key={t.name} onClick={()=>void downloadTrace(t.name)} title="Download trace ZIP">{t.name} · {Math.round(t.bytes/1024)} KB ↓</button>)}</div>
        <small>Open downloaded archives using Playwright Trace Viewer. Traces are saved when a console-owned browser closes.</small>
      </section>
      <section className={styles.panel}><div className={styles.heading}><strong>Operation logs</strong><button onClick={()=>void update()}>Refresh</button></div>
        <div className={styles.logs}>{logs.map((l,i)=><div key={l.at+i}><time>{new Date(l.at).toLocaleString()}</time><strong>{l.kind}</strong><span>{l.message}</span></div>)}</div>
        {!logs.length&&<p className={styles.empty}>No operation logs yet.</p>}
      </section>
    </div>}
  </section>;
}
