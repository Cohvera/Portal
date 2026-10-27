export const ALL_COMPANIES = '__ALL__';
export type ProjectCompany = {code:string;name:string};
export function projectCompanies(companies:ProjectCompany[], selected:string, canRead:(code:string)=>boolean) {
  return companies.filter(c=>(selected===ALL_COMPANIES || c.code===selected) && canRead(c.code));
}
// All-or-nothing: a failed company request must not produce misleading combined totals.
export async function loadCompanyRecords<T>(companies:ProjectCompany[], load:(company:ProjectCompany)=>Promise<T[]>) {
  return (await Promise.all(companies.map(async company=>{
    try{return (await load(company)).map(row=>({...row,companyCode:company.code,companyName:company.name}));}
    catch(error){if(error instanceof Error && error.name==='AbortError')throw error;throw new Error(`${company.name}: ${error instanceof Error?error.message:'Ophalen mislukt'}`);}
  }))).flat();
}
