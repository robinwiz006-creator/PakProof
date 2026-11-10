import { PassportSectionState } from "@/components/passport-section-state";
export default function PassportLoading() {
  return (
    <div className="container page">
      <PassportSectionState title="Skill Passport" state="loading" />
    </div>
  );
}
