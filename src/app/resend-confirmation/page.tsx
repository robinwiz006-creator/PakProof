import { RecoveryForm } from "@/components/recovery-form";
export default async function Confirm({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; next?: string }>;
}) {
  const { message, next } = await searchParams;
  return <RecoveryForm kind="confirmation" message={message} next={next} />;
}
