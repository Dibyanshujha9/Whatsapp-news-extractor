// Content script for WhatsApp News Extractor - Multi-Channel Support
console.log("WhatsApp News Extractor content script loaded");

// Function to get the current active channel name
function getActiveChannel() {
  try {
    // Look for the channel name in the WhatsApp Web UI
    // This selector might need to be updated based on WhatsApp Web's structure
    const channelHeader = document.querySelector("header[data-testid='chatlist-header'] div div div div div span");
    if (channelHeader) {
      return channelHeader.textContent.trim();
    }
    
    // Alternative selectors for channel name
    const altSelectors = [
      "div[data-testid='conversation-info'] div span",
      "header[data-testid='header'] div div div span",
      "div[data-testid='chat-list'] div div div div div span"
    ];
    
    for (const selector of altSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent) {
        const channelName = element.textContent.trim();
        if (channelName.length > 0) {
          return channelName;
        }
      }
    }
    
    // If we can't find the channel name, return a generic identifier
    return "Unknown Channel";
  } catch (error) {
    console.error("Error getting active channel:", error);
    return "Unknown Channel";
  }
}

// Function to extract headlines from WhatsApp Web
function extractHeadlines(limit = 30) {
  let headlines = [];
  
  // Try multiple selectors as WhatsApp Web might change their structure
  const selectors = [
    "div[role='row'] div span",
    "div.message-in div span",
    "div.message-out div span",
    "div.copyable-text",
    "div.selectable-text",
    "div[role='textbox']",
    "span[dir='auto']"
  ];
  
  // Try each selector until we find messages
  for (const selector of selectors) {
    const messages = document.querySelectorAll(selector);
    console.log(`Found ${messages.length} elements with selector: ${selector}`);
    
    for (let msg of messages) {
      // Skip if it's a button or other non-text element
      if (msg.tagName === 'BUTTON' || msg.getAttribute('role') === 'button') {
        continue;
      }
      
      let text = msg.innerText?.trim();
      // Filter out very short texts and common UI elements
      if (text && text.length > 10 && 
          !text.includes("‎") && // WhatsApp special characters
          !text.includes("typing") &&
          !text.includes("online") &&
          !headlines.includes(text)) {
        headlines.push(text);
      }
      if (headlines.length >= limit) break;
    }
    
    // If we found headlines, stop trying other selectors
    if (headlines.length > 0) {
      break;
    }
  }
  
  console.log("Extracted headlines:", headlines);
  return headlines;
}

// Send a message to the popup to confirm the content script is loaded
chrome.runtime.sendMessage({ 
  type: "CONTENT_SCRIPT_LOADED",
  status: "ready"
}).catch(err => {
  // This might fail if the popup isn't listening, which is fine
  console.log("Content script loaded message could not be sent:", err);
});

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Content script received message:", request);
  
  if (request.action === "extractHeadlines") {
    try {
      const channelName = getActiveChannel();
      let data = extractHeadlines();
      console.log("Sending response with headlines:", data);
      sendResponse({ 
        headlines: data, 
        success: true,
        channelName: channelName
      });
    } catch (error) {
      console.error("Error extracting headlines:", error);
      sendResponse({ error: error.message, success: false });
    }
  } else if (request.action === "ping") {
    // Simple ping to check if content script is alive
    sendResponse({ status: "alive" });
  } else if (request.action === "getChannelInfo") {
    try {
      const channelName = getActiveChannel();
      sendResponse({ 
        channelName: channelName,
        success: true
      });
    } catch (error) {
      console.error("Error getting channel info:", error);
      sendResponse({ error: error.message, success: false });
    }
  }
  
  // Return true to indicate you want to send a response asynchronously
  return true;
});

console.log("WhatsApp News Extractor content script initialized");
