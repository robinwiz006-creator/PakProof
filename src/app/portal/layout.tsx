import { PortalNav } from "@/components/portal-nav";

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="portal">
      <PortalNav />
      <div className="portal-content">{children}</div>
    </div>
  );
}
