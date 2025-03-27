// renderer.js
import {marked} from "./node_modules/marked/lib/marked.esm.js";
import katex from "./node_modules/katex/dist/katex.mjs";

document.addEventListener("DOMContentLoaded", async () => {
  const messageInput = document.getElementById("message-input");
  const sendBtn = document.getElementById("send-btn");
  const chatMessages = document.getElementById("chat-messages");
  const addServerBtn = document.getElementById("add-server-btn");
  const serverList = document.getElementById("server-list");
  const settingsBtn = document.getElementById("settings-btn");

  let pythonPort = null;
  let serverRefreshInterval = null;

  function renderLaTeX(text) {
    const latexPlaceholders = [];
    let placeholderIndex = 0;

    function replaceAndRender(match, displayMode) {
      const latex = match.slice(displayMode ? 2 : 1, -(displayMode ? 2 : 1));
      try {
        const rendered = katex.renderToString(latex, {
          throwOnError: false,
          displayMode: displayMode,
          output: "html",
        });
        const placeholder = `__LATEX_PLACEHOLDER_${placeholderIndex++}__`;
        latexPlaceholders.push({placeholder, rendered});
        return placeholder;
      } catch (e) {
        console.error("KaTeX rendering error:", e);
        return match; // Return original on error
      }
    }

    let processedText = text.replace(/\$\$([\s\S]*?)\$\$/g, (match) =>
      replaceAndRender(match, true)
    );
    processedText = processedText.replace(
      /(?<!\$)\$([^$]+)\$(?!\$)/g,
      (match) => replaceAndRender(match, false)
    );

    return {processedText, latexPlaceholders};
  }

  function addMessage(text, sender) {
    const messageDiv = document.createElement("div");
    messageDiv.classList.add("message", sender);

    const toolCallPatterns = [
      /need to make a call to the .* function/i,
      /using the .* tool/i,
      /calling the .* function/i,
      /let me use the .* tool/i,
      /i need to use the .* tool/i,
      /to get .* i need to make a call to the .* function/i,
    ];

    const isToolCallAnnouncement =
      sender === "ai" && toolCallPatterns.some((pattern) => pattern.test(text));
    const isSystemMessage = sender === "system";

    if (isToolCallAnnouncement || isSystemMessage) {
      const details = document.createElement("details");
      details.classList.add("message-details");

      const summary = document.createElement("summary");
      summary.classList.add("message-summary");
      if (isToolCallAnnouncement) {
        summary.textContent = "AI is using a tool...";
      } else {
        summary.textContent = text.startsWith("Error:")
          ? "System Error"
          : "System Message";
      }

      const detailsContent = document.createElement("div");
      detailsContent.classList.add("message-details-content");

      if (isToolCallAnnouncement) {
        const {processedText, latexPlaceholders} = renderLaTeX(text);
        let html = marked.parse(processedText);
        latexPlaceholders.forEach(({placeholder, rendered}) => {
          html = html.replace(placeholder, rendered);
        });
        detailsContent.innerHTML = html;
      } else {
        detailsContent.textContent = text;
      }

      details.appendChild(summary);
      details.appendChild(detailsContent);
      messageDiv.appendChild(details);
    } else {
      const contentDiv = document.createElement("div");
      contentDiv.classList.add("message-content");

      if (sender === "ai") {
        const {processedText, latexPlaceholders} = renderLaTeX(text);
        let html = marked.parse(processedText);
        latexPlaceholders.forEach(({placeholder, rendered}) => {
          html = html.replace(placeholder, rendered);
        });
        contentDiv.innerHTML = html;
      } else {
        contentDiv.textContent = text;
      }
      messageDiv.appendChild(contentDiv);
    }

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message || !pythonPort) {
      if (!pythonPort) {
        addMessage("Error: Backend not connected.", "system");
      }
      return;
    }

    addMessage(message, "user");
    messageInput.value = "";
    messageInput.style.height = "auto"; // Reset height after sending

    try {
      const response = await fetch(`http://127.0.0.1:${pythonPort}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({message: message}),
      });
      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({reply: `HTTP error! status: ${response.status}`}));
        throw new Error(
          errorData.reply || `HTTP error! status: ${response.status}`
        );
      }
      const data = await response.json();
      addMessage(data.reply, "ai");
    } catch (error) {
      console.error("Error sending message:", error);
      addMessage(`Error: ${error.message}`, "system");
    }
  }

  async function deleteServer(serverPath) {
    if (!pythonPort) {
      addMessage("Cannot delete server: Backend not connected.", "system");
      return;
    }

    addMessage(
      `Attempting to remove server: ${serverPath.split(/[\\/]/).pop()}`,
      "system"
    );
    try {
      const response = await fetch(`http://127.0.0.1:${pythonPort}/servers`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({path: serverPath}),
      });
      const data = await response.json();
      if (response.ok && data.status === "success") {
        addMessage(
          `Server ${serverPath.split(/[\\/]/).pop()} removed.`,
          "system"
        );
        await fetchAndRenderServers(); // Refresh the list
      } else {
        throw new Error(
          data.message || `Failed to remove server (status: ${response.status})`
        );
      }
    } catch (error) {
      console.error("Error removing server:", error);
      addMessage(`Error removing server: ${error.message}`, "system");
      await fetchAndRenderServers(); // Refresh list even on error
    }
  }

  function renderServerList(servers) {
    serverList.innerHTML = ""; // Clear existing list
    if (servers && servers.length > 0) {
      servers.forEach((server) => {
        const li = document.createElement("li");
        li.dataset.path = server.path;
        li.classList.add("server-item");

        const serverInfo = document.createElement("div");
        serverInfo.classList.add("server-info");

        const nameSpan = document.createElement("span");
        nameSpan.classList.add("server-name");
        nameSpan.textContent = server.path.split(/[\\/]/).pop() || server.path;
        nameSpan.title = server.path;

        const statusSpan = document.createElement("span");
        statusSpan.classList.add(
          "server-status",
          server.status === "connected" ? "connected" : "error"
        );
        statusSpan.textContent = server.status;

        const deleteBtn = document.createElement("button");
        deleteBtn.classList.add("delete-server-btn");
        deleteBtn.innerHTML = "×"; // Simple 'x'
        deleteBtn.title = "Remove Server";
        deleteBtn.onclick = () => deleteServer(server.path);

        serverInfo.appendChild(nameSpan);
        serverInfo.appendChild(statusSpan);
        serverInfo.appendChild(deleteBtn);
        li.appendChild(serverInfo);

        if (server.tools && server.tools.length > 0) {
          const toolsContainer = document.createElement("div");
          toolsContainer.classList.add("tools-container");
          const toolsTitle = document.createElement("span");
          toolsTitle.classList.add("tools-title");
          toolsTitle.textContent = "Tools:";
          toolsContainer.appendChild(toolsTitle);

          const toolsList = document.createElement("ul");
          toolsList.classList.add("tools-list");
          server.tools.forEach((toolName) => {
            const toolLi = document.createElement("li");
            toolLi.textContent = toolName;
            toolsList.appendChild(toolLi);
          });
          toolsContainer.appendChild(toolsList);
          li.appendChild(toolsContainer);
        }

        serverList.appendChild(li);
      });
    } else {
      const li = document.createElement("li");
      li.textContent = "No MCP servers connected.";
      li.style.justifyContent = "center";
      li.style.color = "var(--text-secondary)";
      serverList.appendChild(li);
    }
  }

  async function fetchAndRenderServers() {
    if (!pythonPort) return;
    try {
      const response = await fetch(`http://127.0.0.1:${pythonPort}/servers`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data.status === "success") {
        renderServerList(data.servers);
      } else {
        throw new Error(data.message || "Failed to fetch servers");
      }
    } catch (error) {
      console.error("Error fetching servers:", error);
      renderServerList([]);
      addMessage(`Error fetching server list: ${error.message}`, "system");
      if (serverRefreshInterval) {
        clearInterval(serverRefreshInterval);
        serverRefreshInterval = null;
        addMessage(
          "Stopping automatic server refresh due to connection error.",
          "system"
        );
      }
    }
  }

  async function initializeApp() {
    try {
      pythonPort = await window.electronAPI.getPythonPort();
      console.log(`Python backend running on port: ${pythonPort}`);
      addMessage("Welcome to GemCP Chat!", "ai"); // Changed from "system" to "ai"
      await fetchAndRenderServers();
      if (!serverRefreshInterval) {
        serverRefreshInterval = setInterval(fetchAndRenderServers, 10000);
      }
    } catch (error) {
      console.error("Error initializing app:", error);
      addMessage(
        "Error connecting to backend. Please ensure it is running.",
        "system"
      );
      renderServerList([]);
      if (serverRefreshInterval) {
        clearInterval(serverRefreshInterval);
        serverRefreshInterval = null;
      }
    }
  }

  sendBtn.addEventListener("click", sendMessage);
  messageInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });

  messageInput.addEventListener("input", () => {
    messageInput.style.height = "auto";
    messageInput.style.height = `${Math.min(messageInput.scrollHeight, 150)}px`;
  });

  addServerBtn.addEventListener("click", async () => {
    if (!pythonPort) {
      addMessage("Cannot add server: Backend not connected.", "system");
      return;
    }
    const filePaths = await window.electronAPI.showOpenDialog();
    if (filePaths && filePaths.length > 0) {
      const serverPath = filePaths[0];
      console.log("Attempting to add server:", serverPath);
      addMessage(
        `Attempting to add server: ${serverPath.split(/[\\/]/).pop()}`,
        "system"
      );
      try {
        const response = await fetch(`http://127.0.0.1:${pythonPort}/servers`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({path: serverPath}),
        });
        const data = await response.json();
        if (response.ok && data.status === "success") {
          addMessage(
            `Server '${
              data.tools.length > 0 ? data.tools.join(", ") : "connected"
            }' added from ${serverPath.split(/[\\/]/).pop()}.`,
            "system"
          );
          await fetchAndRenderServers();
          if (!serverRefreshInterval && pythonPort) {
            serverRefreshInterval = setInterval(fetchAndRenderServers, 10000);
            addMessage("Restarting automatic server refresh.", "system");
          }
        } else {
          throw new Error(
            data.message || `Failed to add server (status: ${response.status})`
          );
        }
      } catch (error) {
        console.error("Error adding server:", error);
        addMessage(`Error adding server: ${error.message}`, "system");
        await fetchAndRenderServers();
      }
    }
  });

  settingsBtn.addEventListener("click", () => {
    window.electronAPI.openSettingsDialog();
  });

  window.electronAPI.onApiKeyUpdate((result) => {
    if (result.success) {
      addMessage("API Key set successfully. Backend re-initialized.", "system");
    } else {
      addMessage(`Error setting API Key: ${result.message}`, "system");
    }
  });

  initializeApp();
});
