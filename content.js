// content.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "extractVerses") {
        const verses = [];
        // Select all elements that represent an entire verse block
        const verseContainers = document.querySelectorAll('span.ChapterContent_verse__57FIw');

        verseContainers.forEach(verseContainer => {
            const verseNumberElement = verseContainer.querySelector('span.ChapterContent_label__R2PLt');
            const verseContentParts = verseContainer.querySelectorAll('span.ChapterContent_content__RrUqA');

            let verseNumber = '';
            if (verseNumberElement) {
                // Extract and clean the verse number (e.g., "1")
                verseNumber = verseNumberElement.textContent.trim().replace(/\s+/, '').replace(/\D/g, '');
            }

            let verseText = '';
            // Concatenate all parts of the verse text
            verseContentParts.forEach(part => {
                verseText += part.textContent;
            });
            verseText = verseText.trim(); // Trim whitespace from the combined text

            if (verseNumber && verseText) {
                verses.push({
                    verseNumber: verseNumber,
                    verseText: verseText
                });
            }
        });

        sendResponse({ verses: verses });
        return true; // IMPORTANT: Indicate that you will send a response asynchronously
    }
});