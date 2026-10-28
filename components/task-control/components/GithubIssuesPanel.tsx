"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "../styles/github-issues.module.css";

type Issue = { number:number; title:string; state?:string; comments?:number; updated_at?:string; body?:string };
type Comment = { id:number; body:string; html_url?:string; created_at?:string; user?:{login?:string} };
type Commit = { sha:string; html_url?:string; commit?:{message?:string;author?:{date?:string}} };
type Tag = { name:string; commit?:{sha?:string} };
type IssueList = { issues?:Issue[]; totalCount?:number; pageInfo?:{hasNextPage?:boolean;endCursor?:string} };
type TaskSourceCheck = {status:string;sourceVerified:boolean;writerAdmitted:boolean;qualityStatus:string;branchHeadSha:string;issueUrl:string;blocker?:string|null;checkedAt:string};

const safeName = (v:string) => /^[a-zA-Z0-9_.-]{1,100}$/.test(v) && !v.includes("..");
function date(value?:string){return value?new Date(value).toLocaleString("vi-VN"):"—";}
async function readJson<T>(path:string,options?:RequestInit):Promise<T>{
  const response=await fetch("/mcp-admin/github"+path,{cache:"no-store",...options});
  const data:unknown=await response.json().catch(()=>null);
  if(!response.ok)throw new Error((data as {error?:string}|null)?.error||`HTTP ${response.status}`);
  if(typeof data==="object" && data!==null && "message" in data)throw new Error(String((data as {message:unknown}).message));
  return data as T;
}
export default function GithubIssuesPanel(){
  const [owner,setOwner]=useState("hieugc");
  const [repo,setRepo]=useState("cad-agent-platform");
  const [target,setTarget]=useState({owner:"hieugc",repo:"cad-agent-platform"});
  const [branch,setBranch]=useState("");
  const [issueState,setIssueState]=useState<"OPEN"|"CLOSED">("OPEN");
  const [nextCursor,setNextCursor]=useState("");
  const [issues,setIssues]=useState<Issue[]>([]);
  const [commits,setCommits]=useState<Commit[]>([]);
  const [tags,setTags]=useState<Tag[]>([]);
  const [issueNo,setIssueNo]=useState<number|null>(null);
  const [comments,setComments]=useState<Comment[]>([]);
  const [loading,setLoading]=useState(false);
  const [commentLoading,setCommentLoading]=useState(false);
  const [error,setError]=useState("");
  const [commentError,setCommentError]=useState("");
  const [content,setContent]=useState("");
  const [sourceSha,setSourceSha]=useState("");
  const [sourceBranch,setSourceBranch]=useState("");
  const [versionTag,setVersionTag]=useState("");
  const [checkpoint,setCheckpoint]=useState("IMPLEMENTED_UNVERIFIED");
  const [adminKey,setAdminKey]=useState("");
  const [confirmed,setConfirmed]=useState("");
  const [taskProject,setTaskProject]=useState("");
  const [taskId,setTaskId]=useState("");
  const [taskIssue,setTaskIssue]=useState("");
  const [taskBranch,setTaskBranch]=useState("");
  const [taskBaseSha,setTaskBaseSha]=useState("");
  const [checkingSource,setCheckingSource]=useState(false);
  const [sourceResult,setSourceResult]=useState<TaskSourceCheck|null>(null);
  const [sourceError,setSourceError]=useState("");

  const reload=useCallback(async (active:{owner:string;repo:string},requestedBranch:string,requestedState:"OPEN"|"CLOSED")=>{
    setLoading(true);setError("");
    const p=`?owner=${encodeURIComponent(active.owner)}&repo=${encodeURIComponent(active.repo)}`;
    const branchQ=requestedBranch.trim()?`&branch=${encodeURIComponent(requestedBranch.trim())}`:"";
    const results=await Promise.allSettled([
      readJson<IssueList>("/issues"+p+`&state=${requestedState}`),
      readJson<Commit[]>("/commits"+p+branchQ),
      readJson<Tag[]>("/tags"+p)
    ]);
    const failures:string[]=[];
    if(results[0].status==="fulfilled"){
      setIssues(results[0].value.issues||[]);
      setNextCursor(results[0].value.pageInfo?.hasNextPage?results[0].value.pageInfo?.endCursor||"":"");
    } else {setIssues([]);setNextCursor("");failures.push("Issues: "+String(results[0].reason));}
    if(results[1].status==="fulfilled")setCommits(Array.isArray(results[1].value)?results[1].value:[]);
    else {setCommits([]);failures.push("Commits: "+String(results[1].reason));}
    if(results[2].status==="fulfilled")setTags(Array.isArray(results[2].value)?results[2].value:[]);
    else {setTags([]);failures.push("Tags: "+String(results[2].reason));}
    setError(failures.join(" | "));
    setLoading(false);
  },[]);

  useEffect(()=>{const id=setTimeout(()=>{void reload({owner:"hieugc",repo:"cad-agent-platform"},"","OPEN");},0);return ()=>clearTimeout(id);},[reload]);
  const loadMore=async()=>{
    if(!nextCursor||loading)return;
    setLoading(true);
    try{
      const q=`?owner=${encodeURIComponent(target.owner)}&repo=${encodeURIComponent(target.repo)}&state=${issueState}&after=${encodeURIComponent(nextCursor)}`;
      const data=await readJson<IssueList>("/issues"+q);
      setIssues(previous=>[...previous,...(data.issues||[]).filter(i=>!previous.some(p=>p.number===i.number))]);
      setNextCursor(data.pageInfo?.hasNextPage?data.pageInfo.endCursor||"":"");
    }catch(ex){setError(String(ex));}finally{setLoading(false);}
  };
  const selectIssue=async(number:number)=>{
    setIssueNo(number);setTaskIssue(String(number));setSourceResult(null);
    setComments([]);setCommentError("");setConfirmed("");
    try{
      const data=await readJson<Comment[]>(`/issues/${number}/comments?owner=${encodeURIComponent(target.owner)}&repo=${encodeURIComponent(target.repo)}`);
      setComments(Array.isArray(data)?data:[]);
    }catch(ex){setCommentError(String(ex));}
  };
  const checkTaskSource=async()=>{
    if(checkingSource)return;
    setCheckingSource(true);setSourceError("");setSourceResult(null);
    try {
      const params=new URLSearchParams({
        project:taskProject.trim(),taskId:taskId.trim(),
        owner:target.owner,repo:target.repo,issue:taskIssue.trim(),
        branch:taskBranch.trim(),baseSha:taskBaseSha.trim()
      });
      const response=await fetch("/mcp-admin/github/task-source-preflight?"+params.toString(),{cache:"no-store"});
      const data:unknown=await response.json().catch(()=>null);
      if(typeof data!=="object"||data===null)throw new Error("Invalid Gateway response.");
      if(response.status===409 && "status" in data && data.status==="BLOCKED"){
        setSourceResult(data as TaskSourceCheck);return;
      }
      if(!response.ok)throw new Error(("error" in data?String(data.error):"HTTP "+response.status));
      const result=data as TaskSourceCheck;
      if(result.writerAdmitted||result.qualityStatus==="ACCEPTED")
        throw new Error("Source preflight may not grant a writer lease or QA acceptance.");
      setSourceResult(result);
    }catch(ex){setSourceError(String(ex));}finally{setCheckingSource(false);}
  };
  const submit=async()=>{
    if(!issueNo||!content.trim()||commentLoading)return;
    setCommentLoading(true);setCommentError("");setConfirmed("");
    const lines=[
      `### Source checkpoint — ${checkpoint}`,
      `- Source SHA: ${sourceSha.trim()||"NOT_LINKED"}`,
      `- Branch: ${sourceBranch.trim()||"NOT_LINKED"}`,
      `- Release tag: ${versionTag.trim()||"NOT_TAGGED"}`,
      `- QA status: ${checkpoint}`,
      "",
      content.trim()
    ];
    try{
      await readJson<unknown>(`/issues/${issueNo}/comments?owner=${encodeURIComponent(target.owner)}&repo=${encodeURIComponent(target.repo)}`,{
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":`Bearer ${adminKey}`},
        body:JSON.stringify({body:lines.join("\n")})
      });
      setConfirmed("GitHub xác nhận đã lưu comment.");
      setContent("");
      await selectIssue(issueNo);
      setConfirmed("GitHub xác nhận đã lưu comment.");
    }catch(ex){setCommentError("Không xác nhận được việc ghi comment: "+String(ex));}
    finally{setCommentLoading(false);}
  };
  const activeIssue=issues.find(i=>i.number===issueNo);
  const latestReference=[...comments].reverse().find(c=>/Source SHA:\s*([0-9a-f]{7,40})/i.test(c.body));
  const reference=latestReference?.body.match(/Source SHA:\s*([0-9a-f]{7,40})/i)?.[1];
  const repoUrl=`https://github.com/${target.owner}/${target.repo}`;

  return <section className={styles.wrapper} aria-label="GitHub issue and source versions">
    <div className={styles.header}>
      <div><span>GITHUB / SOURCE PROVENANCE</span><h2>Issues, Comments & Versions</h2>
        <p>Commit SHA và Git tag xác định phiên bản source. Issue comments ghi checkpoint, liên kết bằng chứng và trạng thái QA; không tự đánh dấu DONE.</p></div>
      <a target="_blank" rel="noreferrer" href={repoUrl}>Open repository ↗</a>
    </div>
    <form className={styles.filters} onSubmit={e=>{e.preventDefault();if(!safeName(owner)||!safeName(repo)){setError("Invalid repository.");return;}setIssueNo(null);setComments([]);setTarget({owner,repo});void reload({owner,repo},branch,issueState);}}>
      <label>Owner<input aria-label="GitHub owner" value={owner} onChange={e=>setOwner(e.target.value)}/></label>
      <label>Repository<input aria-label="GitHub repository" value={repo} onChange={e=>setRepo(e.target.value)}/></label>
      <label>Branch (optional)<input aria-label="Git branch" value={branch} placeholder="Default branch" onChange={e=>setBranch(e.target.value)}/></label>
      <label>Issues<select aria-label="Issue state" value={issueState} onChange={e=>setIssueState(e.target.value as "OPEN"|"CLOSED")}><option value="OPEN">Open</option><option value="CLOSED">Closed</option></select></label>
      <button disabled={loading} type="submit">{loading?"Loading…":"Load GitHub"}</button>
    </form>
    {error&&<p className={styles.error} role="alert">{error}</p>}
    <section className={styles.sourcePreflight} aria-label="Task GitHub source preflight">
      <div className={styles.title}><h3>Task source preflight — read only</h3><span>No writer lease or QA acceptance</span></div>
      <p>Verify a manually identified issue, branch and exact full SHA against GitHub. A successful source read does not approve the task-to-issue mapping or allow execution.</p>
      <div className={styles.sourceForm}>
        <label>Project ID<input value={taskProject} onChange={e=>{setTaskProject(e.target.value);setSourceResult(null);}} placeholder="Project from Gateway"/></label>
        <label>Task ID<input value={taskId} onChange={e=>{setTaskId(e.target.value);setSourceResult(null);}} placeholder="Exact tracker ID"/></label>
        <label>Issue #<input inputMode="numeric" value={taskIssue} onChange={e=>{setTaskIssue(e.target.value);setSourceResult(null);}} placeholder="Issue number"/></label>
        <label>Branch<input value={taskBranch} onChange={e=>{setTaskBranch(e.target.value);setSourceResult(null);}} placeholder="Full branch name"/></label>
        <label>Base SHA (40 hex)<input value={taskBaseSha} onChange={e=>{setTaskBaseSha(e.target.value);setSourceResult(null);}} placeholder="Exact 40-character commit SHA"/></label>
        <button type="button" disabled={checkingSource||!taskProject.trim()||!taskId.trim()||!/^[1-9]\d*$/.test(taskIssue)||!taskBranch.trim()||!/^[a-fA-F0-9]{40}$/.test(taskBaseSha)}
          onClick={()=>void checkTaskSource()}>{checkingSource?"Checking GitHub…":"Verify source"}</button>
      </div>
      {sourceError&&<p className={styles.error} role="alert">{sourceError}</p>}
      {sourceResult&&<div role="status" className={styles.sourceResult}><strong>{sourceResult.status}</strong>
        <span>{sourceResult.blocker||"GitHub branch HEAD, commit and issue match. Task mapping, locks and quality gates remain unverified."}</span>
        <small>Head SHA: {sourceResult.branchHeadSha||"Unavailable"} · Writer admitted: NO · QA: {sourceResult.qualityStatus} · checked {date(sourceResult.checkedAt)}</small>
      </div>}
    </section>
    <div className={styles.columns}>
      <article className={styles.panel}>
        <div className={styles.title}><h3>Open issues</h3><span>{issues.length} loaded</span></div>
        <div className={styles.scroll}>{issues.map(issue=>
          <button type="button" key={issue.number} className={issueNo===issue.number?styles.activeIssue:styles.issue} onClick={()=>void selectIssue(issue.number)}>
            <strong>#{issue.number} — {issue.title}</strong><small>{issue.state||"OPEN"} · {issue.comments||0} comments · {date(issue.updated_at)}</small>
          </button>)}
          {!issues.length&&<p className={styles.empty}>Không có Issue hoặc GitHub MCP chưa trả dữ liệu.</p>}
          {nextCursor&&<button type="button" className={styles.more} disabled={loading} onClick={()=>void loadMore()}>Load more issues →</button>}
        </div>
      </article>
      <article className={styles.panel}>
        <div className={styles.title}><h3>{activeIssue?`#${activeIssue.number} Comments`:"Issue comments"}</h3>
          {activeIssue&&<a href={`${repoUrl}/issues/${activeIssue.number}`} target="_blank" rel="noreferrer">View on GitHub ↗</a>}</div>
        {reference&&<div className={styles.currentSource}>Latest documented SHA <a href={`${repoUrl}/commit/${reference}`} target="_blank" rel="noreferrer">{reference.slice(0,12)}</a> <small>Comment reference — not independently verified</small></div>}
        <div className={styles.comments}>{comments.map(c=><div key={c.id} className={styles.comment}>
          <div><b>{c.user?.login||"GitHub user"}</b><small>{date(c.created_at)}</small>{c.html_url&&<a href={c.html_url} target="_blank" rel="noreferrer">↗</a>}</div>
          <pre>{c.body}</pre>
        </div>)}{!comments.length&&<p className={styles.empty}>Chọn Issue để đọc bình luận.</p>}</div>
        {issueNo&&<div className={styles.compose}>
          <h4>Add source checkpoint comment</h4>
          <div className={styles.fields}>
            <label>Commit SHA<select value={sourceSha} onChange={e=>setSourceSha(e.target.value)}><option value="">Not linked</option>{commits.map(c=><option key={c.sha} value={c.sha}>{c.sha.slice(0,12)} — {(c.commit?.message||"").split("\n")[0].slice(0,58)}</option>)}</select></label>
            <label>Branch<input value={sourceBranch} onChange={e=>setSourceBranch(e.target.value)} placeholder="main / feature/*"/></label>
            <label>Tag<select value={versionTag} onChange={e=>setVersionTag(e.target.value)}><option value="">Not tagged</option>{tags.map(t=><option key={t.name} value={t.name}>{t.name}</option>)}</select></label>
            <label>QA<select value={checkpoint} onChange={e=>setCheckpoint(e.target.value)}><option>TODO</option><option>IN_PROGRESS</option><option>IMPLEMENTED_UNVERIFIED</option><option>BLOCKED</option><option>ACCEPTED</option></select></label>
          </div>
          <textarea aria-label="Checkpoint evidence and notes" placeholder="Changes, test results, links to CI / PR, blockers and next action…" value={content} maxLength={5200} onChange={e=>setContent(e.target.value)}/>
          <label>Write access key (session only)<input type="password" autoComplete="off" value={adminKey} onChange={e=>setAdminKey(e.target.value)} placeholder="GITHUB_ISSUE_ADMIN_KEY"/></label>
          <button disabled={commentLoading||!content.trim()||!adminKey.trim()} onClick={()=>void submit()} type="button">{commentLoading?"Posting…":"Post comment to GitHub"}</button>
          {commentError&&<p role="alert" className={styles.error}>{commentError}</p>}{confirmed&&<p role="status" className={styles.success}>{confirmed}</p>}
        </div>}
      </article>
      <article className={styles.panel}>
        <div className={styles.title}><h3>Source versions</h3><span>{commits.length} commits · {tags.length} tags</span></div>
        <div className={styles.scroll}><h4>Recent commits</h4>{commits.map(c=><div key={c.sha} className={styles.commit}>
          <a href={c.html_url||`${repoUrl}/commit/${c.sha}`} target="_blank" rel="noreferrer">{c.sha.slice(0,12)} ↗</a>
          <small>{date(c.commit?.author?.date)}</small><p>{(c.commit?.message||"").split("\n")[0]}</p>
          <button type="button" onClick={()=>setSourceSha(c.sha)}>Use in comment</button>
        </div>)}
        <h4>Release tags</h4>{tags.map(t=><div key={t.name} className={styles.tag}><a href={`${repoUrl}/releases/tag/${encodeURIComponent(t.name)}`} target="_blank" rel="noreferrer">{t.name} ↗</a><small>{t.commit?.sha?.slice(0,12)||"—"}</small></div>)}
        </div>
      </article>
    </div>
  </section>;
}
