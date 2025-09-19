// Background script for WhatsApp News Extractor

// Listen for messages from the content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background received message:", message);
  
  // Just log the message for now, but we could add functionality here later
  if (message.type === "CONTENT_SCRIPT_LOADED") {
    console.log("Content script loaded in tab:", sender.tab?.id);
  }
  
  // We don't need to send a response for this message
  // sendResponse is only needed if the sender expects a response
});
This code helps to console the content script 
