"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "../styles/workflow-studio.module.css";

type RegisteredWorkflow = {id:string; article:string; steps:number; estimatedSeconds:number; status:string; file:string};
type RegisteredStep = {taskId:string; title:string; prompt:string; mcp:string; tool:string; argumentsTemplate:unknown; estimatedSeconds:number; timeoutSeconds:number; pollIntervalSeconds:number; outputArtifact:string; executionSupport:string; status:string};
type RegisteredDetail = {workflowId:string; article:string; steps:RegisteredStep[]};
type Step = { id:string; tool:string; argumentsText:string; dependsOn:string; maxRetries:number; retrySafe:boolean };
type StepState = {status:string;attempts:number;error?:string;startedAt?:string;completedAt?:string};
type QualityGate = {gate:string;status:string;reason:string;evidenceReference?:string|null};
type QualityAssessment = {taskId:string;status:string;gates:QualityGate[]};
type PinnedSkill = {id:string;contentHash:string;collection:string;reason:string;score:number};
type SkillSnapshot = {selected:PinnedSkill[];rejected:{id:string;reason:string}[]};
type CodingTaskProvenance = {taskId:string;issueUrl:string;branch:string;baseCommitSha:string;leaseId:string;fencingEpoch:number;gatewayOwner:string;gitHubStatus:string;commitVerification:string;nativeVerification:string};
type RunState = {runId:string;project:string;status:string;steps:Record<string,StepState>;updatedAt:string;quality?:QualityAssessment|null;skills?:SkillSnapshot|null;codingTask?:CodingTaskProvenance|null};
type WritePreflight = {status:"READY"|"READ_ONLY";project:string;taskId?:string|null;writes:boolean;wholeProject:boolean;paths:string[];lockScopes:string[];checkedAt:string};
const initialSteps:Step[] = [
  {id:"collect",tool:"",argumentsText:"{}",dependsOn:"",maxRetries:0,retrySafe:false},
  {id:"process",tool:"",argumentsText:"{}",dependsOn:"collect",maxRetries:0,retrySafe:false},
  {id:"verify",tool:"",argumentsText:"{}",dependsOn:"process",maxRetries:0,retrySafe:false}
];
const slug = (v:string) => /^[a-zA-Z0-9_-]{1,96}$/.test(v);
export default function WorkflowStudio({projects}:{projects:string[]}) {
  const [registered,setRegistered]=useState<RegisteredWorkflow[]>([]);
  const [selectedRegistered,setSelectedRegistered]=useState("");
  const [registeredDetail,setRegisteredDetail]=useState<RegisteredDetail|null>(null);
  const [registryError,setRegistryError]=useState("");
  const [registryRefresh,setRegistryRefresh]=useState(0);
  useEffect(()=>{
    let active=true;
    const load=()=>fetch("/mcp-admin/article-workflows",{cache:"no-store"})
      .then(r=>{if(!r.ok)throw Error("Gateway registry HTTP "+r.status);return r.json();})
      .then(data=>{if(active){setRegistered(data.items||[]);setRegistryError("");}})
      .catch(e=>{if(active)setRegistryError(String(e));});
    void load();
    const retry=setInterval(()=>{void load();},15000);
    return ()=>{active=false;clearInterval(retry);};
  },[registryRefresh]);
  useEffect(()=>{
    if(!selectedRegistered)return;
    let active=true;
    fetch("/mcp-admin/article-workflows/"+encodeURIComponent(selectedRegistered),{cache:"no-store"})
      .then(r=>{if(!r.ok)throw Error("Workflow HTTP "+r.status);return r.json();})
      .then(data=>{if(active){setRegisteredDetail(data);setRegistryError("");}})
      .catch(e=>{if(active)setRegistryError(String(e));});
    return ()=>{active=false;};
  },[selectedRegistered]);
  const [project,setProject]=useState("");
  const [runId,setRunId]=useState("");
  const [taskId,setTaskId]=useState("");
  const [skillTaskQuery,setSkillTaskQuery]=useState("");
  const [skillStack,setSkillStack]=useState("");
  const [skillProjectKind,setSkillProjectKind]=useState("");
  const [recoverySource,setRecoverySource]=useState("");
  const [token,setToken]=useState("");
  const [steps,setSteps]=useState<Step[]>(initialSteps);
  const [parallel,setParallel]=useState(2);
  const [resume,setResume]=useState(false);
  const [approvedRetries,setApprovedRetries]=useState("");
  const [busy,setBusy]=useState(false);
  const [state,setState]=useState<RunState|null>(null);
  const [message,setMessage]=useState("");
  const [showJson,setShowJson]=useState(false);
  const [writeGate,setWriteGate]=useState<{signature:string;value:WritePreflight}|null>(null);
  const update=(index:number,patch:Partial<Step>)=>setSteps(prev=>prev.map((item,i)=>i===index?{...item,...patch}:item));
  const definition=useMemo(()=>{
    try {
      const ids=new Set<string>();
      const mapped=steps.map(step=>{
        const id=step.id.trim();
        if(!slug(id)||ids.has(id)) throw new Error("Step IDs phải duy nhất, chỉ chứa chữ, số, '-' hoặc '_'.");
        ids.add(id);
        if(!step.tool.trim()) throw new Error("Mỗi step phải có MCP tool.");
        const args=JSON.parse(step.argumentsText);
        if(!args||typeof args!=="object"||Array.isArray(args)) throw new Error("Arguments phải là JSON object.");
        return {id,tool:step.tool.trim(),arguments:args,dependsOn:step.dependsOn.split(",").map(v=>v.trim()).filter(Boolean),maxRetries:step.maxRetries,retrySafe:step.retrySafe};
      });
      for(const step of mapped) if(step.dependsOn.some(id=>!ids.has(id)||id===step.id)) throw new Error("Dependency không tồn tại hoặc tự tham chiếu.");
      const visited=new Set<string>();const stack=new Set<string>();
      const visit=(id:string)=>{if(stack.has(id)) throw new Error("Workflow có dependency cycle.");if(visited.has(id)) return;stack.add(id);mapped.find(x=>x.id===id)?.dependsOn.forEach(visit);stack.delete(id);visited.add(id);};
      mapped.forEach(x=>visit(x.id));
      return {steps:mapped,error:""};
    } catch(e) {return {steps:[],error:e instanceof Error?e.message:"Invalid workflow"};}
  },[steps]);
  const payload={runId,project,taskId:taskId.trim()||undefined,
    skillTaskQuery:skillTaskQuery.trim()||undefined,skillStack:skillStack.trim()||undefined,
    skillProjectKind:skillProjectKind.trim()||undefined,
    steps:definition.steps,resume,
    resumeFromRunId:recoverySource.trim()||undefined,maxParallel:parallel,
    retrySteps:approvedRetries.split(",").map(s=>s.trim()).filter(Boolean)};
  const signature=JSON.stringify(payload);
  async function previewAdmission(){
    if(!project||!slug(runId)||!token.trim()||definition.error){setMessage("Enter a valid project, run ID, tool definition and Gateway token.");return;}
    setBusy(true);setMessage("");setWriteGate(null);
    try {
      const response=await fetch("/mcp-workflows/dag/preflight",{method:"POST",cache:"no-store",
        headers:{"Content-Type":"application/json",Authorization:"Bearer "+token.trim()},body:signature});
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.error||("Preflight HTTP "+response.status));
      setWriteGate({signature,value:data as WritePreflight});
      setMessage("Preflight "+data.status+" · no task dispatched. Git and lock checks run again at execution.");
    }catch(e){setMessage("BLOCKED: "+String(e));}finally{setBusy(false);}
  }
  async function execute(readOnly:boolean){
    if(!readOnly&&writeGate?.signature!==signature){setMessage("PRECHECK_REQUIRED: run Git/lock preflight for the current workflow definition.");return;}
    if(!project||!slug(runId)||!token.trim()){setMessage("Chọn project, nhập Run ID hợp lệ và Bearer token của Gateway.");return;}
    if(!readOnly&&definition.error){setMessage(definition.error);return;}
    if(!readOnly&&((taskId.trim()&&!slug(taskId.trim()))||
       (recoverySource.trim()&&!slug(recoverySource.trim()))||
       (recoverySource.trim()&&(resume||!taskId.trim()))||
       skillTaskQuery.length>2000||skillStack.length>150||skillProjectKind.length>150)){
      setMessage("Task ID phải hợp lệ; recovery cần Task ID và Run ID mới, không bật Resume.");return;
    }
    setBusy(true);setMessage("");
    try {
      const url=readOnly?"/mcp-workflows/dag/"+encodeURIComponent(project)+"/"+encodeURIComponent(runId):"/mcp-workflows/dag";
      const response=await fetch(url,{method:readOnly?"GET":"POST",headers:{Authorization:"Bearer "+token.trim(),...(!readOnly?{"Content-Type":"application/json"}:{})},...(!readOnly?{body:JSON.stringify(payload)}:{}),cache:"no-store"});
      const json=await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(json.error||json.title||("HTTP "+response.status));
      setState(json as RunState);
      setMessage(readOnly?"Đã đọc checkpoint từ backend.":"Runner đã trả về trạng thái thực thi và checkpoint.");
    } catch(e){setMessage(e instanceof Error?e.message:"Gateway request failed");}
    finally{setBusy(false);}
  }
  return <section className={styles.studio}>
    <section style={{border:"1px solid #cbd5e1",borderRadius:12,padding:16,marginBottom:20}}>
      <h2>CoinFX article workflows</h2>
      <p>Định nghĩa đã lưu trên MacbookLocal · chưa được triển khai executor Playwright/ChatGPT/ImageGen. Xem prompt, MCP và ETA cho từng task.</p>
      {registryError&&<p role="alert">Không tải được workflow registry: {registryError}. Tự thử lại sau 15 giây. <button type="button" onClick={()=>setRegistryRefresh(n=>n+1)}>Retry now</button></p>}
      <label>Chọn workflow
        <select value={selectedRegistered} onChange={e=>{setSelectedRegistered(e.target.value);setRegisteredDetail(null);}}>
          <option value="">Chọn bài viết ({registered.length} workflow)</option>
          {registered.map(w=><option key={w.id} value={w.id}>{w.id} · {w.article} · {w.steps} tasks · ETA {Math.ceil(w.estimatedSeconds/60)} phút</option>)}
        </select>
      </label>
      {registeredDetail&&<div style={{display:"grid",gap:10,marginTop:16}}>
        <strong>{registeredDetail.article} — {registeredDetail.steps.length} tasks</strong>
        {registeredDetail.steps.map(s=><details key={s.taskId} style={{border:"1px solid #e2e8f0",borderRadius:8,padding:10}}>
          <summary style={{cursor:"pointer"}}>{s.taskId} — {s.title} · ETA {s.estimatedSeconds}s · {s.executionSupport}</summary>
          <div style={{display:"grid",gap:8,marginTop:10,overflowWrap:"anywhere"}}>
            <strong>Prompt</strong><pre style={{whiteSpace:"pre-wrap"}}>{s.prompt}</pre>
            <strong>MCP / Tool</strong><code>{s.mcp} → {s.tool}</code>
            <strong>Arguments / command</strong><pre style={{whiteSpace:"pre-wrap"}}>{JSON.stringify(s.argumentsTemplate,null,2)}</pre>
            <span>Estimated {s.estimatedSeconds}s · Timeout {s.timeoutSeconds}s · Poll {s.pollIntervalSeconds}s</span>
            <span>Output: {s.outputArtifact}</span>
            <small>Status: {s.status} · Definition only</small>
          </div>
        </details>)}
      </div>}
    </section>
    <div className={styles.heading}><div><span>WORKFLOW ORCHESTRATION</span><h2>End-to-end workflow studio</h2><p>Build → Validate → Execute → Inspect → Resume. Gọi trực tiếp DAG runner của MCP Gateway, không phải mô phỏng.</p></div><span className={styles.runtime}>Gateway DAG v1</span></div>
    <div className={styles.setup}>
      <label>Project<select value={project} onChange={e=>setProject(e.target.value)}><option value="">Select project</option>{projects.map(p=><option key={p}>{p}</option>)}</select></label>
      <label>Run ID<input placeholder="review_mexc_001" value={runId} onChange={e=>setRunId(e.target.value)}/></label>
      <label>Task ID (quality-gated)<input placeholder="MCP-QUALITY-106" value={taskId} onChange={e=>setTaskId(e.target.value)} /></label>
       <label>Skill-aware task prompt<input placeholder="e.g. Implement React dashboard with QA" value={skillTaskQuery} onChange={e=>setSkillTaskQuery(e.target.value)} maxLength={2000}/></label>
       <label>Skill stack (optional)<input placeholder="React / ASP.NET / RAG" value={skillStack} onChange={e=>setSkillStack(e.target.value)} maxLength={150}/></label>
       <label>Project kind (conflict policy)<input placeholder="dashboard / chat / landing" value={skillProjectKind} onChange={e=>setSkillProjectKind(e.target.value)} maxLength={150}/></label>
      <label>Gateway Bearer token<input type="password" autoComplete="off" placeholder="Required for protected API" value={token} onChange={e=>setToken(e.target.value)}/></label>
      <label>Max parallel<select value={parallel} onChange={e=>setParallel(Number(e.target.value))}>{[1,2,3,4,5].map(n=><option key={n} value={n}>{n}</option>)}</select></label>
    </div>
    <div className={styles.notice}>Credentials remain in component memory only. Task ID enables independently verified Quality Gates; without Task ID, technical completion is NOT quality acceptance. An approved server-side manifest and independent verifier receipts are required; absent evidence stays BLOCKED.</div>
    <div className={styles.sectionHead}><h3>Pipeline steps</h3><button onClick={()=>setSteps(s=>[...s,{id:"step_"+(s.length+1),tool:"",argumentsText:"{}",dependsOn:s.at(-1)?.id||"",maxRetries:0,retrySafe:false}])}>+ Add step</button></div>
    <div className={styles.steps}>{steps.map((step,i)=><article className={styles.step} key={i}>
      <div className={styles.stepTitle}><span>{String(i+1).padStart(2,"0")}</span><strong>{step.id||"New step"}</strong><button disabled={steps.length===1} onClick={()=>setSteps(s=>s.filter((_,idx)=>idx!==i))}>Remove</button></div>
      <div className={styles.stepFields}><label>Step ID<input value={step.id} onChange={e=>update(i,{id:e.target.value})}/></label><label>MCP tool (namespaced)<input placeholder="workspace__read_text_file" value={step.tool} onChange={e=>update(i,{tool:e.target.value})}/></label><label>Depends on (comma separated)<input value={step.dependsOn} onChange={e=>update(i,{dependsOn:e.target.value})}/></label><label>Max retries<input type="number" min="0" max="5" value={step.maxRetries} onChange={e=>update(i,{maxRetries:Math.min(5,Math.max(0,Number(e.target.value)))})}/></label></div>
      <label>Tool arguments JSON<textarea spellCheck={false} rows={3} value={step.argumentsText} onChange={e=>update(i,{argumentsText:e.target.value})}/></label>
      <label className={styles.check}><input type="checkbox" checked={step.retrySafe} onChange={e=>update(i,{retrySafe:e.target.checked})}/> Idempotent / read-only tool — safe for automatic retry</label>
      {state?.steps[step.id]&&<div className={styles.stepStatus}><b>{state.steps[step.id].status}</b> · {state.steps[step.id].attempts} attempts {state.steps[step.id].error&&<span>· {state.steps[step.id].error}</span>}</div>}
    </article>)}</div>
    <div className={styles.controls}>
      <label className={styles.check}><input type="checkbox" checked={resume} onChange={e=>setResume(e.target.checked)}/> Resume existing checkpoint (same Run ID and definition)</label>
      <label>Recover from blocked run (new Run ID only)<input value={recoverySource} onChange={e=>setRecoverySource(e.target.value)} placeholder="previous_run_id"/></label>
      {(resume||recoverySource)&&<label>Explicit retry step IDs<input value={approvedRetries} onChange={e=>setApprovedRetries(e.target.value)} placeholder={recoverySource?"__quality":"process,verify"}/></label>}
      <div className={styles.actions}><button disabled={busy||!!definition.error} onClick={()=>setShowJson(v=>!v)}>{showJson?"Hide":"Preview"} definition</button><button disabled={busy} onClick={()=>void execute(true)}>Check checkpoint</button><button disabled={busy||!!definition.error} onClick={()=>void previewAdmission()}>Git/lock preflight</button><button className={styles.primary} disabled={busy||!!definition.error||writeGate?.signature!==signature} onClick={()=>void execute(false)}>{busy?"Executing…":resume?"Resume workflow":"Execute workflow"}</button></div>
      {writeGate?.signature===signature&&<div role="status" className={styles.notice}>Preflight {writeGate.value.status} · {writeGate.value.wholeProject?"Exclusive project lock":writeGate.value.writes?"Scoped project/file locks":"Read-only"} · {writeGate.value.paths.length} file/directory scopes · checked {writeGate.value.checkedAt}. This is not a reservation or QA acceptance.</div>}
    </div>
    {definition.error&&<p className={styles.error}>{definition.error}</p>}
    {message&&<p className={styles.notice} role="status">{message}</p>}
    {state&&<div className={styles.result}>
      <strong>{state.project} / {state.runId}</strong>
      <span>Execution: {state.status} · {Object.values(state.steps||{}).filter(s=>s.status==="COMPLETED").length}/{Object.keys(state.steps||{}).length} steps completed</span>
      <small>Checkpoint: {state.updatedAt}</small>
      {state.codingTask&&<section aria-label="Coding task source and lease evidence"
        style={{width:"100%",display:"grid",gap:5,padding:12,border:"1px solid #47718a",borderRadius:8,overflowWrap:"anywhere"}}>
        <strong>Verified coding task identity — {state.codingTask.taskId}</strong>
        <span>GitHub source: {state.codingTask.gitHubStatus} ·
          <a href={state.codingTask.issueUrl} target="_blank" rel="noreferrer"> Issue</a></span>
        <small>Branch: {state.codingTask.branch} · Base SHA: {state.codingTask.baseCommitSha}</small>
        <small>Lease at checkpoint: {state.codingTask.leaseId} · epoch {state.codingTask.fencingEpoch} · Gateway: {state.codingTask.gatewayOwner}</small>
        <small>Post-write commit/PR: {state.codingTask.commitVerification} · Native: {state.codingTask.nativeVerification}</small>
        <small>This is an immutable checkpoint snapshot, NOT proof that the lease is still active or that the task is accepted.</small>
      </section>}
       <section aria-label="Skill provenance" style={{width:"100%",display:"grid",gap:8,borderTop:"1px solid #416152",paddingTop:12}}>
         <strong>Skill provenance — {state.skills?.selected.length??0} pinned selections</strong>
         {!state.skills?.selected.length&&<small>No Skill manifest. No Skill usage is claimed.</small>}
         {state.skills?.selected.map(skill=><div key={skill.id} style={{display:"grid",gap:3,overflowWrap:"anywhere"}}>
           <span>{skill.id} · SELECTED (not proof of Agent execution)</span>
           <small>{skill.reason} · source {skill.collection} · SHA256 {skill.contentHash.slice(0,16)}…</small>
         </div>)}
         {!!state.skills?.rejected.length&&<small>{state.skills.rejected.length} candidates rejected due to conflicts or budget.</small>}
         <small>Step history and retries shown below are execution facts; Skill selections are only pinned metadata.</small>
         {Object.entries(state.steps).map(([id,detail])=><div key={id}>
           <small>{id}: {detail.status} · attempts {detail.attempts}
             {detail.error?" · "+detail.error:""}
             {detail.completedAt?" · "+detail.completedAt:""}
           </small>
         </div>)}
       </section>
      <div style={{borderTop:"1px solid #cbd5e1",marginTop:10,paddingTop:10,display:"grid",gap:8}}>
        <strong>Quality acceptance: {state.quality?.status||"UNVERIFIED"}</strong>
        {state.quality?.gates?.map(gate=><div key={gate.gate} style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap",overflowWrap:"anywhere"}}>
          <span><strong>{gate.gate}</strong> · {gate.status} — {gate.reason}</span>
          <small>{gate.evidenceReference||"No verified evidence"}</small>
        </div>)}
        {!state.quality&&<small>Technical DAG status alone cannot prove task acceptance. Run a task-scoped quality contract and inspect each gate.</small>}
      </div>
    </div>}
    {showJson&&<pre className={styles.preview}>{JSON.stringify(payload,null,2)}</pre>}
    <p className={styles.limit}>DAG supports dependency order, checkpoints, bounded retries and trusted Quality Gate decisions. A blocked quality decision requires a new recovery run, retry step <code>__quality</code>; completed implementation steps must not be replayed. Approval, business DB write receipts and automatic UI acceptance still require trusted integrations.</p>
  </section>;
}
