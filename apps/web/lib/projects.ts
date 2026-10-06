"use client";
import { useCallback, useEffect, useState } from "react";
import { useCompany } from "../app/PortalShell";
export type Task = {id: string; projectId: string; title: string; description: string; assignee: string; priority: string; status: string; dueDate: string | null};
export type Project = {sourceDescription?: string | null; sourcePlannedAt?: string | null; sourceSeenAt?: string | null; sourceRecordId?: string | null; sourceStatusLabel?: string | null; sourceIsClosed?: boolean | null; sourceIsActive?: boolean | null; externalSource?: string | null; externalId?: string | null; id: string; name: string; customer: string; owner: string; status: string; statusColor: string; dueDate: string | null; tasks: Task[]};
export const projectStatuses: Record<string,string> = {Gepland:"#64748b",Actief:"#2563eb",Gepauzeerd:"#d97706",Afgerond:"#16834b"};
export const statuses: Record<string,string> = {TODO:"Te doen",IN_PROGRESS:"Bezig",BLOCKED:"Geblokkeerd",DONE:"Klaar"};
export const priorities: Record<string,string> = {LOW:"Laag",NORMAL:"Normaal",HIGH:"Hoog"};
export const members = ["Remko", "Milan", "Sofie", "Thomas"];
export const today = () => new Date().toLocaleDateString("sv-SE");
export const overdue = (task: Task) => task.status !== "DONE" && !!task.dueDate && task.dueDate.slice(0,10) < today();
export async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, {...init, headers:{"Content-Type":"application/json",...init?.headers}, cache:"no-store"});
  const data = await r.json().catch(()=>({}));
  if (!r.ok) throw new Error(data.message || `API-fout: ${r.status}`);
  return data;
}
export function useProjects() {
  const {companyCode} = useCompany();
  const [result,setResult] = useState<{code:string; projects:Project[]}>({code:"",projects:[]});
  const [error,setError] = useState("");
  const [loading,setLoading] = useState(true);
  const url = `/api/companies/${encodeURIComponent(companyCode)}/projects`;
  const refresh = useCallback(async () => {
    const projects = await request<Project[]>(url);
    setResult({code:companyCode,projects});
  },[url,companyCode]);
  useEffect(()=>{
    const controller = new AbortController();
    setLoading(true);setError("");
    request<Project[]>(url,{signal:controller.signal}).then(projects=>setResult({code:companyCode,projects})).catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[url,companyCode]);
  return {projects:result.code===companyCode?result.projects:[],error,setError,loading,refresh,url,companyCode};
}
