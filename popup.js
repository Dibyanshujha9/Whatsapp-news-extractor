document.addEventListener("DOMContentLoaded", () => {
  const extractBtn = document.getElementById("extract");
  const downloadBtn = document.getElementById("download");
  const output = document.getElementById("output");
  let latestData = [];

  // Extract headlines button
  extractBtn.addEventListener("click", () => {
    output.textContent = "Extracting headlines...";
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        output.textContent = "Error querying tabs: " + chrome.runtime.lastError.message;
        return;
      }
      
      if (!tabs || !tabs[0]) {
        output.textContent = "Error: No active tab found.";
        return;
      }

      // Check if we're on WhatsApp Web
      if (!tabs[0].url.includes("web.whatsapp.com")) {
        output.textContent = "Error: Please navigate to WhatsApp Web (https://web.whatsapp.com) and select the Aaj Tak channel.";
        return;
      }

      const tabId = tabs[0].id;
      
      // First, try to ping the content script to see if it's alive
      chrome.tabs.sendMessage(
        tabId,
        { action: "ping" },
        (response) => {
          if (chrome.runtime.lastError || !response) {
            // Content script is not responding, try to inject it explicitly
            console.log("Content script not responding, attempting to inject...");
            injectContentScript(tabId, () => {
              // After injection, try to extract headlines
              extractHeadlinesFromTab(tabId);
            });
          } else {
            // Content script is alive, proceed with extraction
            console.log("Content script is alive, proceeding with extraction...");
            extractHeadlinesFromTab(tabId);
          }
        }
      );
    });
  });

  // Function to inject content script explicitly
  function injectContentScript(tabId, callback) {
    chrome.scripting.executeScript(
      {
        target: { tabId: tabId },
        files: ["content.js"]
      },
      () => {
        if (chrome.runtime.lastError) {
          output.textContent = "Failed to inject content script: " + chrome.runtime.lastError.message;
          return;
        }
        console.log("Content script injected successfully");
        // Wait a bit for the script to initialize
        setTimeout(callback, 500);
      }
    );
  }

  // Function to extract headlines from a tab
  function extractHeadlinesFromTab(tabId) {
    chrome.tabs.sendMessage(
      tabId,
      { action: "extractHeadlines" },
      (response) => {
        if (chrome.runtime.lastError) {
          output.textContent =
            "Error: Could not connect to WhatsApp Web.\n\n" +
            "Please ensure:\n" +
            "1. You are on https://web.whatsapp.com\n" +
            "2. The extension is properly loaded\n" +
            "3. You've selected the Aaj Tak channel\n" +
            "4. The content script is loaded (try refreshing the page)\n\n" +
            "Technical details: " + chrome.runtime.lastError.message;
          console.error("Runtime error:", chrome.runtime.lastError);
          return;
        }

        if (!response) {
          output.textContent = "No response from content script. Please try refreshing WhatsApp Web.";
          return;
        }

        if (response.error) {
          output.textContent = "Error extracting headlines: " + response.error;
          return;
        }

        if (!response.headlines || response.headlines.length === 0) {
          output.textContent = "No headlines found. Try:\n1. Refreshing WhatsApp Web\n2. Ensuring you're in the Aaj Tak channel\n3. Scrolling down to load messages";
          return;
        }

        latestData = response.headlines;
        output.textContent = JSON.stringify(latestData, null, 2);
      }
    );
  }

  // Download JSON button
  downloadBtn.addEventListener("click", () => {
    if (!latestData || latestData.length === 0) {
      output.textContent = "No data to download.";
      return;
    }

    const blob = new Blob([JSON.stringify(latestData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "headlines.json";
    a.click();
    URL.revokeObjectURL(url);
  });
});
