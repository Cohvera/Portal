import {BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit, Param, Post, Query, Res} from '@nestjs/common';
import type {Response} from 'express';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {prisma} from '@cohvera/database';
import {context,membership} from '../auth/context';
import {publicOrigin} from '../auth/config';
import {importTeamleaderProjects} from './teamleader';
import {detectProjectMode,exchangeToken,fetchTeamleaderProjects,openToken,ProjectMode,remoteJson,teamleaderApi,TeamleaderRemoteError,teamleaderSettings} from './teamleader-client';
const COMPANY='QHOME', INTERVAL=15*60000, LEASE=12*60000;
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
const idle=(now:Date)=>({OR:[{leaseUntil:null},{leaseUntil:{lte:now}}]});
function checkCompany(code:string,write=false) {
  if(code!==COMPANY) throw new ForbiddenException('Deze Teamleader-koppeling is alleen beschikbaar voor QHOME.');
  membership(code,write?'projects.manage':'projects.read');
}

@Injectable()
export class TeamleaderScheduler implements OnModuleInit,OnModuleDestroy {
  private timer?:NodeJS.Timeout;
  private checking=false;
  private readonly logger=new Logger(TeamleaderScheduler.name);
  onModuleInit(){this.timer=setInterval(()=>void this.tick(),30000);this.timer.unref();}
  onModuleDestroy(){if(this.timer)clearInterval(this.timer);}
  async tick(){
    if(this.checking)return;
    try {teamleaderSettings();} catch {return;} // Optional integration: other syncs start normally without configuration.
    this.checking=true;
    try {
      const row=await prisma.teamleaderConnection.findUnique({where:{companyCode:COMPANY}});
      if(row?.accessToken && row.nextSyncAt && row.nextSyncAt<=new Date()) await this.start(false);
    } catch {this.logger.warn('Teamleader-planner kon niet controleren. Controleer de database en migraties.');}
    finally {this.checking=false;}
  }
  async start(manual=true){
    teamleaderSettings();
    const company=await prisma.company.findUnique({where:{code:COMPANY},select:{isActive:true}});
    if(!company?.isActive)throw new ForbiddenException('QHOME is niet actief.');
    const now=new Date(),leaseId=randomUUID();
    const claimed=await prisma.teamleaderConnection.updateMany({where:{companyCode:COMPANY,accessToken:{not:null},...idle(now),...(manual?{}:{nextSyncAt:{lte:now}})},data:{leaseId,leaseUntil:new Date(now.getTime()+LEASE),lastAttemptAt:now,nextSyncAt:new Date(now.getTime()+INTERVAL)}});
    if(!claimed.count){if(manual)throw new ConflictException('Verbind eerst met Teamleader of wacht tot de lopende synchronisatie klaar is.');return;}
    void this.run(leaseId,now).catch(()=>this.logger.error('Teamleader-synchronisatie kon het resultaat niet opslaan. De planner probeert later opnieuw.'));
    return {accepted:true};
  }
  private async run(leaseId:string,started:Date){
    let count:number|null=null,error:string|null=null;
    try {
      let row=await prisma.teamleaderConnection.findUniqueOrThrow({where:{companyCode:COMPANY}});
      if(row.leaseId!==leaseId || !row.accessToken || !row.refreshToken)throw new Error('lease');
      if(row.mode!=='legacy' && row.mode!=='v2')throw new Error('mode');
      const post=async(endpoint:string,body:unknown)=>{
        if(Date.now()-started.getTime()>8*60000)throw new TeamleaderRemoteError('Synchronisatie duurde te lang; vorige import blijft behouden.');
        if(!row.expiresAt || row.expiresAt<=new Date()) {
          const tokens=await exchangeToken({grant_type:'refresh_token',refresh_token:openToken(row.refreshToken!)});
          const saved=await prisma.teamleaderConnection.updateMany({where:{companyCode:COMPANY,leaseId},data:tokens});
          if(!saved.count)throw new Error('lease');
          row={...row,...tokens};
        }
        return remoteJson(teamleaderApi+'/'+endpoint,{method:'POST',headers:{Authorization:'Bearer '+openToken(row.accessToken!), 'Content-Type':'application/json'},body:JSON.stringify(body)});
      };
      const detectedMode=await detectProjectMode(post);
      if(detectedMode!==row.mode) {
        const existing=await prisma.project.count({where:{externalSource:'TEAMLEADER',company:{code:COMPANY}}});
        if(existing || row.lastSuccessAt)throw new TeamleaderRemoteError('Teamleader gebruikt een andere projectmodule dan de bestaande import. Migreer eerst de projectkoppelingen; er is niets gewijzigd.');
        const saved=await prisma.teamleaderConnection.updateMany({where:{companyCode:COMPANY,leaseId},data:{mode:detectedMode}});
        if(!saved.count)throw new Error('lease');
        row={...row,mode:detectedMode};
      }
      const snapshot=await fetchTeamleaderProjects(row.mode as ProjectMode,post,started.getTime());
      const current=await prisma.teamleaderConnection.findUniqueOrThrow({where:{companyCode:COMPANY}});
      if(current.leaseId!==leaseId || !current.leaseUntil || current.leaseUntil<=new Date())throw new Error('lease');
      count=(await importTeamleaderProjects(COMPANY,snapshot)).projectCount;
    } catch(e) {
      error=e instanceof TeamleaderRemoteError?e.message:'Synchronisatie mislukt. Controleer de Teamleader-configuratie, projectgegevens en database; de vorige import blijft behouden.';
    }
    const finished=new Date();
    await prisma.$transaction(async tx=>{
      const updated=await tx.teamleaderConnection.updateMany({where:{companyCode:COMPANY,leaseId},data:{leaseId:null,leaseUntil:null,lastError:error,nextSyncAt:new Date(finished.getTime()+INTERVAL),...(error?{}:{lastSuccessAt:finished,projectCount:count!})}});
      if(updated.count)await tx.teamleaderSyncRun.create({data:{companyCode:COMPANY,startedAt:started,finishedAt:finished,projectCount:count,error}});
      await tx.teamleaderSyncRun.deleteMany({where:{companyCode:COMPANY,finishedAt:{lt:new Date(finished.getTime()-30*86400000)}}});
    });
  }
}

