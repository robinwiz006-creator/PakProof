"use client";
import { useId, useState } from "react";
const suggestions = [
  "React",
  "TypeScript",
  "Python",
  "Data analysis",
  "Product design",
  "Accessibility",
  "Communication",
];
export function SkillPicker({
  value = "",
  label = "Skills",
}: {
  value?: string;
  label?: string;
}) {
  const [text, setText] = useState(value);
  const id = useId();
  const selected = text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name="skills"
        value={text}
        maxLength={500}
        onChange={(e) => setText(e.target.value)}
        aria-describedby={`${id}-hint`}
      />
      <small id={`${id}-hint`}>
        Select suggestions or add your own, separated by commas. These skills
        are added by you, not independently verified.
      </small>
      <div className="tags">
        {suggestions.map((skill) => (
          <button
            key={skill}
            type="button"
            className="tag"
            aria-pressed={selected.includes(skill)}
            onClick={() =>
              setText(
                (selected.includes(skill)
                  ? selected.filter((s) => s !== skill)
                  : [...selected, skill]
                ).join(", "),
              )
            }
          >
            {selected.includes(skill) ? "✓ " : "+ "}
            {skill}
          </button>
        ))}
      </div>
    </div>
  );
}
