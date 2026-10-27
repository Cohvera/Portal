import {createCipheriv, createDecipheriv, randomBytes} from 'node:crypto';
import {ServiceUnavailableException} from '@nestjs/common';
import {publicOrigin} from '../auth/config';
import {validateTeamleader} from './teamleader';

export const teamleaderApi = 'https://api.focus.teamleader.eu';
export const teamleaderTokenUrl = 'https://focus.teamleader.eu/oauth2/access_token';
export type ProjectMode = 'legacy' | 'v2';
export function encryptionKey() {
  const hex=process.env.TEAMLEADER_TOKEN_ENCRYPTION_KEY || '';
  if(!/^[a-f0-9]{64}$/i.test(hex)) throw new ServiceUnavailableException('Teamleader: de versleutelingssleutel ontbreekt of is ongeldig.');
  return Buffer.from(hex,'hex');
}
export function sealToken(token:string) {
  const iv=randomBytes(12), cipher=createCipheriv('aes-256-gcm',encryptionKey(),iv);
  const body=Buffer.concat([cipher.update(token,'utf8'),cipher.final()]);
  return [iv,cipher.getAuthTag(),body].map(b=>b.toString('base64url')).join('.');
}
export function openToken(value:string) {
  try {
    const parts=value.split('.');
    if(parts.length!==3) throw new Error();
    const [iv,tag,body]=parts.map(p=>Buffer.from(p,'base64url'));
    const cipher=createDecipheriv('aes-256-gcm',encryptionKey(),iv);cipher.setAuthTag(tag);
    return Buffer.concat([cipher.update(body),cipher.final()]).toString('utf8');
  } catch {throw new ServiceUnavailableException('Teamleader-tokens kunnen niet worden ontsleuteld. Controleer de serversleutel.');}
}
export function teamleaderSettings() {
  const clientId=process.env.TEAMLEADER_CLIENT_ID, secret=process.env.TEAMLEADER_CLIENT_SECRET;
  if(!clientId || !secret) throw new ServiceUnavailableException('Vul eerst de Teamleader-clientgegevens op de Portal-server in.');
  encryptionKey();
  const origin=publicOrigin();
  if(new URL(origin).protocol!=='https:' && process.env.NODE_ENV==='production') throw new ServiceUnavailableException('Teamleader vereist een HTTPS Portal-adres.');
  return {clientId,secret,redirect:origin+'/api/companies/QHOME/middleware/teamleader/callback',origin};
}
// Do not include remote response bodies, request credentials or OAuth codes in logs.
export class TeamleaderRemoteError extends Error {}
export async function remoteJson(url:string, init:RequestInit) {
  let response:Response;
  try {response=await fetch(url,{...init,redirect:'error',signal:AbortSignal.timeout(45000)});}
  catch {throw new TeamleaderRemoteError('Teamleader is niet bereikbaar of antwoordt te traag.');}
  const path=new URL(url).pathname;
  const operation=path==='/projects.list'?'klassieke projecten':path==='/projects-v2/projects.list'?'nieuwe projecten':path==='/accounts.projects-v2-status'?'projectmodule controleren':'toegang vernieuwen';
  if(!response.ok) throw new TeamleaderRemoteError(response.status===429 ? 'Teamleader-limiet bereikt; de volgende automatische poging volgt over 15 minuten.' : `Teamleader antwoordt HTTP ${response.status} bij ${operation}. Controleer de verbinding en projectrechten.`);
  try {return await response.json();} catch {throw new TeamleaderRemoteError('Teamleader gaf een ongeldig antwoord.');}
}
export async function exchangeToken(parameters:Record<string,string>) {
  const settings=teamleaderSettings();
  const result=await remoteJson(teamleaderTokenUrl,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({...parameters,client_id:settings.clientId,client_secret:settings.secret})});
  if(!result || typeof result.access_token!=='string' || !result.access_token || typeof result.refresh_token!=='string' || !result.refresh_token || !Number.isFinite(result.expires_in) || result.expires_in<=60) throw new TeamleaderRemoteError('Teamleader gaf geen geldige toegangstokens terug. Verbind opnieuw.');
  return {accessToken:sealToken(result.access_token),refreshToken:sealToken(result.refresh_token),expiresAt:new Date(Date.now()+(result.expires_in-60)*1000)};
}
export async function fetchTeamleaderProjects(mode:ProjectMode, post:(endpoint:string,body:unknown)=>Promise<any>, now=Date.now()) {
  const projects:Record<string,unknown>[]=[],seen=new Set<string>();
  for(let page=1;page<=101;page++) {
    const response=await post(mode==='legacy'?'projects.list':'projects-v2/projects.list',{page:{size:100,number:page}});
    if(!response || !Array.isArray(response.data)) throw new TeamleaderRemoteError('Teamleader gaf geen projectlijst terug; import gestopt.');
    if(!response.data.length) {
      const snapshot={source:'TEAMLEADER',version:1,complete:true,mode,fetched_at:new Date(now).toISOString(),projects};
      validateTeamleader(snapshot);
      return snapshot;
    }
    if(page>100) throw new TeamleaderRemoteError('Meer dan 10000 projecten; export gestopt zonder import.');
    for(const row of response.data) {
      if(!row || typeof row.id!=='string' || seen.has(row.id)) throw new TeamleaderRemoteError('Ongeldige of dubbele project-ID; export gestopt.');
      seen.add(row.id);
      projects.push({id:row.id,name:row.title,status:row.status,reference:String((mode==='legacy'?row.reference:row.project_key)??''),description:row.description??'',start_date:(mode==='legacy'?row.starts_on:row.start_date)||null,deadline:(mode==='legacy'?row.due_on:row.end_date)||null});
    }
  }
  throw new TeamleaderRemoteError('Onvolledige export; niets geïmporteerd.');
}

export async function detectProjectMode(post:(endpoint:string,body:unknown)=>Promise<any>):Promise<ProjectMode> {
  const result=await post('accounts.projects-v2-status',{});
  if(result?.data?.status==='projects-v2')return 'v2';
  if(result?.data?.status==='legacy')return 'legacy';
  throw new TeamleaderRemoteError('Teamleader gaf geen herkenbare projectmodule terug; er is niets geïmporteerd.');
}
