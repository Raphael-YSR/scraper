(function() {
    'use strict';

    console.log('Bible extractor content script loaded');

    // Function to convert combined verse numbers to concatenated format
    function formatVerseNumber(verseLabel) {
        if (!verseLabel) return '';

        // Skip footnote markers
        if (verseLabel === '#' || verseLabel.trim() === '#') {
            return null;
        }

        // Handle ranges like "14-15" -> "1415", "7-8" -> "78", "20-23" -> "2023"
        if (verseLabel.includes('-')) {
            const parts = verseLabel.split('-');
            if (parts.length === 2) {
                const start = parts[0].trim();
                const end = parts[1].trim();
                return start + end;
            }
        }

        // Handle combined verses like "5-6" in labels
        if (verseLabel.includes('+')) {
            // For data-usfm like "PSA.27.5+PSA.27.6", extract and format
            const parts = verseLabel.split('+');
            if (parts.length === 2) {
                const firstVerse = parts[0].split('.').pop();
                const secondVerse = parts[1].split('.').pop();
                return firstVerse + secondVerse;
            }
        }

        // Single verse numbers remain unchanged
        return verseLabel.trim();
    }

    // Function to extract text from a given element, removing unwanted spans
    function extractTextFromElement(element) {
        const cloned = element.cloneNode(true);
        let hasFootnotes = false;

        // Remove verse labels
        const labels = cloned.querySelectorAll('span.ChapterContent_label__R2PLt, .verse-num, .v-num');
        labels.forEach(label => label.remove());

        // Check for and remove footnotes
        const footnotes = cloned.querySelectorAll('span.ChapterContent_note__YlDW0, .note, .footnote');
        if (footnotes.length > 0) {
            hasFootnotes = true;
            footnotes.forEach(fn => fn.remove());
        }

        // Remove headings and section markers
        const headings = cloned.querySelectorAll('.ChapterContent_heading__xBDcs, .ChapterContent_s1__bNNaW, .ChapterContent_ms4__6Q9TL, .ChapterContent_d__OHSpy');
        headings.forEach(heading => heading.remove());

        // Get the clean text
        const text = cloned.textContent.replace(/\s+/g, ' ').trim();

        return { text, hasFootnotes };
    }

    // Main function to extract verses from the page
    function extractVerses() {
        const verses = [];

        try {
            console.log('Starting verse extraction...');

            // Select all potential verse containers based on data attributes and classes
            const allElements = document.querySelectorAll(
                '[data-usfm], span.ChapterContent_verse__57FIw, .verse, [data-verse]'
            );
            console.log(`Found ${allElements.length} elements to process`);

            // Use a Map to group elements by their unique verse number
            const verseGroups = new Map();

            allElements.forEach((element, index) => {
                let verseNumber = null;

                // 1. Prioritize data-usfm attribute
                const usfmAttr = element.getAttribute('data-usfm');
                if (usfmAttr) {
                    const parts = usfmAttr.split('.');
                    if (parts.length >= 3) {
                        verseNumber = parts[2];
                    }
                }

                // 2. Fallback to verse label or data-verse if data-usfm is missing or incomplete
                if (!verseNumber) {
                    const labelElement = element.querySelector('.verse-num, .v-num');
                    if (labelElement) {
                        const labelText = labelElement.textContent.trim();
                        verseNumber = formatVerseNumber(labelText);
                    } else {
                        const dataVerseAttr = element.getAttribute('data-verse');
                        if (dataVerseAttr) {
                            verseNumber = dataVerseAttr;
                        }
                    }
                }

                if (!verseNumber) {
                    // Skip if a valid verse number couldn't be determined
                    return;
                }

                // Get text from the element. This is the key.
                const textContent = extractTextFromElement(element);

                if (textContent.text.trim()) {
                    // Initialize verse group if it doesn't exist
                    if (!verseGroups.has(verseNumber)) {
                        verseGroups.set(verseNumber, { textParts: [], hasFootnotes: false });
                    }

                    // Append the new text part to the existing array for this verse
                    const verseData = verseGroups.get(verseNumber);
                    verseData.textParts.push(textContent.text);

                    // Update footnote status
                    if (textContent.hasFootnotes) {
                        verseData.hasFootnotes = true;
                    }
                }
            });

            // Combine the text parts for each verse
            verseGroups.forEach((verseData, verseNumber) => {
                if (verseData.textParts.length > 0) {
                    const combinedText = verseData.textParts.join(' ').replace(/\s+/g, ' ').trim();
                    verses.push({
                        verseNumber: verseNumber,
                        verseText: combinedText,
                        hasFootnotes: verseData.hasFootnotes
                    });
                }
            });

            // Sort verses numerically
            verses.sort((a, b) => {
                const aNum = parseInt(a.verseNumber.match(/^\d+/)?.[0] || '0');
                const bNum = parseInt(b.verseNumber.match(/^\d+/)?.[0] || '0');
                return aNum - bNum;
            });

        } catch (error) {
            console.error('Error in main extraction:', error);
            return [];
        }

        console.log(`Successfully extracted ${verses.length} verses`);
        return verses;
    }


    // Function to check if page has loaded with verse content
    function isPageReady() {
        const verseElements = document.querySelectorAll(
            '[data-usfm], span.ChapterContent_verse__57FIw, .verse, [data-verse]'
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
    console.log('Bible extractor content script loaded');

})();
