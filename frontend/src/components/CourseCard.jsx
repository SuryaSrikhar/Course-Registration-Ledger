import { motion } from "framer-motion";
import { CheckCircle2, CircleSlash, UsersRound } from "lucide-react";

function seatPercent(enrolled, capacity) {
  if (!capacity) {
    return 0;
  }
  return Math.min(Math.round((enrolled / capacity) * 100), 100);
}

export function CourseCard({ course, onEnroll, onDrop, loadingAction, canEnroll }) {
  const courseIdentifier = course.courseId || course.courseUid;
  const courseTitle = course.title || courseIdentifier;
  const progress = seatPercent(course.enrolled, course.capacity);
  const isFull = course.seatsRemaining <= 0;
  const actionBusy =
    loadingAction === `${courseIdentifier}:enroll` || loadingAction === `${courseIdentifier}:drop`;

  return (
    <motion.article
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="glass-panel course-glow"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-300">{courseIdentifier}</p>
          <h4 className="mt-1 text-xl font-display text-white">{courseTitle}</h4>
          <p className="mt-2 text-sm text-slate-200">
            Secure add/drop operations with immutable logs
          </p>
        </div>

        <div className="rounded-full border border-slate-100/20 bg-white/5 px-3 py-1 text-sm text-cyan-100">
          {progress}% full
        </div>
      </div>

      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-700/50">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            progress > 85 ? "bg-brand-peach" : "bg-gradient-to-r from-cyan-300 to-lime-300"
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="metric-card">
          <p className="metric-label">Capacity</p>
          <p className="metric-value text-white">{course.capacity}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Enrolled</p>
          <p className="metric-value text-white">{course.enrolled}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Remaining</p>
          <p className="metric-value text-white">{course.seatsRemaining}</p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!canEnroll || isFull || actionBusy}
          className="inline-flex items-center gap-2 rounded-full border border-lime-200/40 bg-lime-200/10 px-4 py-2 text-sm font-semibold text-lime-100 transition hover:bg-lime-200/20 disabled:cursor-not-allowed disabled:opacity-45"
          onClick={() => onEnroll(course)}
        >
          <CheckCircle2 className="h-4 w-4" />
          {actionBusy && loadingAction?.endsWith("enroll") ? "Enrolling..." : "Enroll"}
        </button>

        <button
          type="button"
          disabled={!canEnroll || actionBusy}
          className="inline-flex items-center gap-2 rounded-full border border-brand-peach/40 bg-brand-peach/15 px-4 py-2 text-sm font-semibold text-brand-peach transition hover:bg-brand-peach/25 disabled:cursor-not-allowed disabled:opacity-45"
          onClick={() => onDrop(course)}
        >
          <CircleSlash className="h-4 w-4" />
          {actionBusy && loadingAction?.endsWith("drop") ? "Dropping..." : "Drop"}
        </button>

        <span className="inline-flex items-center gap-1 rounded-full border border-slate-100/20 bg-white/5 px-3 py-1 text-xs text-slate-200">
          <UsersRound className="h-4 w-4 text-cyan-200" />
          On-chain seat state
        </span>

        {isFull ? <span className="text-xs font-semibold text-brand-peach">Course is full</span> : null}
      </div>
    </motion.article>
  );
}
