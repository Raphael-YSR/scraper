// content.js - Simplified and fixed version

(function() {
    'use strict';
    
    console.log('Bible extractor content script loaded');

    // Function to extract verses from the page
    function extractVerses() {
        const verses = [];
        
        try {
            // Method 1: Try to find verses with data-usfm attributes
            const verseElements = document.querySelectorAll('span[data-usfm]');
            
            if (verseElements.length > 0) {
                console.log(`Found ${verseElements.length} verse elements with data-usfm`);
                
                let currentVerse = null;
                let currentText = "";
                
                verseElements.forEach((element, index) => {
                    const usfmAttr = element.getAttribute('data-usfm');
                    
                    if (usfmAttr && usfmAttr.includes('.')) {
                        const parts = usfmAttr.split('.');
                        if (parts.length >= 3) {
                            // This is a verse start
                            if (currentVerse !== null && currentText.trim()) {
                                verses.push({
                                    verseNumber: currentVerse,
                                    verseText: currentText.trim().replace(/\s+/g, ' ')
                                });
                            }
                            currentVerse = parts[parts.length - 1];
                            currentText = "";
                        }
                    }
                    
                    // Get text content, excluding footnotes and verse numbers
                    const clonedElement = element.cloneNode(true);
                    
                    // Remove verse number labels
                    const labels = clonedElement.querySelectorAll('span.ChapterContent_label__R2PLt, .verse-num, .v-num');
                    labels.forEach(label => label.remove());
                    
                    // Remove footnotes
                    const footnotes = clonedElement.querySelectorAll('span.ChapterContent_note__YlDW0, .note, .footnote');
                    footnotes.forEach(footnote => footnote.remove());
                    
                    const text = clonedElement.textContent.trim();
                    if (text) {
                        currentText += " " + text;
                    }
                    
                    // If this is the last element, don't forget to add the verse
                    if (index === verseElements.length - 1 && currentVerse && currentText.trim()) {
                        verses.push({
                            verseNumber: currentVerse,
                            verseText: currentText.trim().replace(/\s+/g, ' ')
                        });
                    }
                });
            }
            
            // Method 2: Fallback to older structure
            if (verses.length === 0) {
                console.log('Trying fallback method for verse extraction');
                
                const verseContainers = document.querySelectorAll('span.ChapterContent_verse__57FIw, .verse, [data-verse]');
                
                verseContainers.forEach(container => {
                    let verseNumber = '';
                    let verseText = '';
                    
                    // Try to find verse number
                    const verseNumElement = container.querySelector('span.ChapterContent_label__R2PLt, .verse-num, .v-num');
                    if (verseNumElement) {
                        verseNumber = verseNumElement.textContent.trim().replace(/\D/g, '');
                    } else if (container.getAttribute('data-verse')) {
                        verseNumber = container.getAttribute('data-verse');
                    }
                    
                    // Get verse text
                    const clonedContainer = container.cloneNode(true);
                    
                    // Remove verse number and footnotes
                    const unwantedElements = clonedContainer.querySelectorAll(
                        'span.ChapterContent_label__R2PLt, .verse-num, .v-num, ' +
                        'span.ChapterContent_note__YlDW0, .note, .footnote'
                    );
                    unwantedElements.forEach(el => el.remove());
                    
                    verseText = clonedContainer.textContent.trim().replace(/\s+/g, ' ');
                    
                    if (verseNumber && verseText) {
                        verses.push({
                            verseNumber: verseNumber,
                            verseText: verseText
                        });
                    }
                });
            }
            
            // Method 3: Last resort - try to find any text that looks like verses
            if (verses.length === 0) {
                console.log('Trying last resort method for verse extraction');
                
                // Look for any numbered text that might be verses
                const allSpans = document.querySelectorAll('span');
                const potentialVerses = [];
                
                allSpans.forEach(span => {
                    const text = span.textContent.trim();
                    if (text.match(/^\d+\s+/)) {
                        // Text starts with a number - might be a verse
                        const match = text.match(/^(\d+)\s+(.+)$/);
                        if (match) {
                            potentialVerses.push({
                                verseNumber: match[1],
                                verseText: match[2].trim()
                            });
                        }
                    }
                });
                
                if (potentialVerses.length > 0) {
                    verses.push(...potentialVerses);
                }
            }
            
        } catch (error) {
            console.error('Error extracting verses:', error);
        }
        
        console.log(`Extracted ${verses.length} verses:`, verses);
        return verses;
    }

    // Function to check if page has loaded with verse content
    function isPageReady() {
        const verseElements = document.querySelectorAll(
            'span[data-usfm], span.ChapterContent_verse__57FIw, .verse, [data-verse]'
        );
        return verseElements.length > 0;
    }

    // Message listener
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        console.log('Received message:', request);
        
        try {
            if (request.action === "extractVerses") {
                const verses = extractVerses();
                sendResponse({ verses: verses });
                return true;
            } else if (request.action === "checkPageLoaded") {
                const loaded = isPageReady();
                sendResponse({ loaded: loaded });
                return true;
            }
        } catch (error) {
            console.error('Error handling message:', error);
            sendResponse({ error: error.message });
        }
        
        return false;
    });

    // Signal that the content script is ready
    console.log('Bible extractor content script ready');
    
})();