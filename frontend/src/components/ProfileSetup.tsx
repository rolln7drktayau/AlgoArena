import { useAppStore } from "../store/useAppStore";
import type { UserProfile } from "../types";

const copy = {
  fr: {
    title: "Choisis ton profil AlgoArena",
    body: "Ce choix ne bloque rien : il adapte seulement les textes, le niveau d'explication et les options mises en avant. Tu peux le changer plus tard.",
    profiles: {
      student: ["Etudiant", "Interface guidee, tutoriels et explications des metriques."],
      researcher: ["Chercheur", "Comparaisons avancees, exports academiques et tests statistiques."],
      curious: ["Curieux", "Exploration visuelle, moins de jargon et problemes interactifs."]
    }
  },
  en: {
    title: "Choose your AlgoArena profile",
    body: "This does not lock features. It only adapts wording, explanation depth and highlighted options. You can change it later.",
    profiles: {
      student: ["Student", "Guided interface, tutorials and metric explanations."],
      researcher: ["Researcher", "Advanced comparisons, academic exports and statistical tests."],
      curious: ["Curious", "Visual exploration, less jargon and interactive problems."]
    }
  }
};

export const ProfileSetup = () => {
  const userProfile = useAppStore((state) => state.userProfile);
  const language = useAppStore((state) => state.language);
  const setUserProfile = useAppStore((state) => state.setUserProfile);
  const t = copy[language];

  if (userProfile) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-panel/90 p-4 backdrop-blur">
      <section className="w-full max-w-3xl rounded-xl border border-stroke bg-card p-5 shadow-glow">
        <h2 className="font-display text-xl text-ice">{t.title}</h2>
        <p className="mt-1 text-sm text-slate">{t.body}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {(Object.keys(t.profiles) as UserProfile[]).map((profileId) => (
            <button
              key={profileId}
              type="button"
              onClick={() => setUserProfile(profileId)}
              className="min-h-36 rounded-lg border border-stroke bg-ink p-4 text-left hover:border-accent"
            >
              <span className="block font-display text-lg text-ice">{t.profiles[profileId][0]}</span>
              <span className="mt-2 block text-xs leading-5 text-slate">{t.profiles[profileId][1]}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};
