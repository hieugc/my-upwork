"use client";

import Link from "next/link";
import WorkflowStudio from "./WorkflowStudio";
import SkillUsagePanel from "./SkillUsagePanel";
import ParallelRuns from "./ParallelRuns";
import GithubIssuesPanel from "./GithubIssuesPanel";
import ChatGptQueuePanel from "./ChatGptQueuePanel";
import PlaywrightOpsConsole from "./PlaywrightOpsConsole";
import { useCallback, useEffect, useMemo, useState } from "react";
type TaskDetailTab = "overview" | "document" | "visual" | "evidence";
import styles from "../styles/task-control.module.css";

const API = "/mcp-admin";

type ExecutionLog = {
  sequenceId:number; runId:string; eventId:string; project:string; task:string;
  agent:string; kind:string; occurredAt:string; receivedAt:string;
  step?:string|null; checkpoint?:string|null;
};
type CoverageItem = {project:string; eventCount:number; runCount:number; logStatus:string; lastEventAt?:string|null};
type GatewayServer = {name:string; connected:boolean; enabled:boolean; project:string; description:string; required:boolean; tools:number};
type GatewayStatus = {status:string; gateway:{endpoint:string;protocolVersion:string;totalTools:number;connectedServers:number;enabledServers:number};servers:GatewayServer[];timestamp:string};
type ChatGptQueueSummary = {jobs:{status:string;project:string;taskId:string}[];mappings:{project:string}[]};
type RequestItem = {
  id:string; tool:string; server:string; project:string; status:string;
  queuedAt:string; startedAt?:string|null; finishedAt?:string|null; durationMs:number; error?:string|null;
};

type TaskVisual = {
  version?:number; title?:string|null; type?:string|null; input:string; pipeline:string; output:string;
  sections?:string[]; details?:string[]; infra?:string[]; artifacts?:string[]; style?:string|null;
};
type TaskDocument = { path:string; status:string; content?:string|null };
type ProjectTaskItem = { id?:string|null; title:string; status:string; acceptanceStatus?:string|null; visual?:TaskVisual|null; visualStatus?:string; document?:TaskDocument|null };

type DagStepInfo = {status:string; attempts:number; error?:string|null; startedAt?:string|null; completedAt?:string|null};
type ProjectItem = {
  project:string; taskId?:string|null; task:string; currentStep:string; status:string;
  runner?:string|null; blocker?:string|null; heartbeatAt?:string|null; heartbeatAgeSeconds?:number|null;
  trackerUpdatedAt?:string|null; hasTracker:boolean; hasRuntime:boolean; runtimeSource?:string; runId?:string|null; eventCount?:number|null; dagSteps?:Record<string,DagStepInfo>|null; tasks?:ProjectTaskItem[];
};

function qaAcceptance(project:ProjectItem){
  const gates=(project.tasks||[]).filter(t=>/^MCP-(?:QA-|QUALITY-)/.test(t.id||""));
  if(gates.length===0) return "Not tracked";
  // Written DONE/PASS is not independent acceptance. Require the Gateway's verified projection.
  const accepted=gates.filter(t=>t.acceptanceStatus==="ACCEPTED").length;
  return accepted===gates.length?"ACCEPTED":`${accepted}/${gates.length} accepted · PENDING`;
}

function age(value:string|null|undefined, now:number){
  if(!value) return "—";
  const sec=Math.max(0,Math.round((now-new Date(value).getTime())/1000));
  if(sec<60) return sec+"s ago";
  if(sec<3600) return Math.floor(sec/60)+"m ago";
  return Math.floor(sec/3600)+"h ago";
}

function statusClass(status:string){
  if(["RUNNING","IN_PROGRESS"].includes(status)) return styles.running;
  if(["DONE","COMPLETED"].includes(status)) return styles.done;
  if(["BLOCKED","FAILED","STALE"].includes(status)) return styles.blocked;
  if(["UNVERIFIED","IMPLEMENTED_UNVERIFIED","TODO","QUEUED"].includes(status)) return styles.pending;
  return styles.idle;
}

type PlaywrightProfile = {profileId:string;category:string};
type PlaywrightSession = {profileId:string;projectId?:string|null;taskId?:string|null;sessionId?:string|null;lastTool:string;updatedAt:string;recoveryMode:string};
type PlaywrightInventory = {profiles:PlaywrightProfile[];sessions:PlaywrightSession[]};
type ViewKey = "dashboard" | "tasks" | "projects" | "activity" | "mcp" | "workflows" | "parallel" | "playwright" | "playwrightops" | "github" | "chatgptqueue";

const viewTitles: Record<ViewKey,string> = {
  dashboard:"Execution Queue",
  parallel:"Parallel Runs",
  tasks:"Tasks",
  projects:"Projects",
  activity:"Activity",
  mcp:"MCP Tools",
  workflows:"Workflows",
  playwright:"Playwright Profiles",
  playwrightops:"Playwright Operations",
  github:"GitHub Issues",
  chatgptqueue:"ChatGPT Queue",
};

function clip(value:string|undefined|null,max=72){
  const text=String(value||"").trim();
  return text.length>max?text.slice(0,max-1)+"…":text;
}

