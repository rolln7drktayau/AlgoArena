import { useMemo } from "react";
import { useAppStore } from "../store/useAppStore";

type UiLanguage = "fr" | "en";

interface TutorialSection {
  title: string;
  steps: string[];
}

const textByLanguage: Record<
  UiLanguage,
  {
    title: string;
    intro: string;
    sections: TutorialSection[];
    noteTitle: string;
    noteBody: string;
  }
> = {
  fr: {
    title: "Tutoriel d'utilisation (app deja lancee)",
    intro:
      "Ce guide explique quoi faire une fois la fenetre AlgoArena ouverte, sans commandes terminal.",
    sections: [
      {
        title: "1) Navigation generale",
        steps: [
          "Utilise les onglets du haut: Benchmark, Scenario Simulator, Tutoriel.",
          "Change la langue avec le selecteur Francais/English dans l'entete.",
          "Change le theme avec le bouton Theme sombre / Theme clair."
        ]
      },
      {
        title: "2) Workflow Benchmark (competition d'algorithmes)",
        steps: [
          "Dans Problem Definition, choisis le probleme et les parametres.",
          "Dans Algorithm Library, active les algorithmes a comparer et ajuste les hyperparametres.",
          "Clique Lancer la competition pour demarrer.",
          "Observe le Leaderboard, le Radar et la Competition Grid pendant l'execution.",
          "Utilise Replay Controls pour revoir l'evolution generation par generation.",
          "Utilise Exporter CSV / Exporter PDF pour sortir les resultats."
        ]
      },
      {
        title: "3) Workflow Scenario Simulator",
        steps: [
          "Passe sur Scenario Simulator.",
          "Definis les tiers Edge/Fog/Cloud, le workflow et les objectifs.",
          "Lance la simulation et suis l'evolution visuelle en direct.",
          "Regle la vitesse du replay pour accelerer ou ralentir l'animation.",
          "Exporte les visuels scientifiques (SVG, PNG, LaTeX) depuis le dashboard scenario."
        ]
      },
      {
        title: "4) Lecture des resultats",
        steps: [
          "Hypervolume (HV): plus eleve est generalement meilleur.",
          "IGD: plus bas est generalement meilleur.",
          "Regarde la stabilite: un bon score moyen avec variance faible est preferable.",
          "Compare aussi le temps d'execution et la vitesse de convergence."
        ]
      },
      {
        title: "5) Si quelque chose semble bloque",
        steps: [
          "Utilise Stop puis relance la competition/simulation.",
          "Verifie que des algorithmes sont bien actives.",
          "Si un export ne sort rien, relance apres un run complet avec donnees disponibles."
        ]
      }
    ],
    noteTitle: "Conseil pratique",
    noteBody:
      "Pour une comparaison fiable entre algorithmes, garde la meme configuration de probleme et ne change qu'un parametre a la fois."
  },
  en: {
    title: "Usage Tutorial (app already running)",
    intro:
      "This guide focuses on what to do after AlgoArena is open, with no terminal commands.",
    sections: [
      {
        title: "1) Global navigation",
        steps: [
          "Use the top tabs: Benchmark, Scenario Simulator, Tutorial.",
          "Switch language with the Francais/English selector in the header.",
          "Switch theme with the Theme button."
        ]
      },
      {
        title: "2) Benchmark workflow (algorithm competition)",
        steps: [
          "In Problem Definition, select your problem and parameters.",
          "In Algorithm Library, enable algorithms and tune hyperparameters.",
          "Click Start Competition to run.",
          "Monitor Leaderboard, Radar, and Competition Grid during execution.",
          "Use Replay Controls to review generation-by-generation progress.",
          "Use Export CSV / Export PDF to save benchmark results."
        ]
      },
      {
        title: "3) Scenario Simulator workflow",
        steps: [
          "Go to Scenario Simulator.",
          "Define Edge/Fog/Cloud tiers, workflow, and objectives.",
          "Run simulation and watch the live visual evolution.",
          "Adjust replay speed to speed up or slow down the animation.",
          "Export scientific visuals (SVG, PNG, LaTeX) from the scenario dashboard."
        ]
      },
      {
        title: "4) How to read results",
        steps: [
          "Hypervolume (HV): higher is usually better.",
          "IGD: lower is usually better.",
          "Check stability: strong mean score with low variance is preferred.",
          "Also compare execution time and convergence speed."
        ]
      },
      {
        title: "5) If something looks stuck",
        steps: [
          "Use Stop, then restart the run/simulation.",
          "Make sure at least one algorithm is enabled.",
          "If an export is empty, retry after a full run with available data."
        ]
      }
    ],
    noteTitle: "Practical tip",
    noteBody:
      "For fair comparisons, keep the same problem setup and change only one parameter at a time."
  }
};

export function TutorialTab() {
  const language = useAppStore((state) => state.language);
  const text = useMemo(() => textByLanguage[language], [language]);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-stroke bg-card/70 p-4 shadow-glow">
        <h2 className="font-display text-xl">{text.title}</h2>
        <p className="mt-2 text-sm text-slate">{text.intro}</p>
      </section>

      {text.sections.map((section) => (
        <section key={section.title} className="rounded-2xl border border-stroke bg-card/70 p-4 shadow-glow">
          <h3 className="font-display text-lg">{section.title}</h3>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate">
            {section.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>
      ))}

      <section className="rounded-2xl border border-stroke bg-card/70 p-4 shadow-glow">
        <h3 className="font-display text-lg">{text.noteTitle}</h3>
        <p className="mt-2 text-sm text-slate">{text.noteBody}</p>
      </section>
    </div>
  );
}
