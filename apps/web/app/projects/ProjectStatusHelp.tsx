export function ProjectStatusHelp(){
 return <details className="projects-recent-closed"><summary>Wat betekenen status, Uit WIP en de datums?</summary>
 <p>De hoofdprojectstatus beschrijft de fase. Uit WIP betekent administratief afgesloten. Offertes en andere gekoppelde records hebben hun eigen status en afsluitvinkje.</p>
 <div className="projects-table-scroll"><table className="projects-table"><thead><tr><th>Combinatie</th><th>Betekenis</th></tr></thead><tbody>
 <tr><td>In uitvoering · Uit WIP uit</td><td>In uitvoering en administratief open. Het tv-profiel gebruikt statuscode 07.</td></tr>
 <tr><td>Gefactureerd · Uit WIP uit</td><td>Gefactureerd, maar nog niet administratief afgesloten. Dit bewijst geen betaling of lopende garantie.</td></tr>
 <tr><td>Opgeleverd · Uit WIP uit</td><td>Opgeleverd en administratief open; bijvoorbeeld voor nazorg. De reden staat niet in dit vinkje.</td></tr>
 <tr><td>Offerte / verloren · Uit WIP aan</td><td>Dat record is administratief afgesloten. De status kan behouden blijven.</td></tr>
 <tr><td>In uitvoering · Uit WIP aan</td><td>Administratief afgesloten met een uitvoeringsstatus. Controleer de combinatie in Plenion.</td></tr>
 <tr><td>Gefactureerd / opgeleverd · Uit WIP aan</td><td>Administratief afgesloten. Garantie-einde en betaling worden niet afzonderlijk bevestigd.</td></tr>
 </tbody></table></div>
 <p>Een nieuwe factuur kan een voorschot of deelfactuur zijn en sluit het hoofdproject niet automatisch af. Een aanmaakdatum uit 2022 bewijst niet dat een project vandaag nog in uitvoering is.</p>
 <p>Planning, deadline en brondata worden apart getoond. We leiden er geen werkelijke startdatum, betaling of garantie-einddatum uit af. Updates toont het detectiemoment van de sync, niet noodzakelijk het moment van de handeling in Plenion.</p>
 </details>;
}
