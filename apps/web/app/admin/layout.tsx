"use client";
import Link from 'next/link';
import {usePathname} from 'next/navigation';
export default function AdminLayout({children}:{children:React.ReactNode}){
 const pathname=usePathname();
 return <div style={{minWidth:0}}><nav className="catalog-filters" aria-label="Cohvera Admin" style={{padding:'20px 32px 0'}}>{[['/admin/accounts','Accounts'],['/admin/plugins','Plugin Manager'],['/admin/tools','Tools per bedrijf']].map(([href,label])=><Link key={href} href={href} className="secondary-button" aria-current={pathname===href?'page':undefined} style={pathname===href?{background:'#343fd1',color:'#fff'}:undefined}>{label}</Link>)}</nav>{children}</div>;
}
