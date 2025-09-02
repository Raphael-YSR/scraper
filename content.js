// content.js - Fixed version with proper verse consolidation and footnote handling

(function() {
    'use strict';
    
    console.log('Bible extractor content script loaded');

    // Function to extract verses from the page
    function extractVerses() {
        const verses = [];
        
        try {
            // Method 1: Try to find verses with data-usfm attributes (primary method)
            const verseElements = document.querySelectorAll('span[data-usfm]');
            
            if (verseElements.length > 0) {
                console.log(`Found ${verseElements.length} verse elements with data-usfm`);
                
                const verseMap = new Map(); // To consolidate verses by number
                let hasFootnotes = false;
                
                verseElements.forEach((element) => {
                    const usfmAttr = element.getAttribute('data-usfm');
                    
                    if (usfmAttr && usfmAttr.includes('.')) {
                        const parts = usfmAttr.split('.');
                        if (parts.length >= 3) {
                            const verseNumber = parts[parts.length - 1];
                            
                            // Get text content, excluding footnotes and verse numbers
                            const clonedElement = element.cloneNode(true);
                            
                            // Remove verse number labels
                            const labels = clonedElement.querySelectorAll('span.ChapterContent_label__R2PLt, .verse-num, .v-num');
                            labels.forEach(label => label.remove());
                            
                            // Check for footnotes before removing them
                            const footnotes = clonedElement.querySelectorAll('span.ChapterContent_note__YlDW0, .note, .footnote');
                            if (footnotes.length > 0) {
                                hasFootnotes = true;
                                footnotes.forEach(footnote => footnote.remove());
                            }
                            
                            const text = clonedElement.textContent.trim();
                            if (text) {
                                // Consolidate text by verse number
                                if (verseMap.has(verseNumber)) {
                                    const existingText = verseMap.get(verseNumber);
                                    verseMap.set(verseNumber, existingText + ' ' + text);
                                } else {
                                    verseMap.set(verseNumber, text);
                                }
                            }
                        }
                    }
                });
                
                // Convert map to verses array
                verseMap.forEach((text, verseNumber) => {
                    verses.push({
                        verseNumber: verseNumber,
                        verseText: text.replace(/\s+/g, ' ').trim(),
                        hasFootnotes: hasFootnotes
                    });
                });
                
                // Sort verses by number
                verses.sort((a, b) => parseInt(a.verseNumber) - parseInt(b.verseNumber));
            }
            
            // Method 2: Fallback to older structure
            if (verses.length === 0) {
                console.log('Trying fallback method for verse extraction');
                
                const verseContainers = document.querySelectorAll('span.ChapterContent_verse__57FIw, .verse, [data-verse]');
                
                verseContainers.forEach(container => {
                    let verseNumber = '';
                    let verseText = '';
                    let hasFootnotes = false;
                    
                    // Try to find verse number
                    const verseNumElement = container.querySelector('span.ChapterContent_label__R2PLt, .verse-num, .v-num');
                    if (verseNumElement) {
                        verseNumber = verseNumElement.textContent.trim().replace(/\D/g, '');
                    } else if (container.getAttribute('data-verse')) {
                        verseNumber = container.getAttribute('data-verse');
                    }
                    
                    // Get verse text
                    const clonedContainer = container.cloneNode(true);
                    
                    // Check for footnotes
                    const footnotes = clonedContainer.querySelectorAll('span.ChapterContent_note__YlDW0, .note, .footnote');
                    if (footnotes.length > 0) {
                        hasFootnotes = true;
                        footnotes.forEach(footnote => footnote.remove());
                    }
                    
                    // Remove verse number labels
                    const labels = clonedContainer.querySelectorAll('span.ChapterContent_label__R2PLt, .verse-num, .v-num');
                    labels.forEach(label => label.remove());
                    
                    verseText = clonedContainer.textContent.trim().replace(/\s+/g, ' ');
                    
                    if (verseNumber && verseText) {
                        verses.push({
                            verseNumber: verseNumber,
                            verseText: verseText,
                            hasFootnotes: hasFootnotes
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
                                verseText: match[2].trim(),
                                hasFootnotes: false
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