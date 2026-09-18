const buttons = [...document.querySelectorAll("[data-target]")];
buttons.forEach(button => button.addEventListener("click", async () => {
  buttons.forEach(item => item.disabled = true);
  document.querySelector("#status").textContent = "Préparation du moteur local…";
  try { document.querySelector("#status").textContent = await window.launcher.launch(button.dataset.target); }
  catch (error) { document.querySelector("#status").textContent = `Démarrage impossible : ${error.message}`; }
  finally { buttons.forEach(item => item.disabled = false); }
}));
document.querySelector("#quit").addEventListener("click", () => window.launcher.quit());
