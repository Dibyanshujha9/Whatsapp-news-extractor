// Background script for WhatsApp News Extractor - Multi-Channel Support

// Global variables to manage channels and data
let channels = [];
let activeExtractions = {}; // Track active extraction intervals
let tabChannelMap = {}; // Map tab IDs to channel IDs

// Listen for messages from the popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background received message:", message);
  
  if (message.type === "INITIALIZE_CHANNELS") {
    // Initialize channels from storage
    initializeChannels()
      .then(() => {
        sendResponse({ success: true, channels: channels });
      })
      .catch(error => {
        console.error("Error initializing channels:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open for async response
  } else if (message.type === "GET_CHANNELS") {
    // Return all channels
    sendResponse({ success: true, channels: channels });
  } else if (message.type === "ADD_CHANNEL") {
    // Add a new channel
    addChannel(message.channel)
      .then(channel => {
        sendResponse({ success: true, channel: channel });
      })
      .catch(error => {
        console.error("Error adding channel:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open for async response
  } else if (message.type === "UPDATE_CHANNEL") {
    // Update an existing channel
    updateChannel(message.channelId, message.updates)
      .then(channel => {
        sendResponse({ success: true, channel: channel });
      })
      .catch(error => {
        console.error("Error updating channel:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open for async response
  } else if (message.type === "REMOVE_CHANNEL") {
    // Remove a channel
    removeChannel(message.channelId)
      .then(() => {
        sendResponse({ success: true });
      })
      .catch(error => {
        console.error("Error removing channel:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open for async response
  } else if (message.type === "START_EXTRACTION") {
    // Start extraction for a specific channel
    startExtraction(message.channelId)
      .then(() => {
        sendResponse({ success: true });
      })
      .catch(error => {
        console.error("Error starting extraction:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open for async response
  } else if (message.type === "STOP_EXTRACTION") {
    // Stop extraction for a specific channel
    stopExtraction(message.channelId)
      .then(() => {
        sendResponse({ success: true });
      })
      .catch(error => {
        console.error("Error stopping extraction:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open for async response
  } else if (message.type === "GET_CHANNEL_DATA") {
    // Get data for a specific channel
    getChannelData(message.channelId)
      .then(data => {
        sendResponse({ success: true, data: data });
      })
      .catch(error => {
        console.error("Error getting channel data:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open for async response
  } else if (message.type === "STORE_CHANNEL_DATA") {
    // Store data for a specific channel
    storeChannelData(message.channelId, message.data)
      .then(count => {
        sendResponse({ success: true, count: count });
      })
      .catch(error => {
        console.error("Error storing channel data:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open for async response
  } else if (message.type === "CLEAR_CHANNEL_DATA") {
    // Clear data for a specific channel
    clearChannelData(message.channelId)
      .then(() => {
        sendResponse({ success: true });
      })
      .catch(error => {
        console.error("Error clearing channel data:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep message channel open for async response
  } else if (message.type === "DOWNLOAD_CHANNEL_DATA") {
    // Get data for download (all channels or specific channel)
    if (message.channelId) {
      // Get specific channel data
      getChannelData(message.channelId)
        .then(data => {
          sendResponse({ success: true, data: data, channelId: message.channelId });
        })
        .catch(error => {
          console.error("Error getting channel data for download:", error);
          sendResponse({ success: false, error: error.message });
        });
    } else {
      // Get all channels data
      getAllChannelsData()
        .then(allData => {
          sendResponse({ success: true, data: allData });
        })
        .catch(error => {
          console.error("Error getting all channels data for download:", error);
          sendResponse({ success: false, error: error.message });
        });
    }
    return true; // Keep message channel open for async response
  } else if (message.type === "CONTENT_SCRIPT_LOADED") {
    // Content script loaded in a tab
    console.log("Content script loaded in tab:", sender.tab?.id);
  } else if (message.type === "GET_CHANNEL_FOR_TAB") {
    // Get channel ID for a specific tab
    const channelId = tabChannelMap[sender.tab?.id] || null;
    sendResponse({ success: true, channelId: channelId });
  } else if (message.type === "SET_CHANNEL_FOR_TAB") {
    // Set channel ID for a specific tab
    if (sender.tab?.id) {
      tabChannelMap[sender.tab.id] = message.channelId;
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: "No tab ID provided" });
    }
  }
});

// Listen for tab updates to track channel changes
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Check if this is a WhatsApp Web tab
  if (tab.url && tab.url.includes("web.whatsapp.com")) {
    // If the tab is fully loaded, we might want to check what channel it's on
    if (changeInfo.status === "complete") {
      console.log("WhatsApp Web tab updated:", tabId);
      // We could send a message to the content script to get channel info
      // but for now we'll just log it
    }
  }
});

// Listen for tab removal to clean up
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  // Remove tab from channel map
  if (tabChannelMap[tabId]) {
    delete tabChannelMap[tabId];
    console.log("Removed tab from channel map:", tabId);
  }
  
  // Stop any extractions associated with this tab
  // (In a more complex implementation, we might want to handle this)
});

// Initialize channels from storage
async function initializeChannels() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['channels'], (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      
      if (result.channels && Array.isArray(result.channels)) {
        channels = result.channels;
        console.log(`Initialized ${channels.length} channels`);
      } else {
        // Create default channels if none exist
        channels = [
          {
            id: 'aajtak_' + Date.now(),
            name: 'Aaj Tak',
            urlPattern: 'https://web.whatsapp.com/',
            interval: 5,
            isActive: false,
            lastExtraction: null
          },
          {
            id: 'ndtv_' + Date.now(),
            name: 'NDTV',
            urlPattern: 'https://web.whatsapp.com/',
            interval: 5,
            isActive: false,
            lastExtraction: null
          }
        ];
        
        // Save default channels
        chrome.storage.local.set({ channels: channels }, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          console.log("Created default channels");
        });
      }
      
      resolve();
    });
  });
}

// Add a new channel
async function addChannel(channel) {
  return new Promise((resolve, reject) => {
    // Generate ID if not provided
    if (!channel.id) {
      channel.id = channel.name.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();
    }
    
    // Set defaults
    channel.interval = channel.interval || 5;
    channel.isActive = channel.isActive || false;
    channel.lastExtraction = channel.lastExtraction || null;
    channel.urlPattern = channel.urlPattern || 'https://web.whatsapp.com/';
    
    // Add to channels array
    channels.push(channel);
    
    // Save to storage
    chrome.storage.local.set({ channels: channels }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      
      console.log("Added channel:", channel);
      resolve(channel);
    });
  });
}

// Update an existing channel
async function updateChannel(channelId, updates) {
  return new Promise((resolve, reject) => {
    const channelIndex = channels.findIndex(c => c.id === channelId);
    if (channelIndex === -1) {
      reject(new Error("Channel not found"));
      return;
    }
    
    // Apply updates
    channels[channelIndex] = { ...channels[channelIndex], ...updates };
    
    // Save to storage
    chrome.storage.local.set({ channels: channels }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      
      console.log("Updated channel:", channels[channelIndex]);
      resolve(channels[channelIndex]);
    });
  });
}

// Remove a channel
async function removeChannel(channelId) {
  return new Promise((resolve, reject) => {
    const channelIndex = channels.findIndex(c => c.id === channelId);
    if (channelIndex === -1) {
      reject(new Error("Channel not found"));
      return;
    }
    
    // Remove from channels array
    const removedChannel = channels.splice(channelIndex, 1)[0];
    
    // Stop any active extraction
    stopExtraction(channelId);
    
    // Remove channel data
    clearChannelData(channelId)
      .then(() => {
        // Save to storage
        chrome.storage.local.set({ channels: channels }, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          
          console.log("Removed channel:", removedChannel);
          resolve();
        });
      })
      .catch(error => {
        console.error("Error clearing channel data:", error);
        // Still save channels even if data clearing fails
        chrome.storage.local.set({ channels: channels }, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          
          console.log("Removed channel (data clearing failed):", removedChannel);
          resolve();
        });
      });
  });
}

// Start extraction for a channel
async function startExtraction(channelId) {
  return new Promise((resolve, reject) => {
    const channel = channels.find(c => c.id === channelId);
    if (!channel) {
      reject(new Error("Channel not found"));
      return;
    }
    
    // Stop any existing extraction for this channel
    stopExtraction(channelId);
    
    // Update channel status
    channel.isActive = true;
    channel.lastExtraction = new Date().toISOString();
    
    // Save to storage
    chrome.storage.local.set({ channels: channels }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      
      // Set up interval for periodic extraction
      const intervalMs = channel.interval * 60 * 1000; // Convert minutes to milliseconds
      
      // Do an initial extraction
      performChannelExtraction(channelId);
      
      // Set up interval for periodic extraction
      activeExtractions[channelId] = setInterval(() => {
        performChannelExtraction(channelId);
      }, intervalMs);
      
      console.log(`Started extraction for channel ${channel.name} with ${channel.interval} minute intervals`);
      resolve();
    });
  });
}

// Stop extraction for a channel
async function stopExtraction(channelId) {
  return new Promise((resolve) => {
    const channel = channels.find(c => c.id === channelId);
    if (!channel) {
      resolve();
      return;
    }
    
    // Update channel status
    channel.isActive = false;
    
    // Clear interval if exists
    if (activeExtractions[channelId]) {
      clearInterval(activeExtractions[channelId]);
      delete activeExtractions[channelId];
    }
    
    // Save to storage
    chrome.storage.local.set({ channels: channels }, () => {
      if (chrome.runtime.lastError) {
        console.error("Error saving channel status:", chrome.runtime.lastError.message);
      }
      
      console.log(`Stopped extraction for channel ${channel.name}`);
      resolve();
    });
  });
}

// Perform extraction for a specific channel
async function performChannelExtraction(channelId) {
  const channel = channels.find(c => c.id === channelId);
  if (!channel) {
    return;
  }
  
  // Update last extraction time
  channel.lastExtraction = new Date().toISOString();
  
  // Save to storage
  chrome.storage.local.set({ channels: channels }, () => {
    if (chrome.runtime.lastError) {
      console.error("Error updating last extraction time:", chrome.runtime.lastError.message);
    }
  });
  
  console.log(`Performed extraction for channel ${channel.name}`);
  
  // In a real implementation, we would:
  // 1. Find or create a tab for this channel
  // 2. Navigate to the channel if needed
  // 3. Extract data from that tab
  // 4. Store the extracted data
  // For now, we'll just update the timestamp
}

// Get data for a specific channel
async function getChannelData(channelId) {
  return new Promise((resolve, reject) => {
    const key = `channelData_${channelId}`;
    chrome.storage.local.get([key], (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      
      resolve(result[key] || []);
    });
  });
}

// Store data for a specific channel
async function storeChannelData(channelId, data) {
  return new Promise((resolve, reject) => {
    // Get existing data
    getChannelData(channelId)
      .then(existingData => {
        // Add new data, avoiding duplicates
        const newData = data.filter(item => 
          !existingData.includes(item)
        );
        
        const combinedData = [...existingData, ...newData];
        
        // Keep only the latest 500 items to prevent excessive memory usage
        const finalData = combinedData.length > 500 ? 
          combinedData.slice(-500) : combinedData;
        
        // Save to storage
        const key = `channelData_${channelId}`;
        const saveData = {};
        saveData[key] = finalData;
        
        chrome.storage.local.set(saveData, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          
          console.log(`Stored ${newData.length} new items for channel ${channelId}. Total: ${finalData.length}`);
          resolve(finalData.length);
        });
      })
      .catch(error => {
        reject(error);
      });
  });
}

// Clear data for a specific channel
async function clearChannelData(channelId) {
  return new Promise((resolve, reject) => {
    const key = `channelData_${channelId}`;
    chrome.storage.local.remove([key], () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      
      console.log(`Cleared data for channel ${channelId}`);
      resolve();
    });
  });
}

// Get data for all channels
async function getAllChannelsData() {
  return new Promise((resolve, reject) => {
    // Get all channel data keys
    const keys = channels.map(channel => `channelData_${channel.id}`);
    
    chrome.storage.local.get(keys, (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      
      // Format data with channel information
      const allData = channels.map(channel => {
        const key = `channelData_${channel.id}`;
        return {
          channelId: channel.id,
          channelName: channel.name,
          data: result[key] || []
        };
      });
      
      resolve(allData);
    });
  });
}

// Load channels from storage when extension starts
chrome.runtime.onStartup.addListener(() => {
  initializeChannels()
    .catch(error => {
      console.error("Error initializing channels on startup:", error);
    });
});

// Also load on install
chrome.runtime.onInstalled.addListener(() => {
  initializeChannels()
    .catch(error => {
      console.error("Error initializing channels on install:", error);
    });
});