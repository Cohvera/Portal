import {eventLink,failurePhases,type ReaderEvent} from './qbox-monitor';

type RecoveryStep = {text:string;command?:string};

const localJournal: RecoveryStep = {
 text:'Zoek op de Qbox naar de eerste foutregel bij het tijdstip van deze poging.',
 command:'sudo journalctl -u cohvera-reader-sync.service -u cohvera-reader-command.service -n 100 --no-pager',
};
const localStatus: RecoveryStep = {text:'Bekijk welke stap en code de reader lokaal heeft bewaard.',command:'sudo ./plenion.sh debug'};
const checkConfigurationOwner: RecoveryStep = {
 text:'Als de fout over connection.json gaat, controleer in de installatiemap wie eigenaar is van de map en het bestand.',
 command:"sudo stat -c '%a %U:%G %n' data data/connection.json",
};
const configureConnection: RecoveryStep = {
 text:'Voer de HFSQL-configuratie uit in een shell als loxberry, zonder sudo. Test daarna de verbinding.',
 command:'./plenion.sh configure\nsudo ./plenion.sh test',
};
const portalApiLogs: RecoveryStep = {
 text:'Zoek op de Portal-server in de API-log rond het tijdstip van de fout. Gebruik daarvoor het volledige poging-ID uit deze melding.',
 command:'docker compose logs --since 24h api',
};
const hfSqlTcpTest: RecoveryStep = {
 text:'Test vanaf de Qbox met het ingestelde HFSQL-adres en de ingestelde poort. Vervang HFSQL_IP en zo nodig 4900.',
 command:'nc -vz -w 3 HFSQL_IP 4900',
};
const hfsqlPortRecovery: RecoveryStep[] = [hfSqlTcpTest,
 {text:'Krijg je Connection refused, kijk op de replicahost of de HFSQL-service actief is en op deze poort luistert. Bij Docker controleer je ook de gepubliceerde hostpoort.'},
];
const hfsqlRouteRecovery: RecoveryStep[] = [
 {text:'Controleer vanaf de Qbox welke route naar het ingestelde HFSQL-IP wordt gebruikt. Test daarna de poort en bekijk de buurstatus op het LAN.',
  command:'ip route get HFSQL_IP\nnc -vz -w 3 HFSQL_IP 4900\nip neigh show to HFSQL_IP'},
 {text:'Bij INCOMPLETE of FAILED op een rechtstreekse LAN-route controleer je of de replicahost online is, nog hetzelfde IP heeft en op het juiste VLAN zit.'},
];
const hfsqlTimeoutRecovery: RecoveryStep[] = [hfSqlTcpTest,
 {text:'Time-out op de poort? Controleer netwerk en firewall tussen Qbox en replica. Slaagt TCP wel, kijk dan in HFSQL Control Center naar serverbelasting en trage leesbewerkingen rond het tijdstip van de fout.'},
 localJournal,
];
const hfsqlLoginRecovery: RecoveryStep[] = [
 {text:'Open in HFSQL Control Center dezelfde host, poort en database met het account van de replica. Controleer of dat account kan aanmelden en PROJ kan lezen.'},
 {text:'Lukt dat in Control Center? Neem die werkende instellingen over in de reader.'}, configureConnection,
];
const hfsqlSchemaRecovery: RecoveryStep[] = [
 {text:'Controleer de exacte databasenaam en of PROJ en WERK op de ingestelde replica aanwezig en leesbaar zijn voor het readeraccount.'},
 {text:'Lees de PROJ-kolommen opnieuw uit. Vergelijk ze met Extra gegevens in de Plenion-connector en verwijder ontbrekende opties uit de selectie.',command:'sudo ./plenion.sh columns'},
];
const hfsqlDriverRecovery: RecoveryStep[] = [
 {text:'Test op de Qbox of de geïnstalleerde reader-image en de HFSQL-driver kunnen starten. Werk de standalone reader bij als de driver of image ontbreekt.',command:'sudo ./plenion.sh check'},
 localJournal,
];
const portalNetworkRecovery: RecoveryStep[] = [
 {text:'Test vanaf de Qbox het ingestelde Portal-domein via HTTPS. Bij gebruik van ZeroTier controleer je ook of de Qbox het ingestelde ZeroTier-adres van Portal bereikt.',command:'curl -I --max-time 10 https://PORTAL_HOST/'},
 {text:'Werkt de verbinding vanaf de Qbox opnieuw, vernieuw de status in Portal. Een openstaande sync-aanvraag kan de Qbox bij de volgende controle ophalen.'},
];
const portalProxyRecovery: RecoveryStep = {
 text:'Controleer op de Portal-server of de API draait en of Caddy de aanvraag kan doorsturen. Vergelijk de API- en proxylogs rond hetzelfde tijdstip.',
 command:'docker compose ps api caddy\ndocker compose logs --since 24h api caddy',
};
const reduceExport: RecoveryStep = {
 text:'Controleer onder Projecten en gegevens de projectselectie en extra kolommen. Beperk de export tot de benodigde gegevens en start daarna één nieuwe sync.',
};

