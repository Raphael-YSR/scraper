// content.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "extractVerses") {
        const verses = [];
        
        // Get all verse elements that have data-usfm attributes (these contain the verse references)
        const verseElements = document.querySelectorAll('span[data-usfm]');
        
        if (verseElements.length === 0) {
            // Fallback: try the original selector
            const verseContainers = document.querySelectorAll('span.ChapterContent_verse__57FIw');
            
            verseContainers.forEach(verseContainer => {
                const verseNumberElement = verseContainer.querySelector('span.ChapterContent_label__R2PLt');
                
                if (verseNumberElement) {
                    const verseNumber = verseNumberElement.textContent.trim().replace(/\D/g, '');
                    
                    // Get all text content, but exclude footnotes
                    const clonedContainer = verseContainer.cloneNode(true);
                    
                    // Remove verse number
                    const clonedVerseNumber = clonedContainer.querySelector('span.ChapterContent_label__R2PLt');
                    if (clonedVerseNumber) clonedVerseNumber.remove();
                    
                    // Remove footnotes
                    const footnotes = clonedContainer.querySelectorAll('span.ChapterContent_note__YlDW0');
                    footnotes.forEach(footnote => footnote.remove());
                    
                    const verseText = clonedContainer.textContent.trim().replace(/\s+/g, ' ');
                    
                    if (verseNumber && verseText) {
                        verses.push({
                            verseNumber: verseNumber,
                            verseText: verseText
                        });
                    }
                }
            });
        } else {
            // Process verses by their data-usfm attributes
            const verseMap = new Map();
            
            verseElements.forEach(element => {
                const usfmAttr = element.getAttribute('data-usfm');
                if (usfmAttr && usfmAttr.includes('.')) {
                    // Extract verse number from data-usfm (e.g., "REV.4.1" -> "1")
                    const parts = usfmAttr.split('.');
                    const verseNumber = parts[parts.length - 1];
                    
                    if (!verseMap.has(verseNumber)) {
                        verseMap.set(verseNumber, []);
                    }
                    
                    // Clone element and clean it
                    const clonedElement = element.cloneNode(true);
                    
                    // Remove verse number labels
                    const labels = clonedElement.querySelectorAll('span.ChapterContent_label__R2PLt');
                    labels.forEach(label => label.remove());
                    
                    // Remove footnotes
                    const footnotes = clonedElement.querySelectorAll('span.ChapterContent_note__YlDW0');
                    footnotes.forEach(footnote => footnote.remove());
                    
                    const text = clonedElement.textContent.trim();
                    if (text) {
                        verseMap.get(verseNumber).push(text);
                    }
                }
            });
            
            // Convert map to verses array
            for (const [verseNumber, textParts] of verseMap) {
                const verseText = textParts.join(' ').replace(/\s+/g, ' ').trim();
                if (verseText) {
                    verses.push({
                        verseNumber: verseNumber,
                        verseText: verseText
                    });
                }
            }
        }
        
        // Sort verses by number
        verses.sort((a, b) => parseInt(a.verseNumber) - parseInt(b.verseNumber));
        
        // If we still don't have verses, try a more aggressive approach
        if (verses.length === 0) {
            console.log('Trying aggressive extraction...');
            
            // Look for the chapter container
            const chapterContainer = document.querySelector('.ChapterContent_chapter__uvbXo');
            if (chapterContainer) {
                // Get all elements that might contain verse content
                const allElements = chapterContainer.querySelectorAll('*');
                let currentVerse = null;
                let currentText = '';
                
                allElements.forEach(element => {
                    // Check if this element contains a verse number
                    const label = element.querySelector('span.ChapterContent_label__R2PLt');
                    if (label && element.hasAttribute('data-usfm')) {
                        // Save previous verse if exists
                        if (currentVerse && currentText.trim()) {
                            verses.push({
                                verseNumber: currentVerse,
                                verseText: currentText.trim().replace(/\s+/g, ' ')
                            });
                        }
                        
                        // Start new verse
                        const usfmAttr = element.getAttribute('data-usfm');
                        const parts = usfmAttr.split('.');
                        currentVerse = parts[parts.length - 1];
                        
                        // Get text from this element, excluding footnotes and labels
                        const clonedElement = element.cloneNode(true);
                        clonedElement.querySelectorAll('span.ChapterContent_label__R2PLt').forEach(l => l.remove());
                        clonedElement.querySelectorAll('span.ChapterContent_note__YlDW0').forEach(f => f.remove());
                        currentText = clonedElement.textContent.trim();
                    }
                });
                
                // Don't forget the last verse
                if (currentVerse && currentText.trim()) {
                    verses.push({
                        verseNumber: currentVerse,
                        verseText: currentText.trim().replace(/\s+/g, ' ')
                    });
                }
            }
        }
        
        console.log(`Extracted ${verses.length} verses:`, verses);
        sendResponse({ verses: verses });
        return true;
    }
});