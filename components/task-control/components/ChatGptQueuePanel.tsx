"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "../styles/chatgpt-queue.module.css";

type BacklogTask={id?:string|null;title:string;status:string;acceptanceStatus?:string|null;document?:{status:string;content?:string|null}|null};
type Project={project:string;tasks?:BacklogTask[]};
type Mapping={project:string;chatGptProjectUrl:string;accountId:string};
type Job={id:string;project:string;taskId:string;title:string;trackerStatus:string;status:string;prompt:string;createdAt:string;
  updatedAt:string;conversationUrl?:string|null;blocker?:string|null;evidence?:string|null};
type Queue={mappings:Mapping[];jobs:Job[]};
const eligible=(status:string)=>["TODO","UNVERIFIED","IMPLEMENTED_UNVERIFIED","REOPENED"].includes(status);
async function api<T>(endpoint:string,token?:string,body?:unknown):Promise<T>{
  const response=await fetch("/mcp-admin/chatgpt-queue"+endpoint,{cache:"no-store",method:body?"POST":"GET",
    headers:body?{"Content-Type":"application/json",Authorization:"Bearer "+token}:{},
    body:body?JSON.stringify(body):undefined});
  const data=await response.json().catch(()=>null);
  if(!response.ok)throw new Error(data?.error||"HTTP "+response.status);
  return data as T;
}
export default function ChatGptQueuePanel({projects}:{projects:Project[]}){
  const [queue,setQueue]=useState<Queue>({mappings:[],jobs:[]});
  const [projectChoice,setProjectChoice]=useState("");
  const [selected,setSelected]=useState<string[]>([]);
  const [projectUrl,setProjectUrl]=useState("");
  const [accountId,setAccountId]=useState("");
  const [token,setToken]=useState("");
  const [evidence,setEvidence]=useState("");
  const [chatUrl,setChatUrl]=useState("");
  const [activeJob,setActiveJob]=useState<string|null>(null);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [showPrompt,setShowPrompt]=useState<string|null>(null);
  const project=projectChoice||queue.jobs.find(j=>j.status!=="ARCHIVED")?.project||projects.find(p=>!p.project.startsWith("_")&&p.tasks?.some(t=>t.id&&eligible(t.status)))?.project||"";
  const backlog=useMemo(()=>projects.find(p=>p.project===project)?.tasks||[],[project,projects]);
  const readyTasks=backlog.filter(t=>t.id&&eligible(t.status)&&t.acceptanceStatus!=="DONE_CLAIM_UNVERIFIED");
  const existing=new Set(queue.jobs.filter(j=>j.status!=="ARCHIVED"&&j.project===project).map(j=>j.taskId));
  const candidates=readyTasks.filter(t=>!existing.has(t.id!));
  const mapping=queue.mappings.find(m=>m.project===project);
  const byProject=queue.jobs.filter(j=>j.project===project);
  const current=queue.jobs.find(j=>j.id===activeJob);
  const refresh=useCallback(async()=>{try{setQueue(await api<Queue>(""));setError("");}catch(e){setError(String(e));}},[]);
  useEffect(()=>{const timeout=setTimeout(()=>void refresh(),0);return()=>clearTimeout(timeout);},[refresh]);
  const run=async(action:()=>Promise<void>)=>{
    setBusy(true);setError("");setMessage("");
    try{await action();await refresh();}catch(e){setError(String(e));}finally{setBusy(false);}
  };
  const switchProject=(name:string)=>{setProjectChoice(name);setSelected([]);setProjectUrl("");setAccountId("");setActiveJob(null);};
  const mutate=async(job:Job,action:string,extra?:{conversationUrl?:string;evidence?:string})=>{
    await run(async()=>{
      await api<Queue>("/jobs/"+encodeURIComponent(job.id),token,{action,...extra});
      setMessage(job.taskId+" → "+action+" recorded (not QA accepted).");
    });
  };
  const mappingUrl=projectUrl||mapping?.chatGptProjectUrl||"";
  const mappingAccount=accountId||mapping?.accountId||"";
  const openChat=(job:Job)=>{
    const target=queue.mappings.find(m=>m.project===job.project);
    if(!target){setError("MISSING_CHATGPT_PROJECT_MAPPING: map project before dispatch.");return;}
    if(job.status!=="READY_TO_DISPATCH"){setError("Prepare the job before opening the project.");return;}
    setActiveJob(job.id);
    setShowPrompt(job.id);
    window.open(target.chatGptProjectUrl,"_blank","noopener,noreferrer");
    setMessage("Opened mapped ChatGPT Project. Verify the project title and click New Chat inside it. Copy/paste prompt; then save real conversation URL.");
  };
  const copyPrompt=async(text:string)=>{
    try{await navigator.clipboard.writeText(text);setMessage("Copied task prompt.");}
    catch{setError("Clipboard unavailable; select the prompt text manually.");}
  };
  const counts=useMemo(()=>queue.jobs.reduce<Record<string,number>>((acc,j)=>{acc[j.status]=(acc[j.status]||0)+1;return acc;},{}),[queue.jobs]);
  return <div className={styles.page}>
    <section className={styles.intro}>
      <div><span>CHATGPT WEB / PROJECT-SCOPED TASK QUEUE</span><h2>Project Queue</h2>
        <p>Backlog từ TASKS.md chỉ là danh sách nguồn. Chọn task để enqueue; mỗi job cần mapping đúng ChatGPT Project và profile. Không dùng OpenAI API; không coi câu trả lời ChatGPT là bằng chứng nghiệm thu.</p></div>
      <button disabled={busy} onClick={()=>void refresh()}>Refresh queue</button>
    </section>
    <div className={styles.stats}>
      {["QUEUED","READY_TO_DISPATCH","WAITING_RESULT","NEEDS_QA","BLOCKED","ARCHIVED"].map(s=><div key={s}><small>{s.replaceAll("_"," ")}</small><strong>{counts[s]||0}</strong></div>)}
    </div>
    <section className={styles.layout}>
      <div className={styles.stack}>
        <article className={styles.panel}>
          <div className={styles.title}><h3>1. Project & profile mapping</h3><span>Verified URL required</span></div>
          <div className={styles.content}>
            <label>Workspace project
              <select value={project} onChange={e=>switchProject(e.target.value)}>{projects.filter(p=>!p.project.startsWith("_")).map(p=><option key={p.project} value={p.project}>{p.project} ({p.tasks?.filter(t=>eligible(t.status)).length||0} pending)</option>)}</select>
            </label>
            <label>ChatGPT Project URL<input placeholder="https://chatgpt.com/g/g-p-…/project" value={mappingUrl} onChange={e=>setProjectUrl(e.target.value)}/></label>
            <label>Playwright account ID<input value={mappingAccount} onChange={e=>setAccountId(e.target.value)} placeholder="Existing registered account ID"/></label>
            <label>Gateway Bearer key (kept in memory only)<input type="password" autoComplete="off" value={token} onChange={e=>setToken(e.target.value)} placeholder="EXECUTION_EVENT_API_KEY"/></label>
            <button disabled={busy||!project||!token.trim()||!mappingUrl||!mappingAccount} onClick={()=>void run(async()=>{
              await api<Queue>("/mappings",token,{project,chatGptProjectUrl:mappingUrl,accountId:mappingAccount});
              setMessage("Saved mapping. Profile login and project membership still require browser verification.");
            })}>Save project mapping</button>
          </div>
        </article>
        <article className={styles.panel}>
          <div className={styles.title}><h3>2. Import backlog</h3><span>{candidates.length} eligible, not yet queued</span></div>
          <div className={styles.content}>
            <p className={styles.help}>Chỉ nhập TODO / UNVERIFIED / REOPENED. Không import task đang RUNNING, BLOCKED, không có ID hoặc đã DONE. Mỗi lần tối đa 40 task.</p>
            <div className={styles.candidates}>
              {candidates.slice(0,60).map(t=><label key={t.id} className={styles.check}><input type="checkbox" checked={selected.includes(t.id!)} onChange={e=>setSelected(old=>e.target.checked?[...old,t.id!]:old.filter(x=>x!==t.id))}/>
                <span><strong>{t.id}</strong><small>{t.title} · {t.status}</small></span>
              </label>)}
              {candidates.length===0&&<p>No eligible task, or this project is already queued.</p>}
            </div>
            <div className={styles.actions}>
              <button type="button" disabled={!candidates.length} onClick={()=>setSelected(candidates.slice(0,40).map(t=>t.id!))}>Select first 40</button>
              <button type="button" onClick={()=>setSelected([])}>Clear</button>
              <button disabled={busy||selected.length===0||selected.length>40||!token.trim()} onClick={()=>void run(async()=>{
                await api<Queue>("/import",token,{project,taskIds:selected});
                setSelected([]);setMessage("Imported tasks into durable queue; nothing has been posted to ChatGPT.");
              })}>Enqueue {selected.length} tasks</button>
            </div>
          </div>
        </article>
      </div>
      <article className={styles.panel}>
        <div className={styles.title}><h3>3. Queue for {project||"selected project"}</h3><span>{byProject.length} jobs</span></div>
        <div className={styles.content}>
          {byProject.map(job=><div key={job.id} className={styles.job}>
            <div className={styles.jobTop}><strong>{job.taskId} — {job.title}</strong><span>{job.status}</span></div>
            <small>Source: {job.trackerStatus} · {new Date(job.updatedAt).toLocaleString("vi-VN")}</small>
            {job.blocker&&<p className={styles.problem}>Blocker: {job.blocker}</p>}
            {job.conversationUrl&&<a href={job.conversationUrl} target="_blank" rel="noreferrer">Open conversation ↗</a>}
            <div className={styles.actions}>
              {job.status==="QUEUED"&&<button disabled={busy||!token.trim()} onClick={()=>void mutate(job,"prepare")}>Prepare</button>}
              {job.status==="READY_TO_DISPATCH"&&<button disabled={busy} onClick={()=>openChat(job)}>Open mapped ChatGPT Project</button>}
              <button onClick={()=>setShowPrompt(showPrompt===job.id?null:job.id)}>Prompt</button>
              {["QUEUED","READY_TO_DISPATCH","WAITING_RESULT","NEEDS_QA"].includes(job.status)&&<button disabled={busy||!token.trim()} onClick={()=>{setActiveJob(job.id);setEvidence("");setChatUrl(job.conversationUrl||"");}}>Update</button>}
              {job.status==="BLOCKED"&&<button disabled={busy||!token.trim()} onClick={()=>void mutate(job,"retry")}>Requeue</button>}
            </div>
            {showPrompt===job.id&&<div className={styles.prompt}><pre>{job.prompt}</pre><button onClick={()=>void copyPrompt(job.prompt)}>Copy prompt</button></div>}
            {activeJob===job.id&&<div className={styles.update}>
              {job.status==="READY_TO_DISPATCH"&&<>
                <label>Conversation URL after sending prompt<input value={chatUrl} onChange={e=>setChatUrl(e.target.value)} placeholder="https://chatgpt.com/c/…"/></label>
                <button disabled={busy||!token.trim()||!chatUrl} onClick={()=>void mutate(job,"dispatched",{conversationUrl:chatUrl})}>Confirm ChatGPT chat URL</button>
              </>}
              {job.status==="WAITING_RESULT"&&<>
                <label>Evidence / actual response summary<textarea value={evidence} onChange={e=>setEvidence(e.target.value)} placeholder="Include output links, source SHA, tests, blocker..."/></label>
                <button disabled={busy||!token.trim()||!evidence.trim()} onClick={()=>void mutate(job,"review",{evidence})}>Send to QA</button>
              </>}
              {["QUEUED","READY_TO_DISPATCH","WAITING_RESULT","NEEDS_QA"].includes(job.status)&&<>
                <label>Blocker reason (required)<textarea value={evidence} onChange={e=>setEvidence(e.target.value)} placeholder="MISSING_PROJECT, LOGIN_REQUIRED, RATE_LIMIT, TEST_FAILED..."/></label>
                <button disabled={busy||!token.trim()||!evidence.trim()} onClick={()=>void mutate(job,"block",{evidence})}>Block task</button>
              </>}
              {["QUEUED","BLOCKED","NEEDS_QA"].includes(job.status)&&<>
                <label>Archive reason<input value={evidence} onChange={e=>setEvidence(e.target.value)}/></label>
                <button disabled={busy||!token.trim()||!evidence.trim()} onClick={()=>void mutate(job,"archive",{evidence})}>Archive with reason</button>
              </>}
            </div>}
          </div>)}
          {byProject.length===0&&<p className={styles.help}>Queue is empty. Import selected eligible task IDs from the left panel.</p>}
        </div>
      </article>
    </section>
    {error&&<p className={styles.error} role="alert">{error}</p>}
    {message&&<p className={styles.message} role="status">{message}</p>}
    <p className={styles.help}>Execution gate: hiện tại nút Open Project mở đúng Project đã mapping và prompt được copy thủ công. Tự động New Chat → gửi prompt → chờ phản hồi bằng Playwright chưa được kích hoạt; không tự động giả định ChatGPT đã hoàn tất task.</p>
  </div>;
}
