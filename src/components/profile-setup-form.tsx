"use client";
import { useActionState } from "react";
import { saveProfileStep } from "@/lib/actions";
import { Field, SubmitButton } from "./forms";
import { SkillPicker } from "./skill-picker";
import type { Profile } from "@/lib/types";
import type { SetupStep } from "@/lib/profile-setup";
export function ProfileSetupForm({
  profile,
  step,
  canWrite,
}: {
  profile: Profile;
  step: SetupStep;
  canWrite: boolean;
}) {
  const [state, action] = useActionState(saveProfileStep, { error: "" });
  const value = (name: string, fallback: string) =>
    state.values?.[name] ?? fallback;
  return (
    <form action={action} className="form">
      <input type="hidden" name="step" value={step} />
      {state.error && (
        <p className="message" role="alert">
          {state.error}
        </p>
      )}
      {step === "about" && (
        <>
          <Field
            label="Full name"
            name="full_name"
            value={value("full_name", profile.full_name)}
            required
            minLength={2}
            maxLength={100}
          />
          <Field
            label="What do you do? (optional)"
            name="headline"
            value={value("headline", profile.headline)}
            maxLength={160}
            hint="For example: Computer science student interested in data analysis."
          />
          <Field
            label="About me (optional)"
            name="bio"
            type="textarea"
            value={value("bio", profile.bio)}
            maxLength={2000}
          />
          <div className="form-grid">
            <Field
              label="Location (optional)"
              name="location"
              value={value("location", profile.location)}
              maxLength={160}
            />
            <Field
              label="University or institution (optional)"
              name="university"
              value={value("university", profile.university)}
              maxLength={160}
            />
          </div>
        </>
      )}
      {step === "skills" && (
        <>
          <SkillPicker value={value("skills", profile.skills.join(", "))} />
          <p className="muted">
            Add the skills you want to show. These are added by you, not
            independently verified qualifications. You can leave this blank.
          </p>
        </>
      )}
      {step === "publish" && (
        <>
          <Field
            label="Your profile link"
            name="slug"
            value={value("slug", profile.slug)}
            required
            hint="This is the part after /talent/. Keep it unchanged if you have already shared your link."
          />
          <label className="field">
            Profile visibility
            <select
              name="visibility"
              defaultValue={value(
                "visibility",
                profile.is_public ? "public" : "private",
              )}
            >
              <option value="private">Private — only I can preview it</option>
              <option value="public">
                Public — anyone with the link can view it
              </option>
            </select>
          </label>
          <p className="notice">
            Publishing shows your profile and portfolio projects. Credential
            visibility and approved submission evidence still use their separate
            sharing choices.
          </p>
        </>
      )}
      {canWrite ? (
        <SubmitButton>
          {step === "publish" ? "Save visibility" : "Save and continue"}
        </SubmitButton>
      ) : (
        <p className="notice">
          This is a read-only demo. Create an account to save your own profile.
        </p>
      )}
    </form>
  );
}
