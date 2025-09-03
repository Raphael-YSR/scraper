// content.js - Fixed version with proper verse consolidation and footnote handling

(function() {
    'use strict';
    
    console.log('Bible extractor content script loaded');

    // Function to convert combined verse numbers to concatenated format
    function formatVerseNumber(verseLabel) {
        if (!verseLabel) return '';
        
        // Handle ranges like "14-15" -> "1415", "7-8" -> "78", "20-23" -> "2023"
        if (verseLabel.includes('-')) {
            const parts = verseLabel.split('-');
            if (parts.length === 2) {
                const start = parts[0].trim();
                const end = parts[1].trim();
                return start + end;
            }
        }
        
        // Single verse numbers remain unchanged
        return verseLabel.trim();
    }

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
                        // Always try to get verse number from label element first (more reliable for combined verses)
                        const labelElement = element.querySelector('span.ChapterContent_label__R2PLt, .verse-num, .v-num');
                        let verseNumber = '';
                        
                        if (labelElement) {
                            const labelText = labelElement.textContent.trim();
                            verseNumber = formatVerseNumber(labelText);
                            console.log(`Found label: "${labelText}" -> formatted: "${verseNumber}"`);
                        }
                        
                        // Only use data-usfm as fallback if no label found
                        if (!verseNumber) {
                            const parts = usfmAttr.split('.');
                            if (parts.length >= 3) {
                                verseNumber = parts[parts.length - 1];
                                console.log(`Using data-usfm fallback: "${verseNumber}"`);
                            }
                        }
                        
                        if (verseNumber) {
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
                
                // Sort verses by the first number in combined verses (e.g., "1415" sorts by 14)
                verses.sort((a, b) => {
                    const aNum = parseInt(a.verseNumber.match(/^\d+/)[0]);
                    const bNum = parseInt(b.verseNumber.match(/^\d+/)[0]);
                    return aNum - bNum;
                });
            }
            
            // Method 2: Fallback to older structure
            if (verses.length === 0) {
                console.log('Trying fallback method for verse extraction');
                
                const verseContainers = document.querySelectorAll('span.ChapterContent_verse__57FIw, .verse, [data-verse]');
                
                verseContainers.forEach(container => {
                    let verseNumber = '';
                    let verseText = '';
                    let hasFootnotes = false;
                    
                    // Try to find verse number - check for combined verses
                    const verseNumElement = container.querySelector('span.ChapterContent_label__R2PLt, .verse-num, .v-num');
                    if (verseNumElement) {
                        const labelText = verseNumElement.textContent.trim();
                        // Convert combined verses to concatenated format
                        verseNumber = formatVerseNumber(labelText);
                    } else if (container.getAttribute('data-verse')) {
                        verseNumber = formatVerseNumber(container.getAttribute('data-verse'));
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