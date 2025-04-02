// settings.js
document.addEventListener("DOMContentLoaded", async () => {
  const apiKeyInput = document.getElementById("api-key");
  const modelSelect = document.getElementById("model-select"); // Get model dropdown
  const saveBtn = document.getElementById("save-btn");
  const cancelBtn = document.getElementById("cancel-btn");

  // Function to populate the model dropdown
  async function populateModels() {
    try {
      modelSelect.disabled = true; // Disable while loading
      modelSelect.innerHTML = '<option value="">Loading models...</option>'; // Clear and show loading

      const availableModels = await window.settingsAPI.listModels();
      const currentModel = await window.settingsAPI.getModel();

      modelSelect.innerHTML = ''; // Clear loading message

      if (!availableModels || availableModels.length === 0) {
         modelSelect.innerHTML = '<option value="">No models available</option>';
         return;
      }

      availableModels.forEach(model => {
        const option = document.createElement('option');
        option.value = model;
        option.textContent = model;
        if (model === currentModel) {
          option.selected = true;
        }
        modelSelect.appendChild(option);
      });

      modelSelect.disabled = false; // Re-enable after loading

    } catch (error) {
      console.error("Error populating models:", error);
      modelSelect.innerHTML = `<option value="">Error loading models</option>`;
      // Optionally display error to user more prominently
    }
  }

  // Populate models when the dialog loads
  await populateModels();


  saveBtn.addEventListener("click", async () => { // Make async
    const apiKey = apiKeyInput.value;
    const selectedModel = modelSelect.value;

    // Disable buttons during save
    saveBtn.disabled = true;
    cancelBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    let modelSetSuccess = true;
    let keySetSuccess = true; // Assume key setting is implicitly successful for now unless backend reports error

    // 1. Set the model (if a valid one is selected)
    if (selectedModel) {
        try {
            console.log(`Attempting to set model to: ${selectedModel}`);
            await window.settingsAPI.setModel(selectedModel);
            console.log(`Model set successfully to: ${selectedModel}`);
        } catch (error) {
            console.error("Error setting model:", error);
            modelSetSuccess = false;
            // Optionally show error to user here (e.g., using an alert or status message)
            alert(`Error setting model: ${error.message}`);
        }
    } else {
        console.warn("No model selected or model list empty.");
        // Decide if this is an error or acceptable (e.g., if only setting key)
    }

    // 2. Save the API key (only if model setting was successful or not attempted)
    // The saveKey function doesn't currently return status, but we might want that later.
    // For now, we proceed if model setting didn't fail outright.
    if (modelSetSuccess && apiKey) { // Only save key if provided
        console.log("Saving API key...");
        window.settingsAPI.saveKey(apiKey);
        // We assume saveKey triggers backend re-init implicitly
    } else if (modelSetSuccess && !apiKey) {
        console.log("No API key provided, skipping key save.");
    }


    // Re-enable buttons
    saveBtn.disabled = false;
    cancelBtn.disabled = false;
    saveBtn.textContent = "Save";

    // Close dialog only if everything relevant succeeded
    if (modelSetSuccess) { // Close if model setting succeeded (key saving is assumed ok for now)
       window.settingsAPI.closeDialog();
    }
  });

  cancelBtn.addEventListener("click", () => {
    window.settingsAPI.closeDialog();
  });

  // Handle Enter/Escape in both input fields
  const handleKeyDown = (event) => {
     if (event.key === "Enter") {
      saveBtn.click();
    } else if (event.key === "Escape") {
      cancelBtn.click();
    }
  }
  apiKeyInput.addEventListener("keydown", handleKeyDown);
  modelSelect.addEventListener("keydown", handleKeyDown); // Add listener to select too

  apiKeyInput.focus(); // Focus the API key input first
});
