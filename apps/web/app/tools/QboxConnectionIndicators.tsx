import type {connectionDiagnostics} from '../../lib/qbox-monitor';
import './qbox-connection-indicators.css';

export const pollLabels = {unknown:'Nog geen contact',healthy:'Qbox haalt aanvragen op',stale:'Geen recente controle',error:'Ophalen mislukt'};
export const hfsqlLabels = {unknown:'Nog geen resultaat',healthy:'HFSQL bereikbaar',stale:'Geen recente meting',error:'HFSQL-stap mislukt'};

type ConnectionStates = Pick<ReturnType<typeof connectionDiagnostics>, 'pollState' | 'hfsqlState'>;

export function QboxConnectionIndicators({pollState,hfsqlState,statusText}: ConnectionStates & {statusText?: string}) {
 const connections = [
  {name:'Portal ↔ Qbox',state:pollState,label:pollLabels[pollState]},
  {name:'Qbox → HFSQL',state:hfsqlState,label:hfsqlLabels[hfsqlState]},
 ];

 return <ul className="qbox-connection-indicators" aria-label="Verbindingsstatus">
  {connections.map(({name,state,label}) => <li key={name}>
   <span className={`qbox-status-dot qbox-status-dot-${state}`} aria-hidden="true"/>
   <div><strong>{name}</strong><small>{statusText ?? label}</small></div>
  </li>)}
 </ul>;
}
