import { useMemo, useState } from "react";
import { useAppStore } from "../store/useAppStore";
import type { UserProfile } from "../types";

type UiLanguage = "fr" | "en";

interface TutorialSection {
  title: string;
  steps: string[];
}

const profileLabels: Record<UiLanguage, Record<UserProfile, string>> = {
  fr: { student: "Etudiant", researcher: "Chercheur", curious: "Curieux" },
  en: { student: "Student", researcher: "Researcher", curious: "Curious" }
};

const sectionsByProfile: Record<UiLanguage, Record<UserProfile, TutorialSection[]>> = {
  fr: {
    student: [
      { title: "1. Comparer", steps: ["Choisis un probleme simple dans Problème.", "Garde NSGA-II, NSGA-III ou Random Search.", "Clique Lancer la competition."] },
      { title: "2. Lire le resultat", steps: ["HV monte : c'est bon.", "IGD descend : l'algorithme devient plus precis.", "Utilise Que se passe-t-il ? pour une explication simple."] },
      { title: "3. Rejouer", steps: ["Utilise Rejouer pour revoir les generations.", "Observe si les points progressent ou stagnent."] }
    ],
    researcher: [
      { title: "1. Configurer l'experience", steps: ["Dans Problème, utilise les benchmarks ou expressions custom.", "Dans Algorithmes, active tous les concurrents utiles.", "Duplique une configuration pour comparer population 50 vs 100 vs 200."] },
      { title: "2. Evaluer", steps: ["Observe Classement, Comparaison Radar et Panneaux concurrents.", "Utilise les metriques HV, IGD, GD, Epsilon, Spread et Spacing.", "Compare la convergence et la variance."] },
      { title: "3. Exporter", steps: ["Exporte CSV/PDF pour lecture rapide.", "Exporte LaTeX, BibTeX et Stats JSON pour rapport academique.", "Les tests Wilcoxon/Kruskal-Wallis sont exposes dans les exports statistiques."] }
    ],
    curious: [
      { title: "1. Explorer", steps: ["Ouvre Explorer.", "Dessine un paysage ou utilise le paysage 3D.", "Clique Surprends-moi si tu veux une demo instantanee."] },
      { title: "2. Observer", steps: ["Regarde les zones sombres : ce sont les bonnes zones.", "Lance la recherche et suis les points.", "Essaie TSP pour voir un chemin s'ameliorer."] }
    ]
  },
  en: {
    student: [
      { title: "1. Compare", steps: ["Pick a simple problem in Problem.", "Keep NSGA-II, NSGA-III or Random Search.", "Click Start Competition."] },
      { title: "2. Read results", steps: ["HV goes up: good.", "IGD goes down: more precise.", "Use What is happening? for a simple explanation."] },
      { title: "3. Replay", steps: ["Use Replay to review generations.", "Watch whether points improve or stagnate."] }
    ],
    researcher: [
      { title: "1. Configure", steps: ["Use built-in benchmarks or custom expressions in Problem.", "Enable all useful competitors in Algorithms.", "Duplicate configs to compare population 50 vs 100 vs 200."] },
      { title: "2. Evaluate", steps: ["Read Leaderboard, Radar Comparison and Competitor Panels.", "Use HV, IGD, GD, Epsilon, Spread and Spacing.", "Compare convergence and variance."] },
      { title: "3. Export", steps: ["Export CSV/PDF for quick reading.", "Export LaTeX, BibTeX and Stats JSON for academic reports.", "Wilcoxon/Kruskal-Wallis appear in statistical exports."] }
    ],
    curious: [
      { title: "1. Explore", steps: ["Open Explore.", "Draw a landscape or use the 3D landscape.", "Click Surprise me for an instant demo."] },
      { title: "2. Watch", steps: ["Dark zones are good zones.", "Run the search and follow the points.", "Try TSP to see a route improve."] }
    ]
  }
};

export function TutorialTab() {
  const language = useAppStore((state) => state.language);
  const currentProfile = useAppStore((state) => state.userProfile ?? "student");
  const [guideProfile, setGuideProfile] = useState<UserProfile>(currentProfile);
  const labels = profileLabels[language];
  const sections = useMemo(() => sectionsByProfile[language as UiLanguage][guideProfile], [guideProfile, language]);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-stroke bg-card/70 p-4 shadow-glow">
        <h2 className="font-display text-xl">{language === "fr" ? "Tutoriel" : "Tutorial"}</h2>
        <p className="mt-2 text-sm text-slate">
          {language === "fr"
            ? "Le guide utilise les noms actuels : Comparer, Problème, Algorithmes, Simuler, Explorer, Panneaux concurrents et Rejouer."
            : "This guide uses current names: Compare, Problem, Algorithms, Simulate, Explore, Competitor Panels and Replay."}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate">{language === "fr" ? "Afficher le guide pour :" : "Show guide for:"}</span>
          {(Object.keys(labels) as UserProfile[]).map((profile) => (
            <button
              key={profile}
              type="button"
              onClick={() => setGuideProfile(profile)}
              className={`rounded-md border px-3 py-2 ${guideProfile === profile ? "border-accent bg-accent text-ink" : "border-stroke text-slate"}`}
            >
              {labels[profile]}
            </button>
          ))}
        </div>
      </section>

      {sections.map((section) => (
        <section key={section.title} className="rounded-2xl border border-stroke bg-card/70 p-4 shadow-glow">
          <h3 className="font-display text-lg">{section.title}</h3>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate">
            {section.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
