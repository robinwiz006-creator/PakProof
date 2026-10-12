"use client";
import { SkillPicker } from "./skill-picker";
import { useActionState } from "react";
import { saveProject } from "@/lib/actions";
import { Field, SubmitButton } from "./forms";
import type { Project } from "@/lib/types";
export function ProjectEditor({ project }: { project?: Project }) {
  const [state, action] = useActionState(saveProject, { error: "" });
  const value = (name: string, fallback = "") =>
    state.values?.[name] ?? fallback;
  return (
    <form className="form" action={action}>
      {project && <input type="hidden" name="project_id" value={project.id} />}
      {state.error && (
        <p role="alert" className="message">
          {state.error}
        </p>
      )}
      <Field
        label="Project title"
        name="title"
        required
        minLength={3}
        maxLength={160}
        value={value("title", project?.title)}
      />
      <Field
        label="What you built and why"
        name="description"
        type="textarea"
        required
        minLength={20}
        maxLength={3000}
        value={value("description", project?.description)}
      />
      <SkillPicker
        label="Project skills"
        value={value("skills", project?.skills?.join(", "))}
      />
      <Field
        label="GitHub link"
        name="github_url"
        type="url"
        value={value("github_url", project?.github_url)}
      />
      <Field
        label="Live demo link"
        name="demo_url"
        type="url"
        value={value("demo_url", project?.demo_url)}
      />
      <Field
        label="Supporting evidence URL"
        name="evidence_url"
        type="url"
        value={value("evidence_url", project?.evidence_url)}
        hint="Add at least one link. Your projects are public only when you publish your passport."
      />
      <SubmitButton>
        {project ? "Save project changes" : "Add project"}
      </SubmitButton>
    </form>
  );
}
