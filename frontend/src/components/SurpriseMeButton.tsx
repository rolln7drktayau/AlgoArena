import { useState } from "react";
import { useAppStore } from "../store/useAppStore";
import { SurpriseMeModal } from "./SurpriseMeModal";

const labels = {
  fr: "Surprends-moi",
  en: "Surprise me"
};

export const SurpriseMeButton = () => {
  const language = useAppStore((state) => state.language);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-ember px-3 py-2 text-xs font-semibold text-ink"
        title={language === "fr" ? "Voir une demo visuelle immediate" : "See an instant visual demo"}
      >
        * {labels[language]}
      </button>
      <SurpriseMeModal open={open} onClose={() => setOpen(false)} />
    </>
  );
};