const byReason:Partial<Record<string,RecoveryStep[]>> = {
 docker_daemon_unreachable:[{text:'Controleer op de Qbox of Docker draait en lees de opstartfout als de service is gestopt.',command:'sudo systemctl status docker --no-pager'}],
 docker_image_missing:hfsqlDriverRecovery,
 database_missing:[{text:'Stel de exacte HFSQL-databasenaam in als loxberry en test de verbinding.',command:'./plenion.sh database\nsudo ./plenion.sh test'}],
 status_not_in_hfsql:[{text:'Vergelijk de status-ID’s uit HFSQL met Projecten en gegevens in de Plenion-connector. Verwijder ontbrekende ID’s uit de selectie, sla op en start een sync.',command:'sudo ./plenion.sh statuses'}],
 unknown_column:hfsqlSchemaRecovery,
 incomplete_status_catalog:[{text:'Controleer of de reader de juiste HFSQL-database gebruikt en lees de PRS-statussen opnieuw uit.',command:'sudo ./plenion.sh statuses'},localJournal],
 invalid_status_catalog:[{text:'Controleer op de replica de PRS-regels in WERK op lege omschrijvingen of ontbrekende of dubbele ID’s. Vergelijk met productie als de replica afwijkt.',command:'sudo ./plenion.sh statuses'}],
 invalid_project_flag:[{text:'Controleer in Plenion de projectmap- en afsluitvinkjes van de betrokken brongegevens. Als alleen de replica afwijkt, controleer de replicatie van PROJ.'},localJournal],
 export_row_limit:[reduceExport],
 export_size_limit:[reduceExport],
 hfsql_reader_timeout:hfsqlTimeoutRecovery,
 SSLCertVerificationError:[{text:'Controleer op de Qbox de tijd en het ingestelde Portal-domein. Controleer op Portal of het TLS-certificaat geldig is voor dat domein. Houd het domein ook bij een ZeroTier-route aan.',command:'timedatectl status'}],
 SSLError:[{text:'Controleer het HTTPS-adres en het certificaat vanaf de Qbox. Gebruik voor een ZeroTier-route het Portal-domein voor TLS en verifieer het ingestelde doel-IP.'},portalNetworkRecovery[0]],
};

const bySqlState:Partial<Record<string,RecoveryStep[]>> = {
 '08001':hfsqlLoginRecovery, '08004':hfsqlLoginRecovery, '28000':hfsqlLoginRecovery,
 '08S01':hfsqlTimeoutRecovery, HYT00:hfsqlTimeoutRecovery, HYT01:hfsqlTimeoutRecovery,
 IM002:hfsqlDriverRecovery, IM003:hfsqlDriverRecovery,
 '42S02':hfsqlSchemaRecovery, '42S22':hfsqlSchemaRecovery,
 '42000':[{text:'Controleer of het readeraccount leesrechten heeft op PROJ en WERK. Als leesrechten kloppen, vergelijk de gemelde SQLSTATE met de HFSQL-log om de query- of schemafout te vinden.'},localJournal],
};

