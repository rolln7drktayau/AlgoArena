import { t } from "./i18n";
import { useEffect, useRef, useState } from "react";

export function GuidedTour({ navigate, launch, ready, running, hasResults, onClose }: {
  navigate: (view: "scenario" | "algorithms" | "pareto" | "export") => void;
  launch: () => void; ready: boolean; running: boolean; hasResults: boolean; onClose: () => void;
}) {
  const [step, setStep] = useState(0);
  const title = useRef<HTMLHeadingElement>(null);
  const steps = [
    { view: "scenario", title: t("1. Choisir un problème"), text: t("Un benchmark est un problème mathématique de référence. Un scénario simule un workflow sur des ressources. Pour découvrir le studio, gardez le benchmark proposé.") },
    { view: "algorithms", title: t("2. Choisir un algorithme"), text: t("Cochez au moins un algorithme. Ses paramètres contrôlent l’exploration des solutions. Gardez les réglages initiaux pour ce premier essai.") },
    { view: "pareto", title: t("3. Lancer votre expérience"), text: t("Cliquez sur Lancer l’expérience. Le moteur calcule sur votre ordinateur. Attendez l’apparition des résultats avant de continuer.") },
    { view: "pareto", title: t("4. Lire les compromis"), text: t("Chaque point représente une solution. Cliquez sur un point pour afficher ses objectifs dans l’inspecteur. Une solution de Pareto ne peut améliorer un objectif sans en dégrader un autre.") },
    { view: "export", title: t("5. Conserver et reproduire"), text: t("Exportez votre expérience depuis cette vue. La graine et la configuration permettent de retrouver les conditions du calcul. Pour une comparaison scientifique, passez ensuite aux campagnes statistiques.") },
  ] as const;
  useEffect(() => { navigate(steps[step].view); title.current?.focus(); }, [step]);
  return <section className="guided-tour" aria-label={t("Tutoriel interactif")}>
    <div className="tour-top"><span>{t("PREMIERS PAS ·")}{" "}{step + 1}/{steps.length}</span><button onClick={onClose} aria-label={t("Fermer le tutoriel")}>×</button></div>
    <h2 ref={title} tabIndex={-1}>{steps[step].title}</h2><p>{steps[step].text}</p>
    {step === 2 && <button className="tour-launch" disabled={!ready || running} onClick={launch}>{running ? t("Calcul en cours…") : t("Lancer l’expérience")}</button>}
    <div className="tour-actions"><button disabled={step === 0} onClick={() => setStep(step - 1)}>{t("Précédent")}</button><button disabled={step === 2 && (!hasResults || running)} onClick={() => step === 4 ? onClose() : setStep(step + 1)}>{step === 4 ? t("Terminer") : t("Suivant →")}</button></div>
  </section>;
}

export function ModeHelp({ close }: { close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog className="mode-dialog" ref={dialog} onCancel={close} aria-labelledby="mode-title">
    <h2 id="mode-title">{t("Quel mode choisir ?")}</h2>
    <p>{t("Ces modes adaptent l’accompagnement et les détails affichés. Ils utilisent les mêmes calculs et restent disponibles dans l’application PC comme dans le navigateur.")}</p>
    <dl><dt>{t("Apprendre")}</dt><dd>{t("Conseils de lecture et définitions visibles. Commencez par le tutoriel interactif.")}</dd><dt>{t("Explorer")}</dt><dd>{t("Espace de travail direct pour préparer une expérience et parcourir les graphiques, sans conseils permanents.")}</dd><dt>{t("Recherche")}</dt><dd>{t("Ajoute les extensions d’algorithmes et le vecteur de décision des solutions sélectionnées. Les campagnes statistiques restent accessibles dans tous les modes.")}</dd></dl>
    <button autoFocus onClick={close}>{t("Compris")}</button>
  </dialog>;
}
