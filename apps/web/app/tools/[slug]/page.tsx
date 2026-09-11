import { notFound } from "next/navigation";
import ToolPageClient from "./ToolPageClient";
import { findTool, tools } from "../../../lib/tools";

export function generateStaticParams() {
  return tools.map((tool) => ({ slug: tool.slug }));
}

export default async function ToolPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tool = findTool(slug);
  if (!tool) notFound();
  return <ToolPageClient tool={tool} />;
}
