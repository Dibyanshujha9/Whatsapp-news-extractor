document.addEventListener("DOMContentLoaded", () => {
  const extractBtn = document.getElementById("extract");
  const downloadJsonBtn = document.getElementById("downloadJson");
  const downloadExcelBtn = document.getElementById("downloadExcel");
  const startAutoExtractBtn = document.getElementById("startAutoExtract");
  const stopAutoExtractBtn = document.getElementById("stopAutoExtract");
  const clearDataBtn = document.getElementById("clearData");
  const intervalInput = document.getElementById("interval");
  const statusDiv = document.getElementById("status");
  const dataCountDiv = document.getElementById("dataCount");
  const liveUpdatesDiv = document.getElementById("liveUpdates");
  const messageTrackingDiv = document.getElementById("messageTracking");
  const output = document.getElementById("output");
  let latestData = [];
  let autoExtractInterval = null;
  let isAutoExtracting = false;
  let trackedMessages = []; // Array to store all tracked messages with timestamps

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
        
        // Store the extracted data in background
        storeData(latestData);
      }
    );
  }

  // Function to store data in background
  function storeData(data) {
    chrome.runtime.sendMessage(
      { type: "STORE_DATA", data: data },
      (response) => {
        if (response && response.success) {
          console.log(`Stored ${data.length} headlines`);
          updateDataCount();
        } else {
          console.error("Failed to store data:", response ? response.error : "Unknown error");
        }
      }
    );
  }

  // Download JSON button
  downloadJsonBtn.addEventListener("click", () => {
    // First, try to get accumulated data from background
    chrome.runtime.sendMessage(
      { type: "GET_ACCUMULATED_DATA" },
      (response) => {
        let dataToExport = [];
        
        if (response && response.success && response.data && response.data.length > 0) {
          dataToExport = response.data;
        } else if (latestData && latestData.length > 0) {
          dataToExport = latestData;
        } else {
          output.textContent = "No data to download.";
          return;
        }

        const blob = new Blob([JSON.stringify(dataToExport, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "headlines.json";
        a.click();
        URL.revokeObjectURL(url);
      }
    );
  });

  // Download Excel button
  downloadExcelBtn.addEventListener("click", () => {
    // First, try to get accumulated data from background
    chrome.runtime.sendMessage(
      { type: "GET_ACCUMULATED_DATA" },
      (response) => {
        let dataToExport = [];
        
        if (response && response.success && response.data && response.data.length > 0) {
          dataToExport = response.data;
        } else if (latestData && latestData.length > 0) {
          dataToExport = latestData;
        } else {
          output.textContent = "No data to download.";
          return;
        }

        // Convert data to worksheet format
        const worksheetData = [["S.No.", "Headline"]];
        dataToExport.forEach((headline, index) => {
          worksheetData.push([index + 1, headline]);
        });

        // Create workbook and worksheet
        const ws = XLSX.utils.aoa_to_sheet(worksheetData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Headlines");

        // Export to Excel file
        XLSX.writeFile(wb, "headlines.xlsx");
      }
    );
  });

  // Start automatic extraction button
  startAutoExtractBtn.addEventListener("click", () => {
    if (isAutoExtracting) {
      output.textContent = "Automatic extraction is already running.";
      addLiveUpdate("Error: Automatic extraction is already running");
      return;
    }
    
    const interval = parseInt(intervalInput.value) || 5;
    if (interval < 1 || interval > 60) {
      output.textContent = "Please enter a valid interval between 1 and 60 minutes.";
      addLiveUpdate("Error: Please enter a valid interval between 1 and 60 minutes");
      return;
    }
    
    // Start periodic extraction
    isAutoExtracting = true;
    const intervalMs = interval * 60 * 1000; // Convert minutes to milliseconds
    
    // Add live update
    addLiveUpdate(`Starting automatic extraction with ${interval} minute intervals`);
    
    // Record start of extraction cycle
    const cycleStartTime = new Date();
    trackedMessages.push({
      type: 'cycle_start',
      timestamp: cycleStartTime,
      interval: interval
    });
    updateMessageTracking();
    
    // Do an initial extraction
    performAutoExtraction(cycleStartTime);
    
    // Set up interval for periodic extraction
    autoExtractInterval = setInterval(() => {
      const cycleStartTime = new Date();
      trackedMessages.push({
        type: 'cycle_start',
        timestamp: cycleStartTime,
        interval: interval
      });
      updateMessageTracking();
      performAutoExtraction(cycleStartTime);
    }, intervalMs);
    
    output.textContent = `Automatic extraction started with ${interval} minute intervals.`;
    updateStatus();
  });

  // Stop automatic extraction button
  stopAutoExtractBtn.addEventListener("click", () => {
    if (!isAutoExtracting) {
      output.textContent = "Automatic extraction is not running.";
      addLiveUpdate("Error: Automatic extraction is not running");
      return;
    }
    
    clearInterval(autoExtractInterval);
    isAutoExtracting = false;
    autoExtractInterval = null;
    
    output.textContent = "Automatic extraction stopped.";
    addLiveUpdate("Automatic extraction stopped");
    
    // Record stop of extraction
    trackedMessages.push({
      type: 'cycle_stop',
      timestamp: new Date()
    });
    updateMessageTracking();
    
    updateStatus();
  });

  // Perform automatic extraction
  function performAutoExtraction(cycleStartTime) {
    // Add live update that extraction is starting
    addLiveUpdate("Starting automatic extraction...");
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError || !tabs || !tabs[0]) {
        console.error("Error querying tabs for auto extraction");
        addLiveUpdate("Error: Could not query active tab");
        return;
      }

      // Check if we're on WhatsApp Web
      if (!tabs[0].url.includes("web.whatsapp.com")) {
        console.error("Not on WhatsApp Web for auto extraction");
        addLiveUpdate("Error: Not on WhatsApp Web");
        return;
      }

      const tabId = tabs[0].id;
      
      // Extract headlines from tab
      chrome.tabs.sendMessage(
        tabId,
        { action: "extractHeadlines" },
        (response) => {
          if (chrome.runtime.lastError || !response || response.error) {
            console.error("Error in auto extraction:", chrome.runtime.lastError?.message || response?.error);
            addLiveUpdate("Error: " + (chrome.runtime.lastError?.message || response?.error || "Unknown error"));
            return;
          }

          if (response.headlines && response.headlines.length > 0) {
            // Store the extracted data
            storeData(response.headlines);
            console.log(`Auto extracted ${response.headlines.length} headlines`);
            
            // Add live update with extraction details
            addLiveUpdate(`Extracted ${response.headlines.length} headlines`);
            
            // Track all extracted messages
            response.headlines.forEach((headline, index) => {
              trackedMessages.push({
                type: 'message',
                timestamp: new Date(),
                content: headline,
                cycleStartTime: cycleStartTime
              });
            });
            
            // Add individual headlines to live updates (first 3 for brevity)
            const displayCount = Math.min(3, response.headlines.length);
            for (let i = 0; i < displayCount; i++) {
              const headline = response.headlines[i];
              // Truncate long headlines for display
              const truncated = headline.length > 50 ? headline.substring(0, 50) + "..." : headline;
              addLiveUpdate(`• ${truncated}`);
            }
            if (response.headlines.length > 3) {
              addLiveUpdate(`... and ${response.headlines.length - 3} more`);
            }
            
            // Update message tracking display
            updateMessageTracking();
          } else {
            addLiveUpdate("No headlines found in this extraction");
            
            // Track that no messages were found
            trackedMessages.push({
              type: 'no_messages',
              timestamp: new Date(),
              cycleStartTime: cycleStartTime
            });
            updateMessageTracking();
          }
        }
      );
    });
  }

  // Function to add live updates to the UI
  function addLiveUpdate(message) {
    const timestamp = new Date().toLocaleTimeString();
    const updateDiv = document.createElement("div");
    updateDiv.className = "live-update-item";
    updateDiv.innerHTML = `<span class="timestamp">[${timestamp}]</span> ${message}`;
    
    // Remove placeholder if it exists
    const placeholder = liveUpdatesDiv.querySelector('.live-update-item');
    if (placeholder && placeholder.textContent === 'Live updates will appear here...') {
      liveUpdatesDiv.removeChild(placeholder);
    }
    
    // Insert at the beginning
    liveUpdatesDiv.insertBefore(updateDiv, liveUpdatesDiv.firstChild);
    
    // Remove old updates if we have more than 20
    while (liveUpdatesDiv.children.length > 20) {
      liveUpdatesDiv.removeChild(liveUpdatesDiv.lastChild);
    }
    
    // Scroll to top to show latest update
    liveUpdatesDiv.scrollTop = 0;
  }

  // Function to update message tracking display
  function updateMessageTracking() {
    // Clear current content
    messageTrackingDiv.innerHTML = '';
    
    if (trackedMessages.length === 0) {
      messageTrackingDiv.textContent = 'No messages extracted yet...';
      return;
    }
    
    // Group messages by extraction cycle
    const cycles = {};
    let currentCycleTime = null;
    
    trackedMessages.forEach(item => {
      if (item.type === 'cycle_start') {
        currentCycleTime = item.timestamp.toISOString();
        cycles[currentCycleTime] = {
          startTime: item.timestamp,
          messages: [],
          interval: item.interval
        };
      } else if (item.type === 'message' && currentCycleTime) {
        cycles[currentCycleTime].messages.push(item);
      } else if (item.type === 'no_messages' && currentCycleTime) {
        cycles[currentCycleTime].noMessages = true;
      } else if (item.type === 'cycle_stop') {
        currentCycleTime = null;
      }
    });
    
    // Display cycles in reverse order (newest first)
    const cycleTimes = Object.keys(cycles).sort().reverse();
    
    if (cycleTimes.length === 0) {
      messageTrackingDiv.textContent = 'No extraction cycles yet...';
      return;
    }
    
    cycleTimes.forEach(cycleTime => {
      const cycle = cycles[cycleTime];
      const cycleTimeStr = cycle.startTime.toLocaleTimeString();
      
      // Add cycle header
      const cycleHeader = document.createElement("div");
      cycleHeader.className = "extraction-cycle";
      cycleHeader.textContent = `Cycle ${cycleTimeStr} (${cycle.messages.length} messages)`;
      messageTrackingDiv.appendChild(cycleHeader);
      
      // Add messages
      if (cycle.noMessages && cycle.messages.length === 0) {
        const noMessagesDiv = document.createElement("div");
        noMessagesDiv.className = "tracked-message";
        noMessagesDiv.textContent = "No messages found";
        messageTrackingDiv.appendChild(noMessagesDiv);
      } else {
        cycle.messages.forEach(msg => {
          const msgTimeStr = msg.timestamp.toLocaleTimeString();
          const truncatedContent = msg.content.length > 60 ? msg.content.substring(0, 60) + "..." : msg.content;
          
          const msgDiv = document.createElement("div");
          msgDiv.className = "tracked-message";
          msgDiv.textContent = `[${msgTimeStr}] ${truncatedContent}`;
          messageTrackingDiv.appendChild(msgDiv);
        });
      }
    });
  }

  // Clear data button
  clearDataBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage(
      { type: "CLEAR_ACCUMULATED_DATA" },
      (response) => {
        if (response && response.success) {
          output.textContent = "Data cleared successfully.";
          updateDataCount();
          addLiveUpdate("Data cleared successfully");
          
          // Clear tracked messages
          trackedMessages = [];
          updateMessageTracking();
          addLiveUpdate("Message tracking cleared");
        } else {
          output.textContent = "Failed to clear data.";
          addLiveUpdate("Error: Failed to clear data");
        }
      }
    );
  });

  // Update status display
  function updateStatus() {
    if (isAutoExtracting) {
      statusDiv.textContent = "Status: Running";
      statusDiv.className = "status running";
    } else {
      statusDiv.textContent = "Status: Stopped";
      statusDiv.className = "status stopped";
    }
    updateDataCount();
  }

  // Update data count display
  function updateDataCount() {
    chrome.runtime.sendMessage(
      { type: "GET_DATA_COUNT" },
      (response) => {
        if (response && response.success) {
          dataCountDiv.textContent = `Data count: ${response.count}`;
        }
      }
    );
  }

  // Initialize status on popup open
  updateStatus();
});