function TaskVisualDiagram({task,project}:{task:ProjectTaskItem;project:string}){
  const visual=task.visual;
  if(!visual) return <div className={styles.noVisualImage}><strong>NO_VISUAL_SPEC</strong><span>This task has no TASK VISUAL metadata yet.</span></div>;
  const stages=visual.pipeline.split("→").map(x=>x.trim()).filter(Boolean).slice(0,6);
  const columns=Math.max(stages.length,3);
  const boxWidth=170;
  const gap=24;
  const width=columns*boxWidth+(columns-1)*gap+40;
  const height=visual.version&&visual.version>=2?470:300;
  const sections=(visual.sections||[]).slice(0,5);
  const infra=(visual.infra||[]).slice(0,5);
  const title=visual.title||`${project} — ${task.id||task.title}`;
  return <svg className={styles.generatedDiagram} role="img" aria-label={`${title} task infographic`} viewBox={`0 0 ${width} ${height}`}>
    <rect x="0" y="0" width={width} height={height} rx="18" fill="#ffffff"/>
    <text x="20" y="34" fontSize="18" fontWeight="700" fill="#111827">{clip(title,96)}</text>
    <text x="20" y="55" fontSize="10" fill="#64748b">{clip(`${task.status} · ${task.visualStatus||"VISUAL"} · ${visual.type||"legacy-flow"}`,110)}</text>
    {stages.map((stage,i)=>{
      const x=20+i*(boxWidth+gap);
      const fill=["#eff6ff","#ecfdf5","#faf5ff","#fff7ed","#fef2f2","#f0f9ff"][i%6];
      const stroke=["#60a5fa","#4ade80","#a78bfa","#fb923c","#f87171","#38bdf8"][i%6];
      return <g key={`${stage}-${i}`}>
        <rect x={x} y="82" width={boxWidth} height="88" rx="10" fill={fill} stroke={stroke}/>
        <text x={x+12} y="104" fontSize="10" fontWeight="700" fill="#334155">{`${i+1}. ${clip(stage,24)}`}</text>
        <text x={x+12} y="126" fontSize="9" fill="#475569">{i===0?clip(visual.input,28):i===stages.length-1?clip(visual.output,28):"processing stage"}</text>
        {i<stages.length-1&&<><line x1={x+boxWidth} y1="126" x2={x+boxWidth+gap-6} y2="126" stroke="#64748b" strokeWidth="1.5"/><polygon points={`${x+boxWidth+gap-6},122 ${x+boxWidth+gap},126 ${x+boxWidth+gap-6},130`} fill="#64748b"/></>}
      </g>;
    })}
    {visual.version&&visual.version>=2&&<>
      <text x="20" y="205" fontSize="11" fontWeight="700" fill="#334155">DETAIL / LAYERS</text>
      {(sections.length?sections:[`Input | ${visual.input}`,`Output | ${visual.output}`]).map((item,i)=>{
        const itemWidth=(width-40-Math.max(0,sections.length-1)*10)/Math.max(sections.length,1);
        const x=20+i*(itemWidth+10);
        const [name,...rest]=item.split("|");
        return <g key={`${item}-${i}`}>
          <rect x={x} y="220" width={itemWidth} height="86" rx="9" fill="#f8fafc" stroke="#cbd5e1"/>
          <text x={x+10} y="241" fontSize="9" fontWeight="700" fill="#334155">{clip(name,24)}</text>
          <text x={x+10} y="261" fontSize="8" fill="#64748b">{clip(rest.join("|").trim(),34)}</text>
        </g>;
      })}
      <text x="20" y="344" fontSize="11" fontWeight="700" fill="#334155">INFRASTRUCTURE / EVIDENCE</text>
      {(infra.length?infra:[...(visual.details||[]),...(visual.artifacts||[])]).slice(0,5).map((item,i)=>{
        const count=Math.max((infra.length?infra:[...(visual.details||[]),...(visual.artifacts||[])]).slice(0,5).length,1);
        const itemWidth=(width-40-(count-1)*10)/count;
        const x=20+i*(itemWidth+10);
        const [name,...rest]=item.split("|");
        return <g key={`${item}-${i}`}>
          <rect x={x} y="358" width={itemWidth} height="72" rx="9" fill="#f1f5f9" stroke="#94a3b8"/>
          <text x={x+9} y="379" fontSize="8.5" fontWeight="700" fill="#334155">{clip(name,22)}</text>
          <text x={x+9} y="398" fontSize="7.5" fill="#64748b">{clip(rest.join("|").trim(),32)}</text>
        </g>;
      })}
    </>}
  </svg>;
}

function ProjectOverviewDiagram({project}:{project:ProjectItem}){
  const tasks=project.tasks||[];
  const done=tasks.filter(t=>t.status==="DONE").length;
  const active=tasks.filter(t=>["IN_PROGRESS","RUNNING"].includes(t.status)).length;
  const blocked=tasks.filter(t=>["BLOCKED","STALE"].includes(t.status)).length;
  const visuals=tasks.filter(t=>t.visual).length;
  return <svg className={styles.projectOverviewImage} role="img" aria-label={`${project.project} project overview`} viewBox="0 0 760 250">
    <rect width="760" height="250" rx="18" fill="#ffffff"/>
    <text x="26" y="38" fontSize="20" fontWeight="700" fill="#0f172a">{clip(project.project,42)}</text>
    <text x="26" y="58" fontSize="10" fill="#64748b">Project task overview · generated from live tracker data</text>
    {[{label:"Tasks",value:tasks.length,x:26},{label:"Done",value:done,x:168},{label:"Active",value:active,x:310},{label:"Blocked",value:blocked,x:452},{label:"With visual",value:visuals,x:594}].map(card=><g key={card.label}>
      <rect x={card.x} y="82" width="118" height="66" rx="10" fill="#f8fafc" stroke="#cbd5e1"/>
      <text x={card.x+12} y="105" fontSize="9" fill="#64748b">{card.label}</text>
      <text x={card.x+12} y="132" fontSize="22" fontWeight="700" fill="#0f172a">{card.value}</text>
    </g>)}
    <text x="26" y="183" fontSize="10" fontWeight="700" fill="#334155">CURRENT TASK</text>
    <rect x="26" y="194" width="686" height="36" rx="8" fill="#eff6ff" stroke="#93c5fd"/>
    <text x="38" y="217" fontSize="10" fill="#1e3a8a">{clip(project.task||"No active task",105)}</text>
  </svg>;
}

