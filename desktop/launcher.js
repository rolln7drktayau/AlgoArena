const copy = {
  fr: {
    tagline: 'Votre laboratoire, sur votre ordinateur.', language: 'Langue', heading: 'Comment souhaitez-vous travailler ?',
    intro: 'Les deux interfaces utilisent le même moteur local et les mêmes résultats sauvegardés. Aucun compte ni serveur distant requis.',
    desktop: 'Application PC', desktopDescription: 'Une fenêtre dédiée. Fermer l’application arrête le moteur et les calculs.', openDesktop: 'Ouvrir l’application →',
    web: 'Navigateur', webDescription: 'Un onglet dans votre navigateur. Une icône près de l’horloge permet d’arrêter le moteur.', openWeb: 'Ouvrir le navigateur →',
    modes: 'Apprendre, Explorer et Recherche adaptent l’accompagnement dans les deux interfaces. Le choix se ferme après le lancement.',
    idle: 'Choisissez une interface pour démarrer.', starting: 'Préparation du moteur local…', failed: 'Démarrage impossible : ',
    stopHelp: 'Navigateur : clic droit sur l’icône AlgoArena près de l’horloge → Tout arrêter et quitter. Fermer un onglet ne suffit pas.', quit: 'Quitter'
  },
  en: {
    tagline: 'Your laboratory, on your computer.', language: 'Language', heading: 'How would you like to work?',
    intro: 'Both interfaces use the same local engine and saved results. No account or remote server required.',
    desktop: 'Desktop app', desktopDescription: 'A dedicated window. Closing the app stops the engine and calculations.', openDesktop: 'Open desktop app →',
    web: 'Browser', webDescription: 'A tab in your browser. A system tray icon lets you stop the engine.', openWeb: 'Open browser →',
    modes: 'Learn, Explore and Research adjust guidance in both interfaces. This selector closes after launch.',
    idle: 'Choose an interface to start.', starting: 'Preparing the local engine…', failed: 'Unable to start: ',
    stopHelp: 'Browser: right-click the AlgoArena system tray icon → Stop everything and quit. Closing a tab is not enough.', quit: 'Quit'
  }
};
const buttons = [...document.querySelectorAll('[data-target]')];
const selector = document.querySelector('#language');
const status = document.querySelector('#status');
let language = 'fr';
function render() {
  document.documentElement.lang = language;
  selector.value = language;
  document.querySelectorAll('[data-copy]').forEach(item => item.textContent = copy[language][item.dataset.copy]);
  status.textContent = copy[language].idle;
}
selector.addEventListener('change', async () => {
  try { language = await window.launcher.language(selector.value); render(); }
  catch (error) { status.textContent = error.message; }
});
buttons.forEach(button => button.addEventListener('click', async () => {
  buttons.forEach(item => item.disabled = true); selector.disabled = true;
  status.textContent = copy[language].starting;
  try { await window.launcher.launch(button.dataset.target); }
  catch (error) { status.textContent = copy[language].failed + error.message; }
  finally { buttons.forEach(item => item.disabled = false); selector.disabled = false; }
}));
document.querySelector('#quit').addEventListener('click', () => window.launcher.quit());
window.launcher.language().then(value => { language = value; render(); buttons.forEach(item => item.disabled = false); }).catch(error => { render(); status.textContent = error.message; });
