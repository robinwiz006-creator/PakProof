import { RecoveryForm } from "@/components/recovery-form";
export default async function Forgot({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  return <RecoveryForm kind="reset" message={(await searchParams).message} />;
}