function Pagination({total,page,onChange,pageSize=12}:{total:number;page:number;onChange:(page:number)=>void;pageSize?:number}) {
 const max=Math.max(1,Math.ceil(total/pageSize)),current=Math.min(page,max);
 return <div className={styles.pagination}><span>{total? `${(current-1)*pageSize+1}–${Math.min(total,current*pageSize)} of ${total}`:"0 items"}</span><div><button disabled={current<=1} onClick={()=>onChange(current-1)}>Previous</button><span>Page {current} / {max}</span><button disabled={current>=max} onClick={()=>onChange(current+1)}>Next</button></div></div>;
}
function paginate<T>(items:T[],page:number,size:number){const current=Math.min(page,Math.max(1,Math.ceil(items.length/size)));return items.slice((current-1)*size,current*size);}
export default function TaskControlCenter(){
  const [view,setView]=useState<ViewKey>("dashboard");
  const [pages,setPages]=useState<Record<string,number>>({});
  const getPage=(key:string)=>pages[key]||1;
  const changePage=(key:string)=>(n:number)=>setPages(prev=>({...prev,[key]:n}));
  const [query,setQuery]=useState("");
  const [showSearch,setShowSearch]=useState(false);
  const [queue,setQueue]=useState<{queued:number;running:number;total:number;items:RequestItem[]}>({queued:0,running:0,total:0,items:[]});
  const [recent,setRecent]=useState<RequestItem[]>([]);
  const [gatewayStatus,setGatewayStatus]=useState<GatewayStatus|null>(null);
  const [chatGptQueue,setChatGptQueue]=useState<ChatGptQueueSummary|null>(null);
  const [playwrightInventory,setPlaywrightInventory]=useState<PlaywrightInventory>({profiles:[],sessions:[]});
  const [playwrightError,setPlaywrightError]=useState("");
  const [profileFilter,setProfileFilter]=useState("");
  const [taskLogs,setTaskLogs]=useState<ExecutionLog[]>([]);
  const [coverage,setCoverage]=useState<CoverageItem[]>([]);
  const [logProject,setLogProject]=useState("all");
  const [projects,setProjects]=useState<ProjectItem[]>([]);
  const [online,setOnline]=useState(false);
  const [paused,setPaused]=useState(false);
  const [error,setError]=useState("");
  const [now,setNow]=useState(0);
  const [selectedProjectName,setSelectedProjectName]=useState<string|null>(null);
  const [selectedTaskIndex,setSelectedTaskIndex]=useState(0);
  const [selectedTaskTab,setSelectedTaskTab]=useState<TaskDetailTab>("overview");

  const fetchJson=useCallback(async function fetchJson<T>(path:string):Promise<T>{
    const response=await fetch(API+path,{cache:"no-store"});
    if(!response.ok){
      throw new Error(`${path}: HTTP ${response.status}`);
    }
    return response.json() as Promise<T>;
  },[]);

  const load=useCallback(async function load(){
    const results=await Promise.allSettled([
      fetchJson<{queued:number;running:number;total:number;items:RequestItem[]}>("/queue"),
      fetchJson<{recent:RequestItem[]}>("/requests?limit=80"),
      fetchJson<{items:ProjectItem[]}>("/projects"),
      fetchJson<{items:ExecutionLog[]}>("/task-logs?limit=100"),
      fetchJson<{items:CoverageItem[]}>("/task-coverage"),
      fetchJson<GatewayStatus>("/status"),
      view==="dashboard"?fetchJson<ChatGptQueueSummary>("/chatgpt-queue"):Promise.resolve(null)
    ]);

    const failures:string[]=[];
    const [queueResult,requestResult,projectResult,logResult,coverageResult,statusResult,chatGptResult]=results;

    if(queueResult.status==="fulfilled") setQueue(queueResult.value);
    else failures.push("queue: "+String(queueResult.reason));

    if(requestResult.status==="fulfilled") setRecent(requestResult.value.recent||[]);
    else failures.push("requests: "+String(requestResult.reason));

    if(projectResult.status==="fulfilled") setProjects(projectResult.value.items||[]);
    else {setProjects([]);failures.push("projects: "+String(projectResult.reason));}

    if(logResult.status==="fulfilled") setTaskLogs(logResult.value.items||[]);
    else failures.push("execution logs: "+String(logResult.reason));

    if(coverageResult.status==="fulfilled") setCoverage(coverageResult.value.items||[]);
    else failures.push("coverage: "+String(coverageResult.reason));

    if(statusResult.status==="fulfilled") setGatewayStatus(statusResult.value);
    else {setGatewayStatus(null);failures.push("gateway status: "+String(statusResult.reason));}
    if(view==="dashboard") {
      if(chatGptResult.status==="fulfilled") setChatGptQueue(chatGptResult.value);
      else {setChatGptQueue(null);failures.push("ChatGPT queue: "+String(chatGptResult.reason));}
    }

    // A successful data endpoint does not prove that the Gateway itself is healthy.
    // Only its explicit readiness response may label this connection "online".
    const gatewayReady=statusResult.status==="fulfilled"&&statusResult.value.status==="ready";
    setOnline(gatewayReady);
    if(statusResult.status==="fulfilled"&&!gatewayReady)
      failures.push("gateway reported "+statusResult.value.status);
    setNow(Date.now());
    setError(failures.join(" · "));
    if (view==="playwright") {
      try {
        const response=await fetch(API+"/playwright/profiles",{cache:"no-store"});
        const raw=await response.text();
        if (!raw.trim()) throw new Error(`Gateway returned an empty response (HTTP ${response.status}); endpoint may not be active yet`);
        let data:Partial<PlaywrightInventory>&{error?:string};
        try { data=JSON.parse(raw); }
        catch { throw new Error(`Gateway returned non-JSON content (HTTP ${response.status})`); }
        if (!response.ok) throw new Error(data.error||`HTTP ${response.status}`);
        if (!Array.isArray(data.profiles)||!Array.isArray(data.sessions)) throw new Error("Unexpected profile inventory response format");
        setPlaywrightInventory({profiles:data.profiles,sessions:data.sessions});
        setPlaywrightError("");
      } catch(e) { setPlaywrightError(String(e)); }
    }
  },[fetchJson,view]);

  useEffect(()=>{
    const initial=setTimeout(()=>{ void load(); },0);
    if(paused) return ()=>clearTimeout(initial);
    const id=setInterval(()=>{ void load(); },2500);
    return ()=>{ clearTimeout(initial); clearInterval(id); };
  },[paused,load]);

  useEffect(()=>{
    if(!selectedProjectName) return;
    const onKeyDown=(event:KeyboardEvent)=>{ if(event.key==="Escape") setSelectedProjectName(null); };
    window.addEventListener("keydown",onKeyDown);
    return ()=>window.removeEventListener("keydown",onKeyDown);
  },[selectedProjectName]);

  const verifiedRuns=useMemo(()=>projects.filter(p=>p.status==="RUNNING"&&p.runtimeSource==="execution_events"&&Boolean(p.runId)&&Boolean(p.heartbeatAt)&&now>0&&now-new Date(p.heartbeatAt!).getTime()<120000),[projects,now]);
  const attentionProjects=useMemo(()=>projects.filter(p=>["BLOCKED","STALE"].includes(p.status)),[projects]);
  const queuedRequests=useMemo(()=>queue.items.filter(x=>x.status.toUpperCase()==="QUEUED").sort((a,b)=>new Date(a.queuedAt).getTime()-new Date(b.queuedAt).getTime()),[queue.items]);
  // Tracker declarations are NOT Gateway requests and IN_PROGRESS is NOT proof of a live worker.
  const plannedTasks=useMemo(()=>projects.flatMap(p=>(p.tasks||[]).filter(t=>["TODO","QUEUED","PENDING","IN_PROGRESS"].includes(t.status)).map(t=>({...t,project:p.project}))),[projects]);
  const trackerTodo=plannedTasks.filter(t=>["TODO","QUEUED","PENDING"].includes(t.status)).length;
  const trackerClaimedActive=plannedTasks.filter(t=>t.status==="IN_PROGRESS").length;
  const chatGptQueued=chatGptQueue?.jobs.filter(j=>j.status==="QUEUED").length??null;
  const chatGptInFlight=chatGptQueue?.jobs.filter(j=>["READY_TO_DISPATCH","WAITING_RESULT"].includes(j.status)).length??null;
  const activeProjects=useMemo(()=>projects.filter(p=>["RUNNING","IN_PROGRESS"].includes(p.status)),[projects]);
  const blockedProjects=useMemo(()=>projects.filter(p=>["BLOCKED","STALE"].includes(p.status)),[projects]);
  const doneProjects=useMemo(()=>projects.filter(p=>p.status==="DONE"),[projects]);
  const unverified=useMemo(()=>projects.filter(p=>p.status==="UNVERIFIED"),[projects]);
  const taskTotal=Math.max(projects.length,1);
  const completion=Math.round((doneProjects.length/taskTotal)*100);

  const normalizedQuery=query.trim().toLowerCase();
  const filteredProjects=useMemo(()=>projects.filter(p=>!normalizedQuery||[p.project,p.taskId,p.task,p.currentStep,p.status,p.runner,p.blocker,...(p.tasks||[]).flatMap(task=>[task.id,task.title,task.status])].some(v=>String(v||"").toLowerCase().includes(normalizedQuery))),[projects,normalizedQuery]);
  const taskRows=useMemo(()=>filteredProjects.flatMap(project=>{
    const tasks=project.tasks?.length?project.tasks:[{id:project.taskId,title:project.task,status:project.status}];
    return tasks.map(task=>({project:project.project,...task,updatedAt:project.heartbeatAt||project.trackerUpdatedAt,runner:project.runner}));
  }),[filteredProjects]);
  const todoItems=taskRows.filter(t=>!["DONE","CANCELLED","IDLE"].includes(t.status)).slice(0,8);
  const workload=filteredProjects.slice(0,10);
  const teamGroups=useMemo(()=>{
    const map=new Map<string,ProjectItem[]>();
    for(const project of filteredProjects){
      const key=project.runner||"Unassigned";
      map.set(key,[...(map.get(key)||[]),project]);
    }
    return [...map.entries()];
  },[filteredProjects]);
  const calendarGroups=useMemo(()=>{
    const map=new Map<string,ProjectItem[]>();
    for(const project of filteredProjects){
      const raw=project.heartbeatAt||project.trackerUpdatedAt;
      const key=raw?new Date(raw).toLocaleDateString("en-CA"):"No date";
      map.set(key,[...(map.get(key)||[]),project]);
    }
    return [...map.entries()].sort((a,b)=>b[0].localeCompare(a[0]));
  },[filteredProjects]);
  // Reset pagination in the initiating user interaction, not synchronously inside an effect.
  const changeQuery=(value:string)=>{setQuery(value);setPages({});};
  const changeLogProject=(value:string)=>{setLogProject(value);setPages({});};
  const selectedProject=useMemo(()=>projects.find(p=>p.project===selectedProjectName)||null,[projects,selectedProjectName]);
  const missingLogCount=coverage.filter(item=>item.eventCount===0).length;
  const projectLogs=taskLogs.filter(item=>logProject==="all"||item.project===logProject);
  const selectedTasks=selectedProject?.tasks||[];
  const selectedTask=selectedTasks[selectedTaskIndex]||selectedTasks[0]||null;
  const openProject=(project:ProjectItem)=>{
    setSelectedProjectName(project.project);
    const currentIndex=(project.tasks||[]).findIndex(task=>task.id&&task.id===project.taskId);
    setSelectedTaskIndex(currentIndex>=0?currentIndex:0);
    setSelectedTaskTab("overview");
  };
  const openTask=(projectName:string,taskId?:string|null,taskTitle?:string)=>{
    const project=projects.find(item=>item.project===projectName);
    if(!project) return;
    const index=(project.tasks||[]).findIndex(task=>
      (taskId&&task.id===taskId)||(!taskId&&task.title===taskTitle)
    );
    setSelectedProjectName(project.project);
    setSelectedTaskIndex(index>=0?index:0);
    setSelectedTaskTab("overview");
  };

  return <main className={styles.page}>
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <div className={styles.brandMark}>T</div>
        <div><strong>TaskFlow</strong><small>MCP control center</small></div>
      </div>

      <nav className={styles.nav}>
        <button className={view==="dashboard"?styles.active:""} onClick={()=>setView("dashboard")}><span>▤</span> Execution Queue</button>
        <button className={view==="tasks"?styles.active:""} onClick={()=>setView("tasks")}><span>▣</span> Tasks</button>
        <button className={view==="parallel"?styles.active:""} onClick={()=>setView("parallel")}><span>⋈</span> Parallel Runs</button>
        <button className={view==="projects"?styles.active:""} onClick={()=>setView("projects")}><span>◫</span> Projects</button>
        <a className={styles.localServicesLink} href="http://127.0.0.1:3070/" target="_blank" rel="noopener noreferrer"><span>◉</span> Local Services ↗</a>
        <button className={view==="activity"?styles.active:""} onClick={()=>setView("activity")}><span>◌</span> Activity</button>
        <button className={view==="mcp"?styles.active:""} onClick={()=>setView("mcp")}><span>◉</span> MCP Tools</button>
        <button className={view==="workflows"?styles.active:""} onClick={()=>setView("workflows")}><span>◇</span> Workflows</button>
        <button className={view==="playwright"?styles.active:""} onClick={()=>setView("playwright")}><span>▣</span> Playwright Profiles</button>
        <button className={view==="playwrightops"?styles.active:""} onClick={()=>setView("playwrightops")}><span>▥</span> Playwright Operations</button>
        <button className={view==="github"?styles.active:""} onClick={()=>setView("github")}><span>⑂</span> GitHub Issues</button>
        <button className={view==="chatgptqueue"?styles.active:""} onClick={()=>setView("chatgptqueue")}><span>≡</span> ChatGPT Queue</button>
      </nav>

      <section className={styles.compactProjects} aria-label="Quick project navigation">
        <div className={styles.compactProjectsHead}><span>PROJECTS</span><b>{projects.length}</b></div>
        <div className={styles.compactProjectList}>
          {[...projects].sort((a,b)=>{
            const priority=(p:ProjectItem)=>["RUNNING","BLOCKED","STALE","IN_PROGRESS"].includes(p.status)?0:1;
            return priority(a)-priority(b)||a.project.localeCompare(b.project);
          }).slice(0,6).map(project=><button key={project.project} type="button" className={styles.compactProjectItem} onClick={()=>openProject(project)} title={project.project}>
            <span className={styles.compactProjectMark}>{project.project.slice(0,2).toUpperCase()}</span>
            <span className={styles.compactProjectName}><strong>{project.project}</strong><small>{project.status}</small></span>
          </button>)}
          {!projects.length&&<p className={styles.compactProjectEmpty}>No projects available</p>}
        </div>
        {projects.length>6&&<button type="button" className={styles.allProjectsButton} onClick={()=>setView("projects")}>View all {projects.length} projects <span aria-hidden="true">→</span></button>}
      </section>

      <div className={styles.sideBottom}>
        <div className={styles.gateway}><i className={online?styles.online:styles.offline}/><span>{online?"Gateway online":"Gateway offline"}</span></div>
        <button onClick={()=>setPaused(v=>!v)}>{paused?"Resume live":"Pause live"}</button>
        <Link href="/">← Portfolio</Link>
      </div>
    </aside>

    <section className={styles.main}>
      <header className={styles.header}>
        <div>
          <p>Gateway monitoring · {now?new Date(now).toLocaleString("en-GB"): "Connecting…"}</p>
          <h1>{viewTitles[view]}</h1><p className={styles.headerHint}>Live task signals, verified execution history and project coverage</p>
        </div>
        <div className={styles.headerRight}>
          <button className={styles.iconButton} onClick={load} title="Refresh">↻</button>
          <button className={styles.iconButton} onClick={()=>setShowSearch(v=>!v)} title="Search">⌕</button>
          <div className={styles.profile}><span>H</span><div><strong>Hiếu Phạm</strong><small>Workspace admin</small></div></div>
        </div>
      </header>

      {showSearch && <div className={styles.searchBar}><span>⌕</span><input autoFocus value={query} onChange={e=>changeQuery(e.target.value)} placeholder="Search project, task, status, runner..." /><button onClick={()=>{changeQuery("");setShowSearch(false)}}>Close</button></div>}
      {error && <div className={styles.error}>{error}</div>}

      {view==="dashboard" && <>
        <section className={styles.queueSummary}>
          <div><span>RUNNING MCP REQUESTS</span><strong>{queue.running}</strong><small>Gateway-confirmed</small></div>
          <div><span>WAITING MCP REQUESTS</span><strong>{queue.queued}</strong><small>Waiting for execution</small></div>
          <div><span>VERIFIED PROJECT RUNS</span><strong>{verifiedRuns.length}</strong><small>Event-backed and fresh</small></div>
          <div><span>NEEDS ATTENTION</span><strong>{attentionProjects.length}</strong><small>Blocked / stale execution</small></div>
        </section>

        <div className={styles.dashboardCockpit}>
          <section className={styles.queueSection}>
            <div className={styles.queueTitle}><div><span>01 / LIVE EXECUTION</span><h2>Running queue</h2><p>In-flight MCP requests from the gateway. Project runs are shown separately when independently verified.</p></div><span className={styles.liveIndicator}>{paused?"UPDATES PAUSED":online?"LIVE · 2.5s":"OFFLINE"}</span></div>
            {queue.items.filter(x=>x.status.toUpperCase()==="RUNNING").map(x=><article className={styles.executionCard} key={x.id}>
              <div className={styles.executionTop}><div><span className={styles.mono}>{x.project||"Unassigned project"}</span><h3>{x.tool}</h3></div><em className={styles.running}>RUNNING</em></div>
              <div className={styles.executionMeta}><span>Server <b>{x.server||"—"}</b></span><span>Elapsed <b>{x.durationMs} ms</b></span><span>Started <b>{age(x.startedAt,now)}</b></span></div>
              <p className={styles.queueFootnote}>MCP request · {x.id}</p>
            </article>)}
            {queue.running===0&&<div className={styles.queueEmpty}>No running MCP requests reported by the gateway.</div>}
            {verifiedRuns.length>0&&<div className={styles.verifiedRuns}><h3>Verified project runs</h3>{verifiedRuns.map(p=><button key={p.project} className={styles.runRow} onClick={()=>openProject(p)}><span><strong>{p.project}</strong><small>{p.taskId||"Run"} · {p.currentStep||p.task||"Current step not reported"}</small></span><span><em className={styles.running}>RUNNING</em><small>{age(p.heartbeatAt,now)}</small></span></button>)}</div>}
          </section>

          <div className={styles.dashboardRail}>
            <section className={styles.queueSection}>
              <div className={styles.queueTitle}><div><span>02 / ATTENTION</span><h2>Blocked &amp; stale</h2></div><strong>{attentionProjects.length}</strong></div>
              {attentionProjects.length?attentionProjects.slice(0,4).map(p=><button key={p.project} className={styles.attentionRow} onClick={()=>openProject(p)}><span><strong>{p.project}</strong><small>{p.blocker||p.currentStep||"Execution needs inspection"} · last signal {age(p.heartbeatAt||p.trackerUpdatedAt,now)}</small></span><em className={styles.blocked}>{p.status}</em></button>):<div className={styles.queueEmpty}>No projects explicitly marked BLOCKED or STALE.</div>}
            </section>

            <section className={styles.queueSection}>
              <div className={styles.queueTitle}><div><span>03 / UPCOMING</span><h2>Waiting queue</h2></div><strong>{queue.queued} requests</strong></div>
              {queuedRequests.slice(0,4).map((x,i)=><div className={styles.waitingRow} key={x.id}><span className={styles.queueOrdinal}>{String(i+1).padStart(2,"0")}</span><span><strong>{x.tool}</strong><small>{x.project} · queued {age(x.queuedAt,now)}</small></span><em className={styles.pending}>QUEUED</em></div>)}
              {queuedRequests.length===0&&<div className={styles.queueEmpty}>No queued MCP requests.</div>}
              <div className={styles.queueSourceSplit}>
                <div><strong>ChatGPT Web task queue</strong><span>{chatGptQueued===null?"Unavailable":`${chatGptQueued} queued · ${chatGptInFlight} prepared/waiting`}</span></div>
                <p>{chatGptQueue?`${chatGptQueue.mappings.length} project mappings · jobs are not MCP requests and do not prove a worker is running.`:"Queue status could not be verified."}</p>
                <button type="button" onClick={()=>setView("chatgptqueue")}>View ChatGPT Queue →</button>
              </div>
              <details className={styles.plannedTasks}><summary>Tracker backlog · {plannedTasks.length} <span>({trackerTodo} pending · {trackerClaimedActive} marked IN_PROGRESS)</span></summary>
                <p className={styles.trackerDisclaimer}>These are TASKS.md declarations, including other worktrees. Marked IN_PROGRESS does not mean a Gateway worker is running. They are not automatically dispatched.</p>
                {paginate(plannedTasks,getPage("planned"),10).map((t,i)=><button key={t.project+"-"+t.id+"-"+i} onClick={()=>openTask(t.project,t.id,t.title)}><span><strong>{t.id||t.project}</strong><small>{t.project} · {t.title}</small></span><em className={statusClass(t.status)}>{t.status}</em></button>)}<Pagination total={plannedTasks.length} page={getPage("planned")} onChange={changePage("planned")} pageSize={10}/></details>
            </section>
          </div>
        </div>

        <div className={styles.dashboardLowerGrid}>
          <section className={styles.queueSection}>
            <div className={styles.queueTitle}><div><span>04 / TASK EVIDENCE</span><h2>Project log coverage</h2><p>Execution events stay separate from tracker-only tasks.</p></div><button className={styles.queueLink} onClick={()=>setView("activity")}>Task log →</button></div>
            <div className={styles.coverageStrip}><strong>{coverage.filter(p=>p.eventCount>0).length}<small>With logs</small></strong><strong>{missingLogCount}<small>Without events</small></strong><strong>{taskLogs.length}<small>Recent events</small></strong></div>
            <div className={styles.coverageList}>{paginate(coverage,getPage('coverage'),8).map(p=><div key={p.project}><span>{p.project}</span><span className={p.eventCount>0?styles.hasEvents:styles.noEvents}>{p.eventCount>0?(p.runCount+" runs · "+p.eventCount+" events"):"No execution log"}</span></div>)}</div><Pagination total={coverage.length} page={getPage('coverage')} onChange={changePage('coverage')} pageSize={8}/>
          </section>

          <section className={styles.queueSection}>
            <div className={styles.queueTitle}><div><span>05 / OBSERVABILITY</span><h2>Recent MCP activity</h2></div><button className={styles.queueLink} onClick={()=>setView("activity")}>Activity →</button></div>
            <div className={styles.tableWrap}><table><thead><tr><th>Tool</th><th>Project</th><th>Status</th><th>Elapsed</th><th>Last event</th></tr></thead><tbody>{recent.slice(0,6).map(x=><tr key={x.id}><td><strong>{x.tool}</strong></td><td>{x.project||"—"}</td><td><span className={statusClass(x.status)}>{x.status}</span></td><td>{x.durationMs} ms</td><td>{age(x.finishedAt||x.startedAt||x.queuedAt,now)}</td></tr>)}{recent.length===0&&<tr><td className={styles.empty} colSpan={5}>No recent requests</td></tr>}</tbody></table></div>
          </section>
        </div>
      </>}

      {view==="parallel" && <ParallelRuns requests={queue.items} projects={projects} now={now} online={online} paused={paused} onProject={p=>{const match=projects.find(item=>item.project===p.project);if(match)openProject(match);}} onWorkflow={()=>setView("workflows")}/>}

      {view==="tasks" && <section className={styles.viewStack}>
        <div className={styles.viewToolbar}><div><span>WORK ITEMS</span><strong>{taskRows.length} tasks across {filteredProjects.length} projects</strong></div><div className={styles.chips}><button onClick={()=>changeQuery("")}>All</button><button onClick={()=>changeQuery("IN_PROGRESS")}>Active</button><button onClick={()=>changeQuery("BLOCKED")}>Blocked</button><button onClick={()=>changeQuery("DONE")}>Done</button></div></div>
        <article className={styles.panel}>
          <div className={styles.tableWrap}><table><thead><tr><th>Task</th><th>Project</th><th>Status</th><th>Runner</th><th>Updated</th></tr></thead><tbody>
            {paginate(taskRows,getPage('tasks'),15).map((task,i)=><tr
              key={`${task.project}-${task.id||task.title}-${i}`}
              className={styles.clickableTaskRow}
              tabIndex={0}
              onClick={()=>openTask(task.project,task.id,task.title)}
              onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();openTask(task.project,task.id,task.title);}}}
            ><td><strong>{task.id||"—"}</strong><small className={styles.cellSub}>{task.title}</small></td><td>{task.project}</td><td><span className={statusClass(task.status)}>{task.status}</span></td><td>{task.runner||"—"}</td><td>{age(task.updatedAt,now)}</td></tr>)}
            {!taskRows.length&&<tr><td colSpan={5} className={styles.empty}>No matching tasks</td></tr>}
          </tbody></table></div><Pagination total={taskRows.length} page={getPage('tasks')} onChange={changePage('tasks')} pageSize={15}/>
        </article>
      </section>}

      {view==="projects" && <section className={styles.viewStack}>
        <div className={styles.projectCards}>{paginate(filteredProjects,getPage('projects'),9).map(p=><article className={styles.projectCard} key={p.project} role="button" tabIndex={0} onClick={()=>openProject(p)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();openProject(p);}}}>
          <ProjectOverviewDiagram project={p}/>
          <div className={styles.projectCardHead}><div className={styles.avatar}>{p.project.slice(0,2).toUpperCase()}</div><span className={statusClass(p.status)}>{p.status}</span></div>
          <h3>{p.project}</h3><p>{p.task||"No active task"}</p>
          <dl><div><dt>Current step</dt><dd>{p.currentStep||"—"}</dd></div><div><dt>Tracker</dt><dd>{p.hasTracker?"Connected":"None"}</dd></div><div><dt>Runtime</dt><dd>{p.runtimeSource==="execution_events" ? "Event-backed" : p.hasRuntime ? "Legacy / unverified" : "No runtime"}</dd></div><div><dt>Run ID</dt><dd>{p.runId||"—"}</dd></div><div><dt>Recorded events</dt><dd>{p.eventCount??"—"}</dd></div><div><dt>DAG steps</dt><dd>{p.dagSteps?Object.values(p.dagSteps).filter(s=>s.status==="COMPLETED").length+"/"+Object.keys(p.dagSteps).length:"—"}</dd></div><div><dt>QA acceptance</dt><dd>{qaAcceptance(p)}</dd></div><div><dt>Tasks</dt><dd>{p.tasks?.length||0}</dd></div><div><dt>Last signal</dt><dd>{age(p.heartbeatAt||p.trackerUpdatedAt,now)}</dd></div></dl>
          {p.blocker&&<div className={styles.projectBlocker}>Blocker: {p.blocker}</div>}
          <button className={styles.openProjectButton} onClick={e=>{e.stopPropagation();openProject(p);}}>Open project details</button>
        </article>)}</div>
        {!filteredProjects.length&&<div className={styles.emptyState}>No matching projects</div>}<Pagination total={filteredProjects.length} page={getPage('projects')} onChange={changePage('projects')} pageSize={9}/>
      </section>}

      {view==="activity" && <section className={styles.viewStack}>
        <div className={styles.queueSection}>
          <div className={styles.queueTitle}><div><span>DURABLE EXECUTION</span><h2>Task event log</h2><p>PostgreSQL events · newest first · independent of transient MCP requests.</p></div>
            <label className={styles.logFilter}>Project <select value={logProject} onChange={e=>changeLogProject(e.target.value)}><option value="all">All projects</option>{[...new Set(taskLogs.map(x=>x.project))].sort().map(x=><option key={x} value={x}>{x}</option>)}</select></label>
          </div>
          <div className={styles.logList}>{paginate(projectLogs,getPage('logs'),15).map(item=><article key={item.sequenceId} className={styles.logEvent}>
            <div><span className={statusClass(item.kind)}>{item.kind}</span><strong>{item.project} <span> / {item.task}</span></strong><time>{age(item.receivedAt,now)}</time></div>
            <p>{item.step||"No step supplied"}</p><small>{item.agent} · {item.runId}</small>
          </article>)}{!projectLogs.length&&<div className={styles.queueEmpty}>No recorded execution events for this selection.</div>}</div><Pagination total={projectLogs.length} page={getPage('logs')} onChange={changePage('logs')} pageSize={15}/>
        </div>
        <section className={styles.queueSection}><div className={styles.queueTitle}><div><span>TRANSIENT REQUESTS</span><h2>Recent MCP activity</h2></div></div><div className={styles.tableWrap}><table><thead><tr><th>Tool</th><th>Server</th><th>Project</th><th>Status</th><th>Duration</th><th>Time</th></tr></thead><tbody>{paginate(recent,getPage('requests'),15).map(x=><tr key={x.id}><td><strong>{x.tool}</strong></td><td>{x.server}</td><td>{x.project}</td><td><span className={statusClass(x.status)}>{x.status}</span></td><td>{x.durationMs} ms</td><td>{age(x.finishedAt||x.startedAt||x.queuedAt,now)}</td></tr>)}{recent.length===0&&<tr><td colSpan={6} className={styles.empty}>No activity available</td></tr>}</tbody></table></div><Pagination total={recent.length} page={getPage('requests')} onChange={changePage('requests')} pageSize={15}/></section></section>}
      {view==="workflows" && <WorkflowStudio projects={projects.map(p=>p.project)}/>} 
      {view==="playwrightops" && <PlaywrightOpsConsole gatewayRuns={projects.map(p=>({project:p.project,taskId:p.taskId,runId:p.runId,status:p.status,heartbeatAt:p.heartbeatAt,runtimeSource:p.runtimeSource,eventCount:p.eventCount}))} onOpenGatewayWorkflow={()=>setView("workflows")}/>}
      {view==="github" && <GithubIssuesPanel/>}
      {view==="chatgptqueue" && <ChatGptQueuePanel projects={projects}/>}
      {view==="playwright" && <section className={styles.viewStack}>
        <section className={styles.queueSection}>
          <div className={styles.queueTitle}>
            <div><span>GATEWAY / PLAYWRIGHT</span><h2>Profile inventory</h2><p>Browser profile directories and last successful MCP checkpoints. Login validity and live browser activity are not inferred from these records.</p></div>
            <button type="button" className={styles.iconButton} onClick={()=>void load()} title="Refresh profile inventory">↻</button>
          </div>
          <div className={styles.queueSummary}>
            <div><span>DISCOVERED PROFILES</span><strong>{playwrightInventory.profiles.length}</strong><small>On disk</small></div>
            <div><span>RECORDED SESSIONS</span><strong>{playwrightInventory.sessions.length}</strong><small>Checkpoint records</small></div>
            <div><span>WITH PROJECT</span><strong>{playwrightInventory.sessions.filter(x=>x.projectId).length}</strong><small>Explicit project routing</small></div>
          </div>
          {playwrightError&&<div className={styles.error} role="alert">Profile inventory unavailable: {playwrightError}. Restart the gateway safely to activate the inventory endpoint; the dashboard will load read-only profile metadata.</div>}
          <label className={styles.logFilter}>Filter profiles <input aria-label="Filter Playwright profiles" value={profileFilter} onChange={e=>setProfileFilter(e.target.value)} placeholder="Profile, project, task or session" /></label>
          <div className={styles.tableWrap}><table>
            <thead><tr><th>Profile</th><th>Type</th><th>Project</th><th>Task / Session</th><th>Last tool</th><th>Checkpoint</th></tr></thead>
            <tbody>{playwrightInventory.profiles.filter(p=>{
              const s=playwrightInventory.sessions.find(x=>x.profileId===p.profileId||x.profileId==="context:"+p.profileId||x.profileId==="account:"+p.profileId);
              return [p.profileId,p.category,s?.projectId,s?.taskId,s?.sessionId].some(value=>String(value||"").toLowerCase().includes(profileFilter.toLowerCase()));
            }).map(p=>{
              const s=playwrightInventory.sessions.find(x=>x.profileId===p.profileId||x.profileId==="context:"+p.profileId||x.profileId==="account:"+p.profileId);
              return <tr key={p.profileId}><td><strong>{p.profileId}</strong></td><td>{p.category}</td><td>{s?.projectId||"—"}</td><td>{s?.taskId||"—"} / {s?.sessionId||"—"}</td><td>{s?.lastTool||"No checkpoint"}</td><td>{s?age(s.updatedAt,now):"—"}</td></tr>;
            })}
            {playwrightInventory.profiles.length===0&&<tr><td colSpan={6} className={styles.empty}>No profiles reported. Check gateway availability and API authorization.</td></tr>}
            </tbody></table></div>
          <p className={styles.queueFootnote}>Read-only view. No cookies, passwords or browser storage contents are exposed. A checkpoint is not proof of an active login.</p>
        </section>
      </section>}

      {view==="mcp" && <section className={styles.queueSection}><div className={styles.queueTitle}><div><span>GATEWAY · LIVE CONNECTIONS</span><h2>MCP servers and tools</h2><p>Connections from Unified MCP Gateway · {gatewayStatus?.gateway.endpoint||"Gateway unavailable"} · {gatewayStatus?.gateway.totalTools??"—"} exposed tools</p></div></div><div className={styles.tableWrap}><table><thead><tr><th>Server</th><th>Project</th><th>Connection</th><th>Enabled</th><th>Tools</th></tr></thead><tbody>{(gatewayStatus?.servers||[]).map(server=><tr key={server.name}><td><strong title={server.description}>{server.name}</strong></td><td>{server.project}</td><td><span className={server.connected?styles.done:styles.blocked}>{server.connected?"CONNECTED":"OFFLINE"}</span></td><td>{server.enabled?"Yes":"No"}</td><td>{server.tools}</td></tr>)}{!gatewayStatus?.servers?.length&&<tr><td colSpan={5} className={styles.empty}>Gateway status unavailable. Check port 8090.</td></tr>}</tbody></table></div><div className={styles.queueTitle}><div><span>REQUEST OBSERVABILITY</span><h2>Observed MCP tool calls</h2><p>Tools below are derived from recent calls, not the complete exposed tool catalog.</p></div></div><div className={styles.tableWrap}><table><thead><tr><th>Server</th><th>Tool</th><th>Calls observed</th><th>Latest status</th></tr></thead><tbody>{paginate([...new Map(recent.map(x=>[x.server+"::"+x.tool,{server:x.server,tool:x.tool,latest:x.status,count:recent.filter(r=>r.server===x.server&&r.tool===x.tool).length}])).values()],getPage('tools'),15).map(x=><tr key={x.server+x.tool}><td>{x.server}</td><td><strong>{x.tool}</strong></td><td>{x.count}</td><td><span className={statusClass(x.latest)}>{x.latest}</span></td></tr>)}{recent.length===0&&<tr><td className={styles.empty} colSpan={4}>No observed tools</td></tr>}</tbody></table></div><Pagination total={new Set(recent.map(x=>x.server+'::'+x.tool)).size} page={getPage('tools')} onChange={changePage('tools')} pageSize={15}/></section>}
    </section>

    {selectedProject&&<div className={styles.modalBackdrop} role="presentation" onMouseDown={e=>{if(e.currentTarget===e.target)setSelectedProjectName(null);}}>
      <section className={styles.projectModal} role="dialog" aria-modal="true" aria-labelledby="project-modal-title">
        <header className={styles.modalHeader}>
          <div><span>PROJECT DETAIL</span><h2 id="project-modal-title">{selectedProject.project}</h2><p>{selectedProject.task}</p></div>
          <button className={styles.modalClose} onClick={()=>setSelectedProjectName(null)} aria-label="Close project details">×</button>
        </header>
        <div className={styles.modalOverview}><ProjectOverviewDiagram project={selectedProject}/><div style={{padding:"12px",fontSize:12}}><strong>Last execution (not project acceptance):</strong> {selectedProject.runtimeSource==="execution_events" ? "PostgreSQL events projection" : "No verified execution event projection"} · Run: {selectedProject.runId||"—"} · Events: {selectedProject.eventCount??"—"} · Runner: {selectedProject.runner||"—"} · Heartbeat: {age(selectedProject.heartbeatAt,now)} · Step: {selectedProject.currentStep||"—"} · <strong>QA acceptance:</strong> {qaAcceptance(selectedProject)}</div></div>
        {selectedProject.dagSteps&&<div style={{padding:"8px 20px",display:"grid",gap:6,maxHeight:160,overflowY:"auto"}}>
          <strong>DAG workflow steps</strong>
          {Object.entries(selectedProject.dagSteps).map(([id,step])=><div key={id} style={{display:"flex",justifyContent:"space-between",gap:12,fontSize:12}}>
            <span>{id} · attempt {step.attempts}{step.error?" · "+step.error:""}</span><span className={statusClass(step.status)}>{step.status}</span>
          </div>)}
        </div>}
        <div className={styles.modalBody}>
          <aside className={styles.modalTaskNav}>
            <div className={styles.modalTaskNavHead}><strong>Tasks</strong><span>{selectedTasks.length}</span></div>
            {selectedTasks.map((task,i)=><button key={`${task.id||task.title}-${i}`} className={i===selectedTaskIndex?styles.modalTaskActive:""} onClick={()=>{setSelectedTaskIndex(i);setSelectedTaskTab("overview");}}>
              <span><b>{task.id||"Task"}</b><small>{task.title}</small></span>
              <em className={statusClass(task.status)}>{task.status}</em>
            </button>)}
            {!selectedTasks.length&&<div className={styles.empty}>No task records</div>}
          </aside>
          <article className={styles.modalTaskDetail}>
            {selectedTask?<>
              <div className={styles.modalTaskTitle}><div><span>{selectedTask.visualStatus||"NO_VISUAL_SPEC"} · {selectedTask.document?.status||"MISSING_DOCUMENT"}</span><h3>{selectedTask.id||"Task"} — {selectedTask.title}</h3></div><em className={statusClass(selectedTask.status)}>{selectedTask.status}</em></div>
              {selectedTask.acceptanceStatus==="DONE_CLAIM_UNVERIFIED"&&<div className={styles.notice} role="status">Tracker ghi DONE nhưng Gateway chưa có quality acceptance đáng tin cậy cho đúng task/run. Trạng thái hiển thị: UNVERIFIED.</div>}
              <div className={styles.taskTabs} role="tablist" aria-label="Task detail views">
                {(["overview","document","visual","evidence"] as const).map(tab=><button key={tab} role="tab" aria-selected={selectedTaskTab===tab} className={selectedTaskTab===tab?styles.taskTabActive:""} onClick={()=>setSelectedTaskTab(tab)}>{tab[0].toUpperCase()+tab.slice(1)}</button>)}
              </div>
              {selectedTaskTab==="overview"&&<>
                <div className={styles.taskDetailGrid}>
                  <div><b>INPUT</b><span>{selectedTask.visual?.input||"Not documented"}</span></div>
                  <div><b>PIPELINE</b><span>{selectedTask.visual?.pipeline||"Not documented"}</span></div>
                  <div><b>OUTPUT</b><span>{selectedTask.visual?.output||"Not documented"}</span></div>
                </div>
                <div className={styles.documentSummary}><b>DOCUMENT</b><span>{selectedTask.document?.status==="READY"?selectedTask.document.path:"No task document attached"}</span></div>
                 <SkillUsagePanel key={selectedTask.id||selectedTask.title} taskId={selectedTask.id||""}
                   title={selectedTask.title} project={selectedProject.project}/>
              </>}
              {selectedTaskTab==="document"&&(selectedTask.document?.status==="READY"&&selectedTask.document.content?<div className={styles.documentPanel}><div className={styles.documentPath}>{selectedTask.document.path}</div><pre>{selectedTask.document.content}</pre></div>:<div className={styles.noDocument}><strong>MISSING_DOCUMENT</strong><span>No project-local task document is attached yet.</span></div>)}
              {selectedTaskTab==="visual"&&<div className={styles.diagramFrame}><TaskVisualDiagram task={selectedTask} project={selectedProject.project}/></div>}
              {selectedTaskTab==="evidence"&&<div className={styles.artifactList}><strong>Artifacts / Evidence</strong>{selectedTask.visual?.artifacts?.length?selectedTask.visual.artifacts.map((item,i)=><span key={`${item}-${i}`}>• {item}</span>):<span>No artifact evidence documented yet.</span>}</div>}
            </>:<div className={styles.emptyState}>Select a task to view its detail and generated image.</div>}
          </article>
        </div>
      </section>
    </div>}
  </main>;
}
