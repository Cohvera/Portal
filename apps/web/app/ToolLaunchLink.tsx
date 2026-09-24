"use client";
import Link from "next/link";
import type { ComponentProps } from "react";
import { useCompany } from "./PortalShell";
import { recordToolOpen } from "../lib/recent-tools";

type Props = ComponentProps<typeof Link> & { toolId: string };
export default function ToolLaunchLink({toolId, onClick, onAuxClick, ...props}: Props) {
  const {companyCode} = useCompany();
  return <Link {...props} onClick={event => {
    onClick?.(event);
    if (!event.defaultPrevented) recordToolOpen(companyCode, toolId);
  }} onAuxClick={event => {
    onAuxClick?.(event);
    if (event.button === 1 && !event.defaultPrevented) recordToolOpen(companyCode, toolId);
  }}/>;
}
