const Cmd = ({ children }: { children: string }) => (
  <pre className="overflow-x-auto rounded-lg border border-stroke bg-panel/80 p-3 text-xs text-ice">
    <code>{children}</code>
  </pre>
);

export function TutorialTab() {
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-stroke bg-card/70 p-4 shadow-glow">
        <h2 className="font-display text-xl">Tutoriel rapide dans l'application</h2>
        <p className="mt-2 text-sm text-slate">
          Ce guide te permet de lancer AlgoArena en local puis de tester l'executable Windows.
        </p>
        <p className="mt-2 text-sm text-slate">
          Pourquoi tu vois seulement des terminaux: le script PowerShell demarre les services, ce n'etait pas une app desktop native. Pour une vraie fenetre desktop, utilise le mode Electron ci-dessous.
        </p>
      </section>

      <section className="rounded-2xl border border-stroke bg-card/70 p-4 shadow-glow">
        <h3 className="font-display text-lg">1) Demarrage local (recommande)</h3>
        <p className="mt-2 text-sm text-slate">Depuis PowerShell, place-toi dans le dossier du projet:</p>
        <Cmd>cd E:\AlgoArena</Cmd>
        <p className="mt-2 text-sm text-slate">Puis lance la commande unique:</p>
        <Cmd>powershell -ExecutionPolicy Bypass -File .\scripts\start_windows.ps1</Cmd>
        <p className="mt-2 text-sm text-slate">
          URLs attendues: Frontend http://localhost:5173, API http://localhost:8000, Docs http://localhost:8000/docs
        </p>
      </section>

      <section className="rounded-2xl border border-stroke bg-card/70 p-4 shadow-glow">
        <h3 className="font-display text-lg">2) Tester le .exe (pas a pas)</h3>
        <p className="mt-2 text-sm text-slate">A. Generer l'executable:</p>
        <Cmd>powershell -ExecutionPolicy Bypass -File .\scripts\build_launcher_exe.ps1</Cmd>
        <p className="mt-2 text-sm text-slate">B. Verifier qu'il existe:</p>
        <Cmd>Get-Item .\dist\AlgoArenaLauncher.exe</Cmd>
        <p className="mt-2 text-sm text-slate">C. Test local:</p>
        <Cmd>.\dist\AlgoArenaLauncher.exe</Cmd>
        <p className="mt-2 text-sm text-slate">D. Verifications attendues:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate">
          <li>Deux fenetres PowerShell s'ouvrent (backend + frontend)</li>
          <li>Un toast Windows apparait avec l'etat</li>
          <li>Le frontend est accessible et les runs benchmark/scenario fonctionnent</li>
        </ul>
      </section>

      <section className="rounded-2xl border border-stroke bg-card/70 p-4 shadow-glow">
        <h3 className="font-display text-lg">3) Version desktop native (comme Paige)</h3>
        <p className="mt-2 text-sm text-slate">Mode desktop en fenetre native via Electron:</p>
        <Cmd>npm install</Cmd>
        <Cmd>npm run desktop:dev</Cmd>
        <p className="mt-2 text-sm text-slate">Build installer desktop Windows:</p>
        <Cmd>npm run desktop:dist:win</Cmd>
      </section>

      <section className="rounded-2xl border border-stroke bg-card/70 p-4 shadow-glow">
        <h3 className="font-display text-lg">4) Proposition de changement theme + langue</h3>
        <p className="mt-2 text-sm text-slate">
          Theme propose: ajouter "lab-dark" et "paper-light" en plus de dark/light.
        </p>
        <p className="mt-1 text-sm text-slate">
          Langue proposee: ajouter FR/EN avec react-i18next et un selecteur de langue dans l'entete.
        </p>
        <p className="mt-1 text-sm text-slate">
          Guide detaille complet disponible dans le fichier GUIDE_COMPLET_FR.md a la racine du projet.
        </p>
      </section>
    </div>
  );
}
