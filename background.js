// background.js - Enhanced with keep-alive functionality

// Keep track of active extractions
let activeExtractions = new Set();
let keepAliveInterval = null;

// Start keep-alive mechanism
const startKeepAlive = () => {
    if (keepAliveInterval) return;
    
    console.log('Starting keep-alive mechanism');
    
    // Use a more aggressive keep-alive approach
    keepAliveInterval = setInterval(() => {
        console.log('Keep-alive ping');
        
        // Query all tabs to keep the background script active
        chrome.tabs.query({}, (tabs) => {
            // This query keeps the background script alive
        });
        
        // Also try to prevent throttling by accessing storage
        chrome.storage.local.get('keepAlive', (result) => {
            chrome.storage.local.set({
                keepAlive: Date.now()
            });
        });
    }, 5000); // Every 5 seconds during extraction
};

// Stop keep-alive mechanism
const stopKeepAlive = () => {
    if (keepAliveInterval) {
        console.log('Stopping keep-alive mechanism');
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
    }
};

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Background script received message:', request);
    
    if (request.action === "keepAlive") {
        // Popup is requesting keep-alive
        if (!keepAliveInterval) {
            startKeepAlive();
        }
        sendResponse({ status: "alive" });
        return true;
    }
    
    if (request.action === "startExtraction") {
        activeExtractions.add(request.extractionId || 'default');
        startKeepAlive();
        sendResponse({ status: "started" });
        return true;
    }
    
    if (request.action === "stopExtraction") {
        activeExtractions.delete(request.extractionId || 'default');
        if (activeExtractions.size === 0) {
            stopKeepAlive();
        }
        sendResponse({ status: "stopped" });
        return true;
    }
    
    return false;
});

// Handle extension startup
chrome.runtime.onStartup.addListener(() => {
    console.log('Extension started');
});

// Handle extension install/update
chrome.runtime.onInstalled.addListener(() => {
    console.log('Extension installed/updated');
});

// Prevent service worker from going to sleep during active extractions
const preventSleep = () => {
    if (activeExtractions.size > 0) {
        // Create a port connection to keep the service worker alive
        const port = chrome.runtime.connect({ name: "keepAlive" });
        
        port.onDisconnect.addListener(() => {
            // Reconnect if disconnected during active extraction
            if (activeExtractions.size > 0) {
                setTimeout(preventSleep, 1000);
            }
        });
    }
};

// Tab update listener to handle navigation during extraction
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (activeExtractions.size > 0 && changeInfo.status === 'complete') {
        console.log(`Tab ${tabId} updated during extraction: ${tab.url}`);
        
        // Inject content script if it's a Bible page
        if (tab.url && tab.url.includes('bible.com')) {
            chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['content.js']
            }).catch(error => {
                console.log('Content script already injected or error:', error);
            });
        }
    }
});

// Clean up when extension is suspended
chrome.runtime.onSuspend.addListener(() => {
    console.log('Extension suspending, cleaning up...');
    stopKeepAlive();
    activeExtractions.clear();
});

// Handle connection from content scripts or popup
chrome.runtime.onConnect.addListener((port) => {
    console.log('Port connected:', port.name);
    
    if (port.name === "keepAlive") {
        port.onDisconnect.addListener(() => {
            console.log('Keep-alive port disconnected');
            // Try to reconnect if we still have active extractions
            if (activeExtractions.size > 0) {
                setTimeout(preventSleep, 1000);
            }
        });
    }
});

// Initialize
console.log('Bible Extractor background script loaded');