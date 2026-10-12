import { RecoveryForm } from "@/components/recovery-form";
export default async function Confirm({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  return (
    <RecoveryForm kind="confirmation" message={(await searchParams).message} />
  );
}
