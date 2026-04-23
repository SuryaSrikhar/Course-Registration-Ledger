import { useState } from "react";
import { PlusCircle } from "lucide-react";

const initialForm = {
  courseId: "",
  capacity: ""
};

export function AdminPanel({ onCreateCourse, isCreating }) {
  const [form, setForm] = useState(initialForm);

  async function submit(event) {
    event.preventDefault();
    await onCreateCourse(form);
    setForm(initialForm);
  }

  return (
    <section className="glass-panel h-full">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-slate-300/90">Admin Panel</p>
          <h3 className="mt-1 text-lg font-display text-white">Create New Course</h3>
        </div>
        <PlusCircle className="h-5 w-5 text-brand-peach" />
      </div>

      <form className="mt-4 space-y-3" onSubmit={submit}>
        <input
          value={form.courseId}
          onChange={(event) => setForm((prev) => ({ ...prev, courseId: event.target.value }))}
          className="input-shell"
          placeholder="Course ID (CSE-501)"
          required
        />

        <input
          value={form.capacity}
          onChange={(event) => setForm((prev) => ({ ...prev, capacity: event.target.value }))}
          className="input-shell"
          type="number"
          min="1"
          max="65535"
          placeholder="Capacity"
          required
        />

        <button className="cta-button w-full" disabled={isCreating} type="submit">
          {isCreating ? "Creating..." : "Create Course"}
        </button>
      </form>
    </section>
  );
}
