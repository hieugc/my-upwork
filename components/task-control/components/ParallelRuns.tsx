"use client";

import { useMemo, useState } from "react";
import styles from "../styles/parallel-runs.module.css";
import {isVerifiedActiveRun,summarizeExecutionEvidence} from "./runtimeEvidence";

type Request = {id:string;tool:string;server:string;project:string;status:string;queuedAt:string;startedAt?:string|null;durationMs:number};
type Step = {status:string;attempts:number;error?:string|null;startedAt?:string|null;completedAt?:string|null};
type Project = {project:string;task:string;taskId?:string|null;currentStep:string;status:string;runner?:string|null;heartbeatAt?:string|null;runtimeSource?:string;runId?:string|null;dagSteps?:Record<string,Step>|null;tasks?:{id?:string|null;title?:string|null;status:string}[]};
type Props = {requests:Request[];projects:Project[];now:number;online:boolean;paused:boolean;onProject:(project:Project)=>void;onWorkflow:()=>void};
type CodingLease = {project:string;taskId:string;leaseId:string;runId:string;gatewayOwner:string;fencingEpoch:number;expiresAt:string;updatedAt:string};

function elapsed(start:string|null|undefined,now:number){
  if(!start||!now) return "—";
  const secs=Math.max(0,Math.floor((now-new Date(start).getTime())/1000));
  return secs>=3600?`${Math.floor(secs/3600)}h ${Math.floor(secs%3600/60)}m`:`${Math.floor(secs/60)}m ${secs%60}s`;
}
export default function ParallelRuns({requests,projects,now,online,paused,onProject,onWorkflow}:Props){
  const [search,setSearch]=useState("");
  const [filter,setFilter]=useState("all");
  const [selected,setSelected]=useState<string|null>(null);
  const [showAllEvidence,setShowAllEvidence]=useState(false);
  const [leaseBearer,setLeaseBearer]=useState("");
  const [leaseRows,setLeaseRows]=useState<CodingLease[]|null>(null);
  const [leaseCheckedAt,setLeaseCheckedAt]=useState("");
  const [leaseLoading,setLeaseLoading]=useState(false);
  const [leaseError,setLeaseError]=useState("");
  async function inspectLeases(){
    if(!leaseBearer.trim()||leaseLoading)return;
    setLeaseLoading(true);setLeaseError("");setLeaseRows(null);
    try{
      const response=await fetch("/mcp-admin/task-leases",{cache:"no-store",
        headers:{Authorization:"Bearer "+leaseBearer.trim()}});
      if(!response.ok)throw new Error("Lease inspection HTTP "+response.status+
        " — auth or PostgreSQL schema may be unavailable.");
      const data:unknown=await response.json();
      if(!Array.isArray(data))throw new Error("Lease registry returned an invalid response.");
      const entries=data as CodingLease[];
      if(entries.some(x=>!x.project||!x.taskId||!x.leaseId||!Number.isFinite(x.fencingEpoch)))
        throw new Error("Lease registry contains an unverifiable row.");
      setLeaseRows(entries);setLeaseCheckedAt(new Date().toISOString());
    }catch(e){setLeaseError(String(e));}finally{setLeaseLoading(false);}
  }
  const inFlight=useMemo(()=>requests.filter(r=>["RUNNING","QUEUED"].includes(r.status.toUpperCase())),[requests]);
  const verified=useMemo(()=>projects.filter(p=>isVerifiedActiveRun(p,now)),[projects,now]);
  const evidence=useMemo(()=>summarizeExecutionEvidence(projects,now),[projects,now]);
  const evidenceRows=evidence.rows.filter(p=>(p.declaredActive.length>0||p.hasFreshRun)&&
    (search.trim()===""||[p.project,...p.declaredActive.map(t=>t.id||""),...p.declaredActive.map(t=>t.title||"")]
      .some(v=>v.toLowerCase().includes(search.toLowerCase()))));
  const shownEvidence=showAllEvidence?evidenceRows:evidenceRows.slice(0,10);
  const servers=useMemo(()=>[...new Set(inFlight.map(r=>r.server||"Unassigned"))].sort(),[inFlight]);
  const shown=inFlight.filter(r=>(filter==="all"||(r.server||"Unassigned")===filter)&&[r.project,r.tool,r.server,r.id].some(v=>String(v||"").toLowerCase().includes(search.toLowerCase())));
  const chosen=shown.find(r=>r.id===selected);
  const running=inFlight.filter(r=>r.status.toUpperCase()==="RUNNING");
  const queued=inFlight.filter(r=>r.status.toUpperCase()==="QUEUED");
  const perServer=servers.map(server=>({server,running:running.filter(r=>(r.server||"Unassigned")===server).length,queued:queued.filter(r=>(r.server||"Unassigned")===server).length}));
  return <section className={styles.root}>
    <header className={styles.intro}><div><span className={styles.eyebrow}>GATEWAY / CONCURRENT EXECUTIONS</span><h2>Parallel Runs Monitor</h2><p>Quan sát các MCP request đồng thời và DAG workflow được xác minh. Mỗi request được hiển thị riêng; không suy luận thread hoặc worker từ số task.</p></div><span className={styles.live}>{paused?"LIVE PAUSED":online?"AUTO REFRESH · 2.5S":"GATEWAY OFFLINE"}</span></header>
    <div className={styles.metrics}>
      <div><span>RUNNING REQUESTS</span><strong>{running.length}</strong><small>Gateway queue</small></div>
      <div><span>QUEUED REQUESTS</span><strong>{queued.length}</strong><small>Awaiting execution</small></div>
      <div><span>ACTIVE VERIFIED RUNS</span><strong>{verified.length}</strong><small>Fresh event-backed heartbeat</small></div>
      <div><span>ACTIVE MCP SERVERS</span><strong>{new Set(running.map(r=>r.server||"Unassigned")).size}</strong><small>Servers with running requests</small></div>
    </div>
    <div className={styles.grid}>
      <section className={styles.panel}>
        <div className={styles.sectionHeading}><div><span>01 / IN-FLIGHT REQUESTS</span><h3>Worker activity</h3></div><span>{shown.length} requests</span></div>
        <div className={styles.filters}><input aria-label="Find execution" placeholder="Search tool, project, request ID…" value={search} onChange={e=>setSearch(e.target.value)}/><select aria-label="Filter server" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All MCP servers</option>{servers.map(s=><option value={s} key={s}>{s}</option>)}</select></div>
        <div className={styles.requestList}>{shown.map(r=><button key={r.id} className={`${styles.request} ${selected===r.id?styles.selected:""}`} onClick={()=>setSelected(v=>v===r.id?null:r.id)} aria-expanded={selected===r.id}>
          <div className={styles.requestTop}><strong title={r.tool}>{r.tool}</strong><span className={r.status.toUpperCase()==="RUNNING"?styles.running:styles.queued}>{r.status.toUpperCase()}</span></div>
          <div className={styles.requestMeta}><span>{r.project||"Project unknown"}</span><span>{r.server||"Server unknown"}</span><span>{r.status.toUpperCase()==="RUNNING"?elapsed(r.startedAt,now):"Waiting "+elapsed(r.queuedAt,now)}</span></div>
          {selected===r.id&&<div className={styles.requestDetail}><span>Request ID: {r.id}</span><span>Queued: {r.queuedAt||"—"}</span><span>Started: {r.startedAt||"—"}</span><span>Host: not provided by current queue API</span></div>}
        </button>)}
        {!shown.length&&<div className={styles.empty}>{!online?"Gateway unavailable — cannot confirm running requests.":inFlight.length?"No requests match the filters.":"No in-flight MCP requests reported by the Gateway."}</div>}</div>
        {chosen&&<p className={styles.note}>Selected request: {chosen.id}. Pause, cancel and retry are not exposed by this queue API.</p>}
      </section>
      <div className={styles.rail}>
        <section className={styles.panel}><div className={styles.sectionHeading}><div><span>02 / CONCURRENCY BY SERVER</span><h3>Execution lanes</h3></div></div>
          {perServer.map(s=><div className={styles.lane} key={s.server}><div><strong>{s.server}</strong><small>{s.running} running · {s.queued} queued</small></div><div className={styles.laneBar}>{Array.from({length:s.running},(_,i)=><i key={i} className={styles.busyLane}/>)}{Array.from({length:s.queued},(_,i)=><i key={i} className={styles.waitLane}/>)}</div></div>)}
          {!perServer.length&&<div className={styles.empty}>No active server lanes to display.</div>}
          <p className={styles.note}>Một ô biểu thị một MCP request, không phải OS thread. Host/worker ID cần được Gateway cung cấp để phân nhóm theo máy.</p>
        </section>
        <section className={styles.panel}><div className={styles.sectionHeading}><div><span>03 / VERIFIED DAG RUNS</span><h3>Workflow steps</h3></div><button onClick={onWorkflow}>Open Studio →</button></div>
          {verified.map(p=><div key={p.project+":"+p.runId} className={styles.workflow}><button onClick={()=>onProject(p)}><strong>{p.project}</strong><small>{p.runId} · {p.runner||"Runner unknown"}</small></button><span className={styles.running}>{p.status}</span><p>{p.currentStep||p.task||"Step not reported"}</p>{p.dagSteps&&<div className={styles.stepList}>{Object.entries(p.dagSteps).map(([id,step])=><div key={id}><span>{id}</span><span>{step.status} · attempt {step.attempts}</span></div>)}</div>}</div>)}
          {!verified.length&&<div className={styles.empty}>No active workflow run with a fresh, verified execution heartbeat.</div>}
          <p className={styles.note}>Workflow Studio supports DAG dependencies and bounded maxParallel execution. True worker occupancy and thread-level telemetry are not available in this view.</p>
        </section>
      </div>
    </div>
    <section className={styles.evidencePanel} aria-label="Execution admission evidence">
      <div className={styles.evidenceHeading}>
        <div><span className={styles.eyebrow}>04 / SOURCE, RUN &amp; LEASE EVIDENCE</span><h3>Task admission visibility</h3>
          <p>Tracker assignments are not live workers. Even a fresh DAG run does not prove a task lease or file lock. This panel is read-only and never grants write access.</p></div>
      </div>
      <div className={styles.evidenceStats}>
        <div><span>IN_PROGRESS declarations</span><strong>{evidence.reportedActiveTasks}</strong><small>Across project views; duplicates possible</small></div>
        <div><span>Fresh DAG runs</span><strong>{evidence.verifiedRunCount}</strong><small>Event-backed, not a lease receipt</small></div>
        <div><span>Verified task leases</span><strong>{leaseRows===null?"—":leaseRows.length}</strong><small>{leaseRows===null?"Operator check required":`DB snapshot ${new Date(leaseCheckedAt).toLocaleTimeString("vi-VN")}`}</small></div>
        <div><span>Repeated task IDs</span><strong>{evidence.duplicates.length}</strong><small>Found in multiple project/worktree views</small></div>
      </div>
      <div className={styles.evidenceScroll}>
        <table className={styles.evidenceTable}>
          <thead><tr><th>Project / source</th><th>Tracker claims</th><th>Execution proof</th><th>Task lease</th></tr></thead>
          <tbody>
            {shownEvidence.map(row=><tr key={row.project}>
              <td><button className={styles.evidenceProject} onClick={()=>{const original=projects.find(p=>p.project===row.project);if(original)onProject(original);}}>{row.project}</button>
                <small>{row.source==="execution_events"?"Execution event projection":"Tracker / unverified source"}</small></td>
              <td><strong>{row.declaredActive.length} marked IN_PROGRESS</strong>
                <small title={row.declaredActive.map(t=>t.id||t.title||"unnamed").join(", ")}>{row.declaredActive.slice(0,3).map(t=>t.id||t.title||"unnamed").join(" · ")}{row.declaredActive.length>3?" …":""}</small></td>
              <td>{row.hasFreshRun?<><span className={styles.evidenceFresh}>Fresh DAG run</span><small>{row.liveRunId} · {row.runner||"Runner unavailable"}</small></>:
                <><span className={styles.evidenceNotRun}>No fresh verified run</span><small>Cannot infer execution from tracker or old SHA</small></>}</td>
              <td>{leaseRows?.some(l=>l.project===row.project&&row.taskIds.includes(l.taskId))?
                <><span className={styles.evidenceFresh}>DB lease snapshot</span>
                  {leaseRows.filter(l=>l.project===row.project&&row.taskIds.includes(l.taskId)).slice(0,3)
                    .map(l=><small key={l.leaseId}>{l.taskId}: {l.leaseId.slice(0,8)}… · epoch {l.fencingEpoch} · expiry {new Date(l.expiresAt).toLocaleTimeString("vi-VN")}</small>)}
                </>:<><span className={styles.evidenceNotRun}>NOT VERIFIED</span>
                  <small>{leaseRows===null?"Operator must inspect authenticated lease registry":"No active lease in last DB snapshot"}</small></>}</td>
            </tr>)}
            {shownEvidence.length===0&&<tr><td colSpan={4} className={styles.evidenceEmpty}>No active tracker claims or verified runs match the current filter.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className={styles.evidenceLeaseInspection}>
        <label>Operator Gateway token (session-only)
          <input type="password" value={leaseBearer} autoComplete="off"
            onChange={e=>{setLeaseBearer(e.target.value);setLeaseRows(null);}}
            placeholder="EXECUTION_EVENT_API_KEY"/>
        </label>
        <button type="button" disabled={!leaseBearer.trim()||leaseLoading}
          onClick={()=>void inspectLeases()}>{leaseLoading?"Checking…":"Inspect active task leases"}</button>
        {leaseError&&<p role="alert">{leaseError}</p>}
        {leaseRows!==null&&<small role="status">{leaseRows.length} active DB leases observed at {leaseCheckedAt}. This is not receiver-side fencing or human acceptance.</small>}
      </div>
      {evidenceRows.length>10&&<button className={styles.evidenceMore} onClick={()=>setShowAllEvidence(v=>!v)}>{showAllEvidence?"Show fewer":`Show all ${evidenceRows.length} project views`}</button>}
      {evidence.duplicates.length>0&&<details className={styles.evidenceDuplicates}>
        <summary>Task IDs repeated across project/worktree views · {evidence.duplicates.length}</summary>
        <p>These are repeated source references, not confirmed duplicate workers. Reconcile branch/SHA before dispatch.</p>
        {evidence.duplicates.slice(0,12).map(item=><div key={item.taskId}><strong>{item.taskId}</strong><span>{item.projects.length} project views · {item.projects.slice(0,5).join(", ")}{item.projects.length>5?" …":""}</span></div>)}
      </details>}
      <p className={styles.note}>Writer admission requires a verified source SHA, task-scoped lease, dependency check and resource lock from the Gateway. Current project snapshot does not expose a durable lease receipt; no writer is marked admitted here.</p>
    </section>
  </section>;
}
