import { useMemo } from "react";
import { useAppStore } from "../store/useAppStore";
import type { UserProfile } from "../types";

export const useProfileFilter = () => {
  const profile = useAppStore((state) => state.userProfile ?? "student");

  return useMemo(() => {
    const isStudent = profile === "student";
    const isResearcher = profile === "researcher";
    const isCurious = profile === "curious";
    return {
      profile: profile as UserProfile,
      isStudent,
      isResearcher,
      isCurious,
      showAllAlgorithms: isResearcher,
      showAdvancedMetrics: isResearcher,
      showAcademicExports: isResearcher,
      showStatTests: isResearcher,
      showMetricExplanations: isStudent,
      showStudentBanner: isStudent,
      showResearcherBanner: isResearcher,
      showCuriousBanner: isCurious,
      defaultTabIsExplore: isCurious,
      showSurpriseMeProminent: isCurious,
      showLabsFirst: !isCurious,
      showCustomProblem: isResearcher,
      showCustomAlgorithmUpload: isResearcher,
      showAdvancedHyperparams: isResearcher,
      allowedAlgorithms: isStudent
        ? ["NSGA-II", "NSGA-III", "Random Search"]
        : isCurious
          ? ["NSGA-II", "MOEA/D", "Random Search"]
          : null,
      allowedMetrics: isResearcher ? null : isCurious ? ["hv"] : ["hv", "igd"]
    };
  }, [profile]);
};
