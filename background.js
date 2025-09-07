// Background script for WhatsApp News Extractor

// Global variables to manage accumulated data
let accumulatedData = [];

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background received message:", message);
  
  if (message.type === "STORE_DATA") {
    // Store new headlines
    if (message.data && Array.isArray(message.data)) {
      // Add new headlines to accumulated data, avoiding duplicates
      const newData = message.data.filter(headline => 
        !accumulatedData.includes(headline)
      );
      
      accumulatedData = [...accumulatedData, ...newData];
      
      // Keep only the latest 500 headlines to prevent excessive memory usage
      if (accumulatedData.length > 500) {
        accumulatedData = accumulatedData.slice(-500);
      }
      
      // Save to storage
      chrome.storage.local.set({ 
        accumulatedHeadlines: accumulatedData,
        lastUpdate: new Date().toISOString()
      }, () => {
        if (chrome.runtime.lastError) {
          console.error("Error saving to storage:", chrome.runtime.lastError.message);
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          console.log(`Stored ${newData.length} new headlines. Total: ${accumulatedData.length}`);
          sendResponse({ success: true, count: accumulatedData.length });
        }
      });
    } else {
      sendResponse({ success: false, error: "Invalid data format" });
    }
  } else if (message.type === "GET_ACCUMULATED_DATA") {
    // Return accumulated data
    sendResponse({ success: true, data: accumulatedData });
  } else if (message.type === "CLEAR_ACCUMULATED_DATA") {
    // Clear accumulated data
    accumulatedData = [];
    chrome.storage.local.remove(['accumulatedHeadlines'], () => {
      if (chrome.runtime.lastError) {
        console.error("Error clearing storage:", chrome.runtime.lastError.message);
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        console.log("Data cleared from storage");
        sendResponse({ success: true, message: "Data cleared" });
      }
    });
  } else if (message.type === "GET_DATA_COUNT") {
    // Return data count
    sendResponse({ success: true, count: accumulatedData.length });
  }
  
  // Return true to indicate we'll send a response asynchronously
  return true;
});

// Load accumulated data from storage when extension starts
chrome.runtime.onStartup.addListener(() => {
  loadFromStorage();
});

// Also load on install
chrome.runtime.onInstalled.addListener(() => {
  loadFromStorage();
});

// Function to load data from storage
function loadFromStorage() {
  chrome.storage.local.get(['accumulatedHeadlines'], (result) => {
    if (chrome.runtime.lastError) {
      console.error("Error loading from storage:", chrome.runtime.lastError.message);
      return;
    }
    
    if (result.accumulatedHeadlines) {
      accumulatedData = result.accumulatedHeadlines;
      console.log(`Loaded ${accumulatedData.length} headlines from storage`);
    }
  });
}