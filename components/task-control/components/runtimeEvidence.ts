/*
 * Task Control only — evidence projections from existing Gateway /projects.
 * A tracker status, old runId or Git commit can never certify a live task lease.
 * No network writes or dispatch permissions are provided by this module.
 */
export type EvidenceTask = {id?:string|null;title?:string|null;status:string};
export type EvidenceProject = {
  project:string; status:string; tasks?:EvidenceTask[]; runtimeSource?:string;
  taskId?:string|null; runId?:string|null; heartbeatAt?:string|null;
  runner?:string|null; eventCount?:number|null;
};

export type ProjectExecutionEvidence = {
  project:string; source:string; declaredActive:EvidenceTask[]; liveRunId:string|null;
  hasFreshRun:boolean; leaseStatus:"NOT_EXPOSED"; heartbeatAt:string|null;
  runner:string|null; taskIds:string[];
};

export type TaskSourceCollision = {taskId:string; projects:string[]};

export function isVerifiedActiveRun(project:EvidenceProject, now:number):boolean {
  if(project.runtimeSource!=="execution_events" || !project.runId ||
      project.status!=="RUNNING" || !project.heartbeatAt || !Number.isFinite(now)) return false;
  const heartbeat=Date.parse(project.heartbeatAt);
  // Invalid, future and expired timestamps must never create a false live worker.
  return Number.isFinite(heartbeat) && heartbeat<=now && now-heartbeat<120_000;
}

export function summarizeExecutionEvidence(projects:EvidenceProject[], now:number){
  const rows:ProjectExecutionEvidence[]=projects.map(project=>{
    const active=(project.tasks||[]).filter(task=>["IN_PROGRESS","RUNNING"].includes(task.status));
    const fresh=isVerifiedActiveRun(project,now);
    return {
      project:project.project,source:project.runtimeSource||"UNAVAILABLE",
      declaredActive:active,liveRunId:fresh?project.runId!:null,
      hasFreshRun:fresh,leaseStatus:"NOT_EXPOSED" as const,
      heartbeatAt:fresh?project.heartbeatAt!:null,runner:fresh?project.runner||null:null,
      taskIds:[...new Set((project.tasks||[]).map(t=>t.id).filter((id):id is string=>Boolean(id)))],
    };
  });
  const taskOwners=new Map<string,Set<string>>();
  for(const row of rows) for(const id of row.taskIds){
    const group=taskOwners.get(id)||new Set<string>();
    group.add(row.project);taskOwners.set(id,group);
  }
  const duplicates:TaskSourceCollision[]=[...taskOwners.entries()]
    .filter(([,owners])=>owners.size>1)
    .map(([taskId,owners])=>({taskId,projects:[...owners].sort()}))
    .sort((a,b)=>b.projects.length-a.projects.length||a.taskId.localeCompare(b.taskId));
  return {
    rows,
    verifiedRunCount:rows.filter(x=>x.hasFreshRun).length,
    reportedActiveTasks:rows.reduce((sum,x)=>sum+x.declaredActive.length,0),
    trackerOnlyProjects:rows.filter(x=>x.declaredActive.length&&!x.hasFreshRun),
    duplicates,
    // This API does not expose an atomic leaseId, owner epoch or expiry. None verified.
    verifiedLeaseCount:0,
  };
}
