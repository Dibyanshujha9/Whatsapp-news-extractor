// Content script for WhatsApp News Extractor
console.log("WhatsApp News Extractor content script loaded");

// Function to extract headlines from WhatsApp Web
function extractHeadlines(limit = 30) {
  let headlines = [];
  
  // Try multiple selectors as WhatsApp Web might change their structure
  const selectors = [
    "div[role='textbox']",
    "div.selectable-text",
    "div.copyable-text",
    "span[dir='auto']",
    "div.message-in",
    "div.message-out",
    "div[role='row']"
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
      if (text && text.length > 5 && !headlines.includes(text)) {
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
      let data = extractHeadlines();
      console.log("Sending response with headlines:", data);
      sendResponse({ headlines: data, success: true });
    } catch (error) {
      console.error("Error extracting headlines:", error);
      sendResponse({ error: error.message, success: false });
    }
  } else if (request.action === "ping") {
    // Simple ping to check if content script is alive
    sendResponse({ status: "alive" });
  }
  
  // Return true to indicate you want to send a response asynchronously
  return true;
});

console.log("WhatsApp News Extractor content script initialized");
