"use client";

import {useEffect,useState} from "react";

/*
 * Purpose: Read-only Skill recommendations for a Task Control task detail.
 * Task: UPWORK-SKILL-101
 * Contract: Gateway catalog returns suggestions, never proof of actual execution.
 * Invariants: No raw instruction HTML, credentials, arbitrary local paths or fake selected/running states.
 * Failure: Missing backend presents explicit unavailable state; no silent fabricated skills.
 * Thread: Effect is cancelled on task change to prevent stale suggestions.
 */
type Suggested = {id:string;contentHash:string;collection:string;reason:string;score:number};
type Rejected = {id:string;reason:string};

/** Display only Gateway-selected metadata and clearly distinguish recommendation from execution. */
export default function SkillUsagePanel({taskId,title,project}:{taskId:string;title:string;project:string}){
  const [data,setData]=useState<{selected:Suggested[];rejected:Rejected[]}|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  useEffect(()=>{
    const abort=new AbortController();
    const params=new URLSearchParams({query:title+" "+taskId,projectKind:project});
    fetch("/mcp-admin/skills?"+params,{cache:"no-store",signal:abort.signal})
      .then(async r=>{if(!r.ok)throw Error("Skill service HTTP "+r.status);return r.json();})
      .then(j=>{if(!abort.signal.aborted){setData({selected:j.selected||[],rejected:j.rejected||[]});setError("");setLoading(false);}})
      .catch(e=>{if(!abort.signal.aborted){setData(null);setError(String(e));setLoading(false);}});
    return ()=>abort.abort();
  },[taskId,title,project]);
  return <section aria-label="Recommended agent skills" style={{display:"grid",gap:9,marginTop:16,padding:13,border:"1px solid #344762",borderRadius:12,minWidth:0}}>
    <strong>Skill suggestions <small style={{fontWeight:400,opacity:.75}}>— Not executed</small></strong>
    {loading&&<span role="status">Loading verified Skill catalog…</span>}
    {error&&<p role="status">Skill catalog unavailable: {error}. No Skill loaded or executed.</p>}
    {!loading&&!error&&data?.selected.length===0&&<p>No matching Skills. Nothing attached to this task.</p>}
    {data?.selected.map(skill=><div key={skill.id} style={{borderBottom:"1px solid #263247",paddingBottom:7,overflowWrap:"anywhere"}}>
      <strong>{skill.id}</strong><small style={{display:"block",opacity:.8}}>Collection: {skill.collection} · Suggested · Score {skill.score}</small>
      <span style={{display:"block"}}>{skill.reason||"Catalog match"}</span>
      <code style={{fontSize:11}}>SHA256 {skill.contentHash.slice(0,16)}…</code>
    </div>)}
    {!!data?.rejected.length&&<small>{data.rejected.length} candidates excluded by policy / budget.</small>}
    <small style={{opacity:.7}}>A suggestion is not proof an Agent read a Skill. Actual run provenance is recorded separately in Workflows.</small>
  </section>;
}
