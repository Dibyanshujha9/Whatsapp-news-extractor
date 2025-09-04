# WhatsApp News Extractor - Troubleshooting Guide

## Common Issues and Solutions

### 1. "Could not connect to WhatsApp Web" Error

This error typically occurs when the content script isn't properly communicating with the popup. Here's how to troubleshoot:

#### Check 1: Extension Installation
1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Find "WhatsApp News Extractor" in the list
4. Ensure it's enabled
5. Click the refresh icon to reload the extension

#### Check 2: Content Script Loading
1. Navigate to https://web.whatsapp.com
2. Open the Aaj Tak channel
3. Press F12 to open Developer Tools
4. Go to the Console tab
5. Look for "WhatsApp News Extractor content script loaded" message
6. If you don't see this message, try refreshing the page

#### Check 3: Correct Page
1. Ensure you're on https://web.whatsapp.com (not a different domain)
2. Make sure you're in the Aaj Tak channel
3. Verify messages are visible on the page

#### Check 4: Extension Permissions
1. In `chrome://extensions/`, click the details button for WhatsApp News Extractor
2. Verify that the extension has access to https://web.whatsapp.com/*
3. If not, try removing and re-adding the extension

### 2. "No headlines found" Message

This occurs when the selector in the content script doesn't match the WhatsApp Web elements.

#### Solution:
1. Scroll down in the Aaj Tak channel to load messages
2. Try refreshing the page
3. If the issue persists, the selectors in content.js might need updating

### 3. Debugging Steps

#### View Extension Console:
1. Right-click on the extension icon
2. Select "Manage Extensions"
3. Click "Inspect views" next to the extension
4. Check for any error messages

#### View Content Script Console:
1. On WhatsApp Web, press F12 to open Developer Tools
2. Go to the Console tab
3. Look for messages from the content script

#### Check Manifest:
1. Verify all required permissions are listed
2. Confirm content script matches are correct

### 4. Manual Testing

You can manually test if the content script is working:

1. On WhatsApp Web, press F12 to open Developer Tools
2. Go to the Console tab
3. Run this code:
   ```javascript
   // Test function to extract headlines
   function testExtract() {
     let headlines = [];
     let messages = document.querySelectorAll("div[role='textbox'], div.selectable-text, div.copyable-text, span[dir='auto']");
     
     for (let msg of messages) {
       let text = msg.innerText?.trim();
       if (text && !headlines.includes(text)) {
         headlines.push(text);
       }
       if (headlines.length >= 5) break;
     }
     
     console.log("Found headlines:", headlines);
     return headlines;
   }
   
   testExtract();
   ```

If this returns headlines, the content script selector is working.

### 5. Selector Updates

WhatsApp Web frequently updates their UI, which might break the selectors. To update them:

1. Inspect WhatsApp Web messages using Developer Tools
2. Identify the correct CSS selectors for messages
3. Update the `document.querySelectorAll()` in content.js
4. Reload the extension

Common selectors to try:
- `div[role='row']`
- `div.copyable-text`
- `span.selectable-text`
- `div.message-in`
- `div.message-out`