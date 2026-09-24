import "./globals.css";
import PortalShell from "./PortalShell";
import type { ReactNode } from "react";

export const metadata = { title: "Cohvera Digital Hub", description: "COEF operating platform" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="nl"><body><PortalShell>{children}</PortalShell></body></html>;
}
