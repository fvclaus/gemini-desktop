// settings.js
document.addEventListener("DOMContentLoaded", () => {
  const apiKeyInput = document.getElementById("api-key");
  const saveBtn = document.getElementById("save-btn");
  const cancelBtn = document.getElementById("cancel-btn");

  saveBtn.addEventListener("click", () => {
    const apiKey = apiKeyInput.value;
    window.settingsAPI.saveKey(apiKey);
    window.settingsAPI.closeDialog();
  });

  cancelBtn.addEventListener("click", () => {
    window.settingsAPI.closeDialog();
  });

  apiKeyInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      saveBtn.click();
    } else if (event.key === "Escape") {
      cancelBtn.click();
    }
  });

  apiKeyInput.focus(); // Focus the input when the dialog opens
});
