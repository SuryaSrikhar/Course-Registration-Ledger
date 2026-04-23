import { motion } from "framer-motion";
import { BookOpen, Users, Sparkles, ShieldCheck } from "lucide-react";

const statIcons = {
  totalCourses: BookOpen,
  totalCapacity: Users,
  totalEnrolled: Sparkles,
  seatsRemaining: ShieldCheck
};

const labels = {
  totalCourses: "Total Courses",
  totalCapacity: "Total Capacity",
  totalEnrolled: "Total Enrolled",
  seatsRemaining: "Seats Remaining"
};

export function StatsBar({ summary }) {
  const values = {
    totalCourses: summary?.totalCourses || 0,
    totalCapacity: summary?.totalCapacity || 0,
    totalEnrolled: summary?.totalEnrolled || 0,
    seatsRemaining: summary?.seatsRemaining || 0
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {Object.entries(values).map(([key, value], index) => {
        const Icon = statIcons[key];
        return (
          <motion.article
            key={key}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: index * 0.08 }}
            className="glass-panel"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-300">{labels[key]}</p>
              <Icon className="h-4 w-4 text-cyan-200" />
            </div>
            <p className="mt-4 font-display text-3xl text-white">{value}</p>
          </motion.article>
        );
      })}
    </div>
  );
}
