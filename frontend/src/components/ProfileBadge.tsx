import { useProfileFilter } from "../hooks/useProfileFilter";
import { useAppStore } from "../store/useAppStore";
import type { UserProfile } from "../types";

const labels = {
  fr: {
    student: "Etudiant",
    researcher: "Chercheur",
    curious: "Curieux"
  },
  en: {
    student: "Student",
    researcher: "Researcher",
    curious: "Curious"
  }
};

export const ProfileBadge = () => {
  const language = useAppStore((state) => state.language);
  const setUserProfile = useAppStore((state) => state.setUserProfile);
  const { profile } = useProfileFilter();
  const t = labels[language];

  return (
    <label className="flex items-center gap-1 rounded-lg border border-stroke bg-card px-2 py-1 text-xs text-slate">
      <span aria-hidden="true">User</span>
      <select
        value={profile}
        onChange={(event) => setUserProfile(event.target.value as UserProfile)}
        className="rounded bg-card px-1 py-1 text-ice outline-none"
        title={language === "fr" ? "Profil actif" : "Active profile"}
      >
        <option value="student">{t.student}</option>
        <option value="researcher">{t.researcher}</option>
        <option value="curious">{t.curious}</option>
      </select>
    </label>
  );
};