const byHttpStatus:Partial<Record<number,RecoveryStep[]>> = {
 400:[{text:'Zoek in de API-log welk veld of formaat is afgewezen. Controleer of de geïnstalleerde reader en Portal dezelfde export- en configuratieversie ondersteunen.'},portalApiLogs],
 401:[{text:'Controleer of de Qbox het juiste Portal-adres en de bedrijfs-API-sleutel gebruikt. Pas die indien nodig aan als loxberry.',command:'./plenion.sh upload-config'}],
 403:[{text:'Controleer op Portal of het bedrijf actief is en de gebruikte sleutel toegang heeft tot dit bedrijf en deze route.'},portalApiLogs],
 404:[{text:'Controleer of de Portal-API die bij de reader hoort op dit domein draait. Controleer de route in de API en de doorsturing van /api door Caddy.'},portalProxyRecovery],
 409:[{text:'Controleer de actieve projectselectie en of er al een nieuwere import is verwerkt. Laat de reader één nieuwe export maken met de actuele instellingen.'},portalApiLogs],
 413:[{text:'Controleer of de export boven de uploadlimiet van Portal of de proxy valt.'},reduceExport],
 429:[{text:'Laat een eventuele wachttijd verstrijken of wacht op de volgende geplande sync. Controleer bij herhaling de limieten in Portal of de proxy.'}],
 502:[portalProxyRecovery],
 503:[{text:'Controleer op Portal of de API gezond is en of de database en bedrijfsconfiguratie beschikbaar zijn.'},portalProxyRecovery],
 504:[{text:'Controleer of de API nog bezig was met de import toen de proxy stopte met wachten. Zoek eerst naar een database- of transactietime-out rond dit poging-ID.'},portalProxyRecovery],
};

export function eventRemedy(event: ReaderEvent): RecoveryStep[] | undefined {
 if (!failurePhases.has(event.phase)) return;
 const detail = event.diagnostic;
 const link = eventLink(event);
 if (detail?.errno === 13 || detail?.reason === 'PermissionError') {
  if (link === 'hfsql' || detail.step === 'journal_sync') return [checkConfigurationOwner,
   {text:'Als de map van loxberry is en connection.json van root, geef het bestand dezelfde eigenaar en groep als de map en behoud bestandsrechten 600.',
    command:'sudo chown --reference=data data/connection.json\nsudo chmod 600 data/connection.json'},configureConnection];
  return [{text:'Controleer in de installatiemap of de eigenaar van data ook het bestand uit de foutmelding kan lezen. Pas alleen de rechten van dat bestand aan.'},localStatus];
 }
 if (detail?.sqlState) return bySqlState[detail.sqlState] ?? [localJournal];
 if (event.httpStatus) return byHttpStatus[event.httpStatus] ?? [portalApiLogs];
 if (detail?.reason && byReason[detail.reason]) return byReason[detail.reason];
 if (detail?.reason === 'FileNotFoundError') {
  if (link === 'hfsql') return [checkConfigurationOwner,configureConnection];
  return [{text:'Controleer welke installatiemap de sync-service gebruikt en of de bijbehorende configuratie en exportbestanden daar staan.',
           command:'systemctl show cohvera-reader-sync.service -p WorkingDirectory --value'},localStatus];
 }
 if (detail?.reason === 'JSONDecodeError') {
  if (link === 'commands' || link === 'portal')
   return [{text:'Controleer of het ingestelde Portal-domein naar de API wijst en of de route JSON teruggeeft. Controleer in Caddy of de aanvraag op de juiste service terechtkomt.'},portalApiLogs];
  return [{text:'Controleer in de readerdiagnose welk lokaal JSON-bestand ongeldig is. Maak bij een ongeldige HFSQL-export een nieuwe uitlezing nadat de bronfout is opgelost.'},localStatus];
 }
 if (detail?.reason === 'gaierror')
  return [{text:`Controleer op de Qbox de ingestelde ${link === 'hfsql' ? 'HFSQL-hostnaam' : 'Portal-hostnaam'} en de DNS-instellingen. Vervang HOSTNAAM door de naam uit de configuratie.`,command:'getent ahosts HOSTNAAM'},
   ...(link === 'hfsql' ? [hfSqlTcpTest] : [portalNetworkRecovery[0]])];
 if ([101,110,111,113].includes(detail?.errno ?? 0) ||
     ['TimeoutError','ConnectionRefusedError','ConnectionResetError','TimeoutExpired'].includes(detail?.reason ?? '')) {
  if (link === 'portal' || link === 'commands') return portalNetworkRecovery;
  if (link === 'hfsql') {
   if (detail?.errno === 101 || detail?.errno === 113) return hfsqlRouteRecovery;
   if (detail?.errno === 111 || detail?.reason === 'ConnectionRefusedError') return hfsqlPortRecovery;
   return hfsqlTimeoutRecovery;
  }
 }
 return [localJournal];
}