@Controller('companies/:companyCode/middleware/teamleader')
export class TeamleaderDirectController {
  constructor(@Inject(TeamleaderScheduler) private readonly scheduler:TeamleaderScheduler){}
  @Get()
  async status(@Param('companyCode')code:string){
    checkCompany(code);
    let configured=true;try{teamleaderSettings();}catch{configured=false;}
    const [row,runs]=await Promise.all([prisma.teamleaderConnection.findUnique({where:{companyCode:code}}),prisma.teamleaderSyncRun.findMany({where:{companyCode:code},orderBy:{finishedAt:'desc'},take:30})]);
    // Explicit response allowlist; encrypted credentials and OAuth state never leave the API.
    return {configured,connected:!!row?.accessToken,mode:row?.mode??null,running:!!row?.leaseUntil&&row.leaseUntil>new Date(),connectedAt:row?.connectedAt??null,lastAttemptAt:row?.lastAttemptAt??null,lastSuccessAt:row?.lastSuccessAt??null,nextSyncAt:row?.nextSyncAt??null,lastError:row?.lastError??null,projectCount:row?.projectCount??0,intervalMinutes:15,callbackUrl:publicOrigin()+'/api/companies/QHOME/middleware/teamleader/callback',runs};
  }
  @Post('connect')
  async connect(@Param('companyCode')code:string,@Body()body:{mode?:unknown}){
    checkCompany(code,true);
    if(body?.mode!=='legacy' && body?.mode!=='v2')throw new BadRequestException('Kies de klassieke of nieuwe projectmodule.');
    const settings=teamleaderSettings(),now=new Date(),state=randomBytes(32).toString('base64url');
    await prisma.teamleaderConnection.upsert({where:{companyCode:code},create:{companyCode:code,mode:body.mode},update:{}});
    const row=await prisma.teamleaderConnection.findUniqueOrThrow({where:{companyCode:code}});
    if(row.mode!==body.mode && (row.connectedAt || await prisma.project.count({where:{externalSource:'TEAMLEADER',company:{code}}})))throw new ConflictException('Deze koppeling gebruikte een andere projectmodule. Migreer eerst de bestaande projectkoppelingen.');
    const updated=await prisma.teamleaderConnection.updateMany({where:{companyCode:code,...idle(now)},data:{mode:body.mode,stateHash:hash(state),stateActorId:context().actor.id,stateExpiresAt:new Date(now.getTime()+10*60000)}});
    if(!updated.count)throw new ConflictException('Wacht tot de lopende synchronisatie klaar is.');
    const url=new URL('https://focus.teamleader.eu/oauth2/authorize');
    url.search=new URLSearchParams({client_id:settings.clientId,response_type:'code',redirect_uri:settings.redirect,state}).toString();
    return {url:url.href};
  }
  @Get('callback')
  async callback(@Param('companyCode')code:string,@Query('state')state:unknown,@Query('code')authCode:unknown,@Query('error')denied:unknown,@Res()res:Response){
    checkCompany(code,true);
    if(typeof state!=='string' || !/^[A-Za-z0-9_-]{43}$/.test(state))throw new BadRequestException('Ongeldige Teamleader-aanmelding.');
    const now=new Date(),leaseId=randomUUID();
    const claimed=await prisma.teamleaderConnection.updateMany({where:{companyCode:code,stateHash:hash(state),stateActorId:context().actor.id,stateExpiresAt:{gt:now},...idle(now)},data:{stateHash:null,stateActorId:null,stateExpiresAt:null,leaseId,leaseUntil:new Date(now.getTime()+LEASE)}});
    if(!claimed.count)throw new BadRequestException('Deze aanmelding is verlopen, al gebruikt of er loopt een synchronisatie. Verbind opnieuw vanuit Middleware.');
    let result='connected';
    try {
      if(denied || typeof authCode!=='string' || !authCode || authCode.length>4096)throw new TeamleaderRemoteError('Teamleader-aanmelding geannuleerd of geweigerd.');
      const tokens=await exchangeToken({grant_type:'authorization_code',code:authCode,redirect_uri:teamleaderSettings().redirect});
      await prisma.teamleaderConnection.updateMany({where:{companyCode:code,leaseId},data:{...tokens,connectedAt:new Date(),nextSyncAt:new Date(),lastError:null,leaseId:null,leaseUntil:null}});
    }catch{
      result='failed';
      await prisma.teamleaderConnection.updateMany({where:{companyCode:code,leaseId},data:{leaseId:null,leaseUntil:null,lastError:'Teamleader verbinden is niet gelukt. Controleer de clientgegevens en probeer opnieuw.'}});
    }
    return res.redirect(303,publicOrigin()+'/tools/middleware/teamleader?connection='+result);
  }
  @Post('sync')
  async sync(@Param('companyCode')code:string){checkCompany(code,true);return this.scheduler.start();}
  @Post('disconnect')
  async disconnect(@Param('companyCode')code:string){
    checkCompany(code,true);
    const now=new Date();
    const row=await prisma.teamleaderConnection.findUnique({where:{companyCode:code}});
    if(!row)return {disconnected:true};
    const updated=await prisma.teamleaderConnection.updateMany({where:{companyCode:code,...idle(now)},data:{accessToken:null,refreshToken:null,expiresAt:null,stateHash:null,stateActorId:null,stateExpiresAt:null,nextSyncAt:null,lastError:null}});
    if(!updated.count)throw new ConflictException('Wacht tot de lopende synchronisatie klaar is.');
    return {disconnected:true};
  }
}
