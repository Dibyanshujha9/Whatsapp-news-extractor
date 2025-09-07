document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');
  const channelList = document.getElementById('channelList');
  const liveUpdatesDiv = document.getElementById('liveUpdates');
  const messageTrackingDiv = document.getElementById('messageTracking');
  const downloadJsonBtn = document.getElementById('downloadJson');
  const downloadExcelBtn = document.getElementById('downloadExcel');
  const saveChannelBtn = document.getElementById('saveChannel');
  const channelNameInput = document.getElementById('channelName');
  const channelUrlInput = document.getElementById('channelUrl');
  const channelIntervalInput = document.getElementById('channelInterval');
  const channelMessageDiv = document.getElementById('channelMessage');
  const output = document.getElementById('output');
  
  // State variables
  let channels = [];
  let trackedMessages = []; // Array to store all tracked messages with timestamps
  let activeTabId = null;

  // Initialize the extension
  initializeExtension();

  // Tab switching functionality
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.getAttribute('data-tab');
      
      // Update active tab
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Show active content
      tabContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === `${tabName}-tab`) {
          content.classList.add('active');
        }
      });
    });
  });

  // Initialize extension
  function initializeExtension() {
    // Get the active tab first
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError || !tabs || !tabs[0]) {
        channelList.innerHTML = '<div class="error">Error: Could not get active tab</div>';
        return;
      }
      
      activeTabId = tabs[0].id;
      
      // Request channels from background script
      chrome.runtime.sendMessage(
        { type: "INITIALIZE_CHANNELS" },
        (response) => {
          if (response && response.success) {
            channels = response.channels;
            renderChannelList();
          } else {
            addLiveUpdate("Error: Failed to initialize channels");
            channelList.innerHTML = '<div class="error">Failed to load channels</div>';
          }
        }
      );
    });
  }

  // Render channel list
  function renderChannelList() {
    if (channels.length === 0) {
      channelList.innerHTML = '<div class="channel-item"><p>No channels configured. Add a channel to get started.</p></div>';
      return;
    }

    channelList.innerHTML = '';
    
    channels.forEach(channel => {
      const channelElement = document.createElement('div');
      channelElement.className = 'channel-item';
      channelElement.innerHTML = `
        <div class="channel-header">
          <div class="channel-name">${channel.name}</div>
          <div class="channel-status ${channel.isActive ? 'status-active' : 'status-inactive'}">
            ${channel.isActive ? 'Active' : 'Inactive'}
          </div>
        </div>
        <div class="channel-data-info">
          Interval: ${channel.interval} min | 
          Messages: <span id="count-${channel.id}">Loading...</span> |
          Last extraction: ${channel.lastExtraction ? new Date(channel.lastExtraction).toLocaleTimeString() : 'Never'}
        </div>
        <div class="channel-controls">
          ${channel.isActive 
            ? `<button class="stop-extraction" data-id="${channel.id}">Stop Extraction</button>`
            : `<button class="start-extraction" data-id="${channel.id}">Start Extraction</button>`
          }
          <button class="extract-now" data-id="${channel.id}">Extract Now</button>
          <button class="clear-data" data-id="${channel.id}">Clear Data</button>
          <button class="download-channel" data-id="${channel.id}">Download</button>
          <button class="remove-channel danger" data-id="${channel.id}">Remove</button>
        </div>
      `;
      
      channelList.appendChild(channelElement);
      
      // Get data count for this channel
      getChannelDataCount(channel.id);
    });
    
    // Add event listeners to buttons
    document.querySelectorAll('.start-extraction').forEach(button => {
      button.addEventListener('click', () => {
        startChannelExtraction(button.getAttribute('data-id'));
      });
    });
    
    document.querySelectorAll('.stop-extraction').forEach(button => {
      button.addEventListener('click', () => {
        stopChannelExtraction(button.getAttribute('data-id'));
      });
    });
    
    document.querySelectorAll('.extract-now').forEach(button => {
      button.addEventListener('click', () => {
        extractChannelNow(button.getAttribute('data-id'));
      });
    });
    
    document.querySelectorAll('.clear-data').forEach(button => {
      button.addEventListener('click', () => {
        clearChannelData(button.getAttribute('data-id'));
      });
    });
    
    document.querySelectorAll('.download-channel').forEach(button => {
      button.addEventListener('click', () => {
        downloadChannelData(button.getAttribute('data-id'));
      });
    });
    
    document.querySelectorAll('.remove-channel').forEach(button => {
      button.addEventListener('click', () => {
        removeChannel(button.getAttribute('data-id'));
      });
    });
  }

  // Get data count for a channel
  function getChannelDataCount(channelId) {
    chrome.runtime.sendMessage(
      { type: "GET_CHANNEL_DATA", channelId: channelId },
      (response) => {
        const countElement = document.getElementById(`count-${channelId}`);
        if (response && response.success) {
          if (countElement) {
            countElement.textContent = response.data.length;
          }
        } else {
          if (countElement) {
            countElement.textContent = 'Error';
          }
        }
      }
    );
  }

  // Start channel extraction
  function startChannelExtraction(channelId) {
    chrome.runtime.sendMessage(
      { type: "START_EXTRACTION", channelId: channelId },
      (response) => {
        if (response && response.success) {
          addLiveUpdate(`Started extraction for channel ${getChannelName(channelId)}`);
          refreshChannels();
        } else {
          addLiveUpdate(`Error starting extraction: ${response ? response.error : 'Unknown error'}`);
        }
      }
    );
  }

  // Stop channel extraction
  function stopChannelExtraction(channelId) {
    chrome.runtime.sendMessage(
      { type: "STOP_EXTRACTION", channelId: channelId },
      (response) => {
        if (response && response.success) {
          addLiveUpdate(`Stopped extraction for channel ${getChannelName(channelId)}`);
          refreshChannels();
        } else {
          addLiveUpdate(`Error stopping extraction: ${response ? response.error : 'Unknown error'}`);
        }
      }
    );
  }

  // Extract channel now
  function extractChannelNow(channelId) {
    addLiveUpdate(`Manual extraction started for channel ${getChannelName(channelId)}`);
    
    // Check if we're on WhatsApp Web
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError || !tabs || !tabs[0]) {
        addLiveUpdate("Error: Could not query active tab");
        return;
      }

      if (!tabs[0].url.includes("web.whatsapp.com")) {
        addLiveUpdate("Error: Not on WhatsApp Web. Please navigate to https://web.whatsapp.com");
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
              performExtractionForTab(tabId, channelId);
            });
          } else {
            // Content script is alive, proceed with extraction
            console.log("Content script is alive, proceeding with extraction...");
            performExtractionForTab(tabId, channelId);
          }
        }
      );
    });
  }

  // Function to inject content script explicitly
  function injectContentScript(tabId, callback) {
    chrome.scripting.executeScript(
      {
        target: { tabId: tabId },
        files: ["content.js"]
      },
      () => {
        if (chrome.runtime.lastError) {
          addLiveUpdate("Failed to inject content script: " + chrome.runtime.lastError.message);
          return;
        }
        console.log("Content script injected successfully");
        // Wait a bit for the script to initialize
        setTimeout(callback, 500);
      }
    );
  }

  // Perform extraction for a specific tab and channel
  function performExtractionForTab(tabId, channelId) {
    // Get channel info from content script
    chrome.tabs.sendMessage(
      tabId,
      { action: "getChannelInfo" },
      (response) => {
        if (chrome.runtime.lastError || !response || response.error) {
          addLiveUpdate(`Error getting channel info: ${chrome.runtime.lastError?.message || response?.error || "Unknown error"}`);
          return;
        }

        const currentChannelName = response.channelName;
        const targetChannel = channels.find(c => c.id === channelId);
        
        if (!targetChannel) {
          addLiveUpdate("Error: Target channel not found");
          return;
        }
        
        addLiveUpdate(`Current channel: ${currentChannelName}, Target channel: ${targetChannel.name}`);
        
        // Extract headlines from tab
        chrome.tabs.sendMessage(
          tabId,
          { action: "extractHeadlines" },
          (response) => {
            if (chrome.runtime.lastError || !response || response.error) {
              addLiveUpdate(`Error: ${chrome.runtime.lastError?.message || response?.error || "Unknown error"}`);
              return;
            }

            if (response.headlines && response.headlines.length > 0) {
              // Store the extracted data
              storeChannelData(channelId, response.headlines);
              addLiveUpdate(`Extracted ${response.headlines.length} headlines from ${response.channelName || targetChannel.name}`);
              
              // Track all extracted messages
              const cycleStartTime = new Date();
              response.headlines.forEach((headline) => {
                trackedMessages.push({
                  type: 'message',
                  timestamp: new Date(),
                  content: headline,
                  channelId: channelId,
                  channelName: targetChannel.name,
                  cycleStartTime: cycleStartTime
                });
              });
              
              // Update message tracking display
              updateMessageTracking();
              
              // Update data count
              getChannelDataCount(channelId);
            } else {
              addLiveUpdate(`No headlines found in ${targetChannel.name}`);
              
              // Track that no messages were found
              trackedMessages.push({
                type: 'no_messages',
                timestamp: new Date(),
                channelId: channelId,
                channelName: targetChannel.name
              });
              updateMessageTracking();
            }
          }
        );
      }
    );
  }

  // Store channel data
  function storeChannelData(channelId, data) {
    chrome.runtime.sendMessage(
      { type: "STORE_CHANNEL_DATA", channelId: channelId, data: data },
      (response) => {
        if (response && response.success) {
          console.log(`Stored ${data.length} headlines for channel ${channelId}`);
        } else {
          console.error("Failed to store channel data:", response ? response.error : "Unknown error");
        }
      }
    );
  }

  // Clear channel data
  function clearChannelData(channelId) {
    chrome.runtime.sendMessage(
      { type: "CLEAR_CHANNEL_DATA", channelId: channelId },
      (response) => {
        if (response && response.success) {
          addLiveUpdate(`Cleared data for channel ${getChannelName(channelId)}`);
          getChannelDataCount(channelId);
          
          // Remove tracked messages for this channel
          trackedMessages = trackedMessages.filter(msg => msg.channelId !== channelId);
          updateMessageTracking();
        } else {
          addLiveUpdate(`Error clearing data: ${response ? response.error : 'Unknown error'}`);
        }
      }
    );
  }

  // Download channel data
  function downloadChannelData(channelId) {
    chrome.runtime.sendMessage(
      { type: "DOWNLOAD_CHANNEL_DATA", channelId: channelId },
      (response) => {
        if (response && response.success) {
          const data = response.data;
          const channelName = getChannelName(channelId);
          
          // Convert data to worksheet format
          const worksheetData = [["S.No.", "Headline"]];
          data.forEach((headline, index) => {
            worksheetData.push([index + 1, headline]);
          });

          // Create workbook and worksheet
          const ws = XLSX.utils.aoa_to_sheet(worksheetData);
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, ws, channelName);

          // Export to Excel file
          XLSX.writeFile(wb, `${channelName}_headlines.xlsx`);
          addLiveUpdate(`Downloaded data for channel ${channelName}`);
        } else {
          addLiveUpdate(`Error downloading data: ${response ? response.error : 'Unknown error'}`);
        }
      }
    );
  }

  // Remove channel
  function removeChannel(channelId) {
    if (!confirm(`Are you sure you want to remove channel "${getChannelName(channelId)}"?`)) {
      return;
    }
    
    chrome.runtime.sendMessage(
      { type: "REMOVE_CHANNEL", channelId: channelId },
      (response) => {
        if (response && response.success) {
          addLiveUpdate(`Removed channel ${getChannelName(channelId)}`);
          refreshChannels();
        } else {
          addLiveUpdate(`Error removing channel: ${response ? response.error : 'Unknown error'}`);
        }
      }
    );
  }

  // Refresh channels list
  function refreshChannels() {
    chrome.runtime.sendMessage(
      { type: "GET_CHANNELS" },
      (response) => {
        if (response && response.success) {
          channels = response.channels;
          renderChannelList();
        } else {
          addLiveUpdate("Error: Failed to refresh channels");
        }
      }
    );
  }

  // Get channel name by ID
  function getChannelName(channelId) {
    const channel = channels.find(c => c.id === channelId);
    return channel ? channel.name : channelId;
  }

  // Save new channel
  saveChannelBtn.addEventListener('click', () => {
    const name = channelNameInput.value.trim();
    const url = channelUrlInput.value.trim() || 'https://web.whatsapp.com/';
    const interval = parseInt(channelIntervalInput.value) || 5;
    
    if (!name) {
      channelMessageDiv.innerHTML = '<div class="error">Please enter a channel name</div>';
      return;
    }
    
    if (interval < 1 || interval > 60) {
      channelMessageDiv.innerHTML = '<div class="error">Interval must be between 1 and 60 minutes</div>';
      return;
    }
    
    const newChannel = {
      name: name,
      urlPattern: url,
      interval: interval,
      isActive: false,
      lastExtraction: null
    };
    
    chrome.runtime.sendMessage(
      { type: "ADD_CHANNEL", channel: newChannel },
      (response) => {
        if (response && response.success) {
          channelMessageDiv.innerHTML = '<div class="success">Channel added successfully</div>';
          channelNameInput.value = '';
          channelUrlInput.value = '';
          channelIntervalInput.value = '5';
          refreshChannels();
        } else {
          channelMessageDiv.innerHTML = `<div class="error">Error: ${response ? response.error : 'Unknown error'}</div>`;
        }
      }
    );
  });

  // Download JSON button
  downloadJsonBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage(
      { type: "DOWNLOAD_CHANNEL_DATA" }, // No channelId = all channels
      (response) => {
        if (response && response.success) {
          const allData = response.data;
          
          // Create a combined JSON object
          const exportData = {};
          allData.forEach(channelData => {
            exportData[channelData.channelName] = channelData.data;
          });
          
          const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: "application/json",
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "all_channels_headlines.json";
          a.click();
          URL.revokeObjectURL(url);
          addLiveUpdate("Downloaded all channels data as JSON");
        } else {
          addLiveUpdate(`Error downloading data: ${response ? response.error : 'Unknown error'}`);
        }
      }
    );
  });

  // Download Excel button
  downloadExcelBtn.addEventListener("click", () => {
    chrome.runtime.sendMessage(
      { type: "DOWNLOAD_CHANNEL_DATA" }, // No channelId = all channels
      (response) => {
        if (response && response.success) {
          const allData = response.data;
          
          // Create workbook
          const wb = XLSX.utils.book_new();
          
          // Add each channel as a separate worksheet
          allData.forEach(channelData => {
            if (channelData.data.length > 0) {
              const worksheetData = [["S.No.", "Headline"]];
              channelData.data.forEach((headline, index) => {
                worksheetData.push([index + 1, headline]);
              });
              
              const ws = XLSX.utils.aoa_to_sheet(worksheetData);
              XLSX.utils.book_append_sheet(wb, ws, channelData.channelName);
            }
          });
          
          // Export to Excel file
          XLSX.writeFile(wb, "all_channels_headlines.xlsx");
          addLiveUpdate("Downloaded all channels data as Excel");
        } else {
          addLiveUpdate(`Error downloading data: ${response ? response.error : 'Unknown error'}`);
        }
      }
    );
  });

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
    
    // Group messages by channel
    const channelGroups = {};
    
    trackedMessages.forEach(item => {
      const channelId = item.channelId;
      if (!channelGroups[channelId]) {
        channelGroups[channelId] = {
          channelName: item.channelName,
          messages: []
        };
      }
      
      if (item.type === 'message') {
        channelGroups[channelId].messages.push(item);
      } else if (item.type === 'no_messages') {
        channelGroups[channelId].messages.push({
          timestamp: item.timestamp,
          content: "No messages found in this extraction",
          isNoMessages: true
        });
      }
    });
    
    // Display channels
    Object.keys(channelGroups).forEach(channelId => {
      const group = channelGroups[channelId];
      
      // Add channel header
      const channelHeader = document.createElement("div");
      channelHeader.className = "extraction-cycle";
      channelHeader.textContent = `${group.channelName} (${group.messages.length} messages)`;
      messageTrackingDiv.appendChild(channelHeader);
      
      // Add messages (show last 10 for each channel)
      const messagesToShow = group.messages.slice(-10);
      messagesToShow.forEach(msg => {
        const msgTimeStr = msg.timestamp.toLocaleTimeString();
        const content = msg.isNoMessages ? msg.content : 
          (msg.content.length > 60 ? msg.content.substring(0, 60) + "..." : msg.content);
        
        const msgDiv = document.createElement("div");
        msgDiv.className = "tracked-message";
        msgDiv.textContent = `[${msgTimeStr}] ${content}`;
        messageTrackingDiv.appendChild(msgDiv);
      });
    });
  }
});
