import { notFound } from "next/navigation";
import { publicPassport } from "@/lib/data";
import { isConfigured } from "@/lib/supabase/server";
import { DemoNotice } from "@/components/ui";
import { PassportView } from "@/components/passport-view";
export default async function PublicProfile({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await publicPassport(slug);
  if (!data) notFound();
  return (
    <div className="container page">
      {!isConfigured() && <DemoNotice />}
      <PassportView {...data} />
    </div>
  );
}
