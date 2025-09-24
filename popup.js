// popup.js - Enhanced with background execution support

document.addEventListener('DOMContentLoaded', async () => {
    const statusEl = document.getElementById('status');
    const extractButton = document.getElementById('extract');
    const extractFullBookButton = document.getElementById('extractFullBook');
    const prevChapterButton = document.getElementById('prevChapter');
    const nextChapterButton = document.getElementById('nextChapter');
    const chapter1Button = document.getElementById('chapter1');
    const progressContainer = document.getElementById('progressContainer');
    const progressText = document.getElementById('progressText');
    const progressFill = document.getElementById('progressFill');
    const cancelButton = document.getElementById('cancelExtraction');

    let extractionCancelled = false;
    let browserTranslationsMap = {}; // For URL navigation (browser version IDs)
    let translationsMap = {}; // For CSV output (1-8)
    let books = {};
    let bookAbbreviationToIdMap = {};
    let extractionTabId = null; // Track the tab being used for extraction

    // Common stop words to remove from vectorization
    const stopWords = new Set([
        'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'by', 'for', 'from',
        'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
        'to', 'was', 'will', 'with', 'but', 'or', 'not', 'have', 'had', 'do',
        'does', 'did', 'would', 'could', 'should', 'may', 'might', 'can',
        'shall', 'this', 'these', 'those', 'they', 'them', 'their', 'his',
        'her', 'him', 'she', 'i', 'you', 'we', 'us', 'our', 'your', 'my',
        'me', 'am', 'were', 'being', 'been', 'into', 'through', 'during',
        'before', 'after', 'above', 'below', 'up', 'down', 'out', 'off',
        'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there',
        'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few',
        'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'only', 'own',
        'same', 'so', 'than', 'too', 'very', 'if', 'because', 'what', 'which',
        'who', 'whom'
    ]);

    // Keep the window active during extraction
    let keepAliveInterval = null;
    
    const startKeepAlive = () => {
        if (keepAliveInterval) return;
        
        keepAliveInterval = setInterval(() => {
            // Ping the background script to keep it alive
            chrome.runtime.sendMessage({ action: "keepAlive" }, () => {
                if (chrome.runtime.lastError) {
                    // Ignore errors, just trying to keep alive
                }
            });
            
            // Also ensure the extraction tab stays active
            if (extractionTabId) {
                chrome.tabs.get(extractionTabId, (tab) => {
                    if (!chrome.runtime.lastError && tab) {
                        // Tab exists, optionally make it active to prevent throttling
                        chrome.tabs.update(extractionTabId, { active: true });
                    }
                });
            }
        }, 10000); // Every 10 seconds
    };
    
    const stopKeepAlive = () => {
        if (keepAliveInterval) {
            clearInterval(keepAliveInterval);
            keepAliveInterval = null;
        }
    };

    // Function to create PostgreSQL tsvector format
    const createTsVector = (text) => {
        // Convert to lowercase and split into words
        const words = text.toLowerCase()
            .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
            .split(/\s+/)
            .filter(word => word.length > 0);

        // Create word position map
        const wordPositions = new Map();
        
        words.forEach((word, index) => {
            if (!stopWords.has(word) && word.length > 1) {
                if (wordPositions.has(word)) {
                    wordPositions.get(word).push(index + 1);
                } else {
                    wordPositions.set(word, [index + 1]);
                }
            }
        });

        // Convert to tsvector format: 'word':position1,position2
        const tsvectorParts = [];
        const sortedWords = Array.from(wordPositions.keys()).sort();
        
        sortedWords.forEach(word => {
            const positions = wordPositions.get(word);
            tsvectorParts.push(`'${word}':${positions.join(',')}`);
        });

        return tsvectorParts.join(' ');
    };

    // Load data from JSON files
    try {
        statusEl.textContent = 'Loading data...';
        
        const [translationsResponse, browserVersionResponse, booksResponse, allBooksResponse] = await Promise.all([
            fetch(chrome.runtime.getURL("translations.json")),
            fetch(chrome.runtime.getURL("browserversion.json")),
            fetch(chrome.runtime.getURL("books.json")),
            fetch(chrome.runtime.getURL("all_books.json"))
        ]);

        translationsMap = await translationsResponse.json(); // For CSV (1-8)
        browserTranslationsMap = await browserVersionResponse.json(); // For URL navigation
        const bookAbbreviations = await booksResponse.json();
        const allBooks = await allBooksResponse.json();

        // Build correct book mappings
        Object.entries(bookAbbreviations).forEach(([abbr, name]) => {
            const bookEntry = allBooks.find(book => book.name === name);
            if (bookEntry) {
                bookAbbreviationToIdMap[abbr] = bookEntry.bookid;
            }
        });

        allBooks.forEach(book => {
            books[book.bookid] = book.name;
        });

        statusEl.textContent = 'Ready';
    } catch (error) {
        console.error('Error loading JSON files:', error);
        statusEl.textContent = 'Error loading data files';
        return;
    }

    const bookChapterCounts = {
        "GEN": 50, "EXO": 40, "LEV": 27, "NUM": 36, "DEU": 34, "JOS": 24, "JDG": 21, "RUT": 4,
        "1SA": 31, "2SA": 24, "1KI": 22, "2KI": 25, "1CH": 29, "2CH": 36, "EZR": 10, "NEH": 13,
        "EST": 10, "JOB": 42, "PSA": 150, "PRO": 31, "ECC": 12, "SNG": 8, "ISA": 66, "JER": 52,
        "LAM": 5, "EZK": 48, "DAN": 12, "HOS": 14, "JOL": 3, "AMO": 9, "OBA": 1, "JON": 4, "MIC": 7,
        "NAM": 3, "HAB": 3, "ZEP": 3, "HAG": 2, "ZEC": 14, "MAL": 4, "MAT": 28, "MRK": 16,
        "LUK": 24, "JHN": 21, "ACT": 28, "ROM": 16, "1CO": 16, "2CO": 13, "GAL": 6, "EPH": 6,
        "PHP": 4, "COL": 4, "1TH": 5, "2TH": 3, "1TI": 6, "2TI": 4, "TIT": 3, "PHM": 1, "HEB": 13,
        "JAS": 5, "1PE": 5, "2PE": 3, "1JN": 5, "2JN": 1, "3JN": 1, "JUD": 1, "REV": 22
    };

    // Parse current URL to get book info
    const parseCurrentURL = () => {
        return new Promise((resolve) => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const currentUrl = new URL(tabs[0].url);
                const pathParts = currentUrl.pathname.split('/').filter(p => p.length > 0);
                
                if (pathParts.length >= 3) {
                    const translationId = pathParts[1];
                    const bookChapterPart = pathParts[2]; // e.g., "JOS.1.NIV"
                    const parts = bookChapterPart.split('.');
                    
                    const bookAbbr = parts[0];
                    const chapter = parts[1] || '1';
                    const translationAbbr = parts[2] || 'NIV';
                    
                    resolve({
                        translationId,
                        bookAbbr,
                        chapter: parseInt(chapter),
                        translationAbbr,
                        bookId: bookAbbreviationToIdMap[bookAbbr]
                    });
                } else {
                    resolve(null);
                }
            });
        });
    };

    // Utility function to download CSV
    const downloadCSV = (data, filename) => {
        const csvString = convertToCSV(data);
        const blob = new Blob([csvString], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // Convert verses to CSV format with vectorized searchable text
    const convertToCSV = (versesData) => {
        const { bookInfo, verses } = versesData;
        const headers = ['translationid', 'bookid', 'chapternumber', 'versenumber', 'versetext', 'versetextsearchable', 'hasfootnotes', 'wordcount'];
        
        let csv = headers.join(',') + '\n';
        
        verses.forEach(verse => {
            const verseText = verse.verseText.replace(/"/g, '""'); // Escape quotes
            const searchableText = createTsVector(verse.verseText); // Create tsvector format
            const wordCount = verse.verseText.split(/\s+/).length;
            
            const row = [
                translationsMap[bookInfo.translationAbbr] || 1, // Use correct translation IDs (1-8)
                bookInfo.bookId,
                bookInfo.chapter,
                verse.verseNumber,
                `"${verseText}"`,
                `"${searchableText}"`,
                verse.hasFootnotes ? 't' : 'f', // Use actual footnote detection
                wordCount
            ];
            
            csv += row.join(',') + '\n';
        });
        
        return csv;
    };

    // Inject content script if needed
    const ensureContentScript = async (tabId) => {
        return new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(tabId, { action: "checkPageLoaded" }, (response) => {
                if (chrome.runtime.lastError) {
                    chrome.scripting.executeScript({
                        target: { tabId: tabId },
                        files: ['content.js']
                    }, () => {
                        if (chrome.runtime.lastError) {
                            reject(chrome.runtime.lastError);
                        } else {
                            setTimeout(resolve, 1000);
                        }
                    });
                } else {
                    resolve();
                }
            });
        });
    };

    // Wait for page to be ready with more aggressive retries
    const waitForPageReady = (tabId) => {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 30; // Increased attempts
            
            const checkReady = () => {
                // First make sure tab is active
                chrome.tabs.update(tabId, { active: true }, () => {
                    chrome.tabs.sendMessage(tabId, { action: "checkPageLoaded" }, (response) => {
                        if (chrome.runtime.lastError) {
                            attempts++;
                            if (attempts < maxAttempts) {
                                setTimeout(checkReady, 1000); // Longer delays
                            } else {
                                reject(new Error('Timeout waiting for page to load'));
                            }
                        } else if (response && response.loaded) {
                            resolve();
                        } else {
                            attempts++;
                            if (attempts < maxAttempts) {
                                setTimeout(checkReady, 1000);
                            } else {
                                reject(new Error('Page not ready'));
                            }
                        }
                    });
                });
            };
            
            checkReady();
        });
    };

    // Extract verses from current tab
    const extractVersesFromCurrentTab = async () => {
        const tabs = await new Promise(resolve => chrome.tabs.query({ active: true, currentWindow: true }, resolve));
        const currentTab = tabs[0];
        
        if (!currentTab) {
            throw new Error('No active tab found');
        }

        extractionTabId = currentTab.id;
        await ensureContentScript(currentTab.id);
        await waitForPageReady(currentTab.id);

        return new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(currentTab.id, { action: "extractVerses" }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else if (response && response.verses) {
                    resolve(response.verses);
                } else {
                    reject(new Error('No verses found'));
                }
            });
        });
    };

    // Navigate to specific chapter using correct URL format
    const navigateToChapter = (chapter, tabId = null) => {
        return new Promise((resolve, reject) => {
            const targetTabId = tabId || extractionTabId;
            
            chrome.tabs.get(targetTabId, (tab) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(`Tab not found: ${chrome.runtime.lastError.message}`));
                    return;
                }
                
                const currentUrl = new URL(tab.url);
                const pathParts = currentUrl.pathname.split('/').filter(p => p.length > 0);

                if (pathParts.length < 3) {
                    reject(new Error('Not on a valid Bible page'));
                    return;
                }

                const translationId = pathParts[1];
                const bookChapterPart = pathParts[2];
                const parts = bookChapterPart.split('.');
                const bookAbbr = parts[0];
                const translationAbbr = parts[2] || 'NIV';
                
                // Correct URL format: /bible/111/JOS.1.NIV
                const newUrl = `https://www.bible.com/bible/${translationId}/${bookAbbr}.${chapter}.${translationAbbr}`;
                
                chrome.tabs.update(targetTabId, { url: newUrl, active: true }, (updatedTab) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else {
                        resolve(updatedTab);
                    }
                });
            });
        });
    };

    // Check if at chapter boundaries and update button states
    const checkChapterBoundaries = async () => {
        const bookInfo = await parseCurrentURL();
        if (!bookInfo) return;

        const maxChapter = bookChapterCounts[bookInfo.bookAbbr];
        const currentChapter = bookInfo.chapter;

        // Update button states - disable at boundaries but keep arrow text
        prevChapterButton.disabled = (currentChapter <= 1);
        nextChapterButton.disabled = (currentChapter >= maxChapter);
    };

    // Translation navigation buttons
    const translationButtons = {
        'navKJV': 'KJV',
        'navNIV': 'NIV', 
        'navNKJV': 'NKJV',
        'navAMP': 'AMP',
        'navAMPC': 'AMPC',
        'navTPT': 'TPT',
        'navESV': 'ESV',
        'navNLT': 'NLT'
    };

    Object.keys(translationButtons).forEach(buttonId => {
        const button = document.getElementById(buttonId);
        if (button) {
            button.addEventListener('click', () => {
                const translationAbbr = translationButtons[buttonId];
                const translationId = browserTranslationsMap[translationAbbr]; // Use browser version IDs for navigation
                
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    const currentTab = tabs[0];
                    const currentUrl = new URL(currentTab.url);
                    const pathParts = currentUrl.pathname.split('/').filter(p => p.length > 0);
                    
                    if (pathParts.length >= 3) {
                        const bookChapterPart = pathParts[2];
                        const parts = bookChapterPart.split('.');
                        const bookAbbr = parts[0];
                        const chapter = parts[1] || '1';
                        
                        // Correct URL format
                        const newUrl = `https://www.bible.com/bible/${translationId}/${bookAbbr}.${chapter}.${translationAbbr}`;
                        chrome.tabs.update(currentTab.id, { url: newUrl, active: true });
                    }
                });
            });
        }
    });

    // Extract single chapter as CSV
    extractButton.addEventListener('click', async () => {
        statusEl.textContent = 'Extracting verses...';
        startKeepAlive();
        
        try {
            const bookInfo = await parseCurrentURL();
            if (!bookInfo) {
                throw new Error('Could not parse current URL');
            }
            
            const verses = await extractVersesFromCurrentTab();
            const bookName = books[bookInfo.bookId] || 'Unknown';
            const filename = `verses_${bookName.replace(/\s+/g, '')}${bookInfo.chapter}_${bookInfo.translationAbbr}.csv`;
            
            downloadCSV({ bookInfo, verses }, filename);
            statusEl.textContent = 'Download complete!';
        } catch (error) {
            statusEl.textContent = `Error: ${error.message}`;
            console.error('Extraction failed:', error);
        } finally {
            stopKeepAlive();
        }
    });

    // Extract full book as CSV with enhanced background support
    extractFullBookButton.addEventListener('click', async () => {
        const bookInfo = await parseCurrentURL();
        if (!bookInfo) {
            statusEl.textContent = 'Error: Please navigate to a valid Bible page first.';
            return;
        }

        const totalChapters = bookChapterCounts[bookInfo.bookAbbr];
        if (!totalChapters) {
            statusEl.textContent = 'Error: Could not determine chapter count for this book.';
            return;
        }

        extractionCancelled = false;
        startKeepAlive(); // Start keep-alive mechanism
        progressContainer.style.display = 'block';
        cancelButton.style.display = 'block';
        const bookName = books[bookInfo.bookId] || 'Unknown';
        statusEl.textContent = `Starting full book extraction for ${bookName}...`;

        // Get the current tab ID for extraction
        const tabs = await new Promise(resolve => chrome.tabs.query({ active: true, currentWindow: true }, resolve));
        extractionTabId = tabs[0].id;

        const allVerses = [];
        let successfulChapters = 0;

        for (let i = 1; i <= totalChapters; i++) {
            if (extractionCancelled) {
                statusEl.textContent = 'Extraction cancelled by user.';
                break;
            }

            progressText.textContent = `Extracting ${bookInfo.bookAbbr} chapter ${i}/${totalChapters}...`;
            
            try {
                // Navigate and ensure tab is active
                await navigateToChapter(i, extractionTabId);
                
                // Wait longer for page load and ensure tab stays active
                await new Promise(resolve => setTimeout(resolve, 4000));
                
                // Make sure content script is injected
                await ensureContentScript(extractionTabId);
                await waitForPageReady(extractionTabId);
                
                // Extract verses
                const verses = await new Promise((resolve, reject) => {
                    chrome.tabs.sendMessage(extractionTabId, { action: "extractVerses" }, (response) => {
                        if (chrome.runtime.lastError) {
                            reject(new Error(chrome.runtime.lastError.message));
                        } else if (response && response.verses) {
                            resolve(response.verses);
                        } else {
                            reject(new Error('No verses found'));
                        }
                    });
                });
                
                // Add each verse with chapter info
                verses.forEach(verse => {
                    allVerses.push({
                        ...verse,
                        chapter: i
                    });
                });

                successfulChapters++;
                console.log(`Successfully extracted ${bookInfo.bookAbbr} chapter ${i}: ${verses.length} verses`);

            } catch (error) {
                console.error(`Error extracting ${bookInfo.bookAbbr} chapter ${i}:`, error);
                progressText.textContent = `Error on chapter ${i}, retrying...`;
                
                // Retry once
                try {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    await navigateToChapter(i, extractionTabId);
                    await new Promise(resolve => setTimeout(resolve, 4000));
                    await ensureContentScript(extractionTabId);
                    await waitForPageReady(extractionTabId);
                    
                    const verses = await new Promise((resolve, reject) => {
                        chrome.tabs.sendMessage(extractionTabId, { action: "extractVerses" }, (response) => {
                            if (chrome.runtime.lastError) {
                                reject(new Error(chrome.runtime.lastError.message));
                            } else if (response && response.verses) {
                                resolve(response.verses);
                            } else {
                                reject(new Error('No verses found'));
                            }
                        });
                    });
                    
                    verses.forEach(verse => {
                        allVerses.push({
                            ...verse,
                            chapter: i
                        });
                    });
                    
                    successfulChapters++;
                    console.log(`Successfully extracted ${bookInfo.bookAbbr} chapter ${i} on retry: ${verses.length} verses`);
                } catch (retryError) {
                    console.error(`Retry failed for ${bookInfo.bookAbbr} chapter ${i}:`, retryError);
                }
            }

            const progress = (i / totalChapters) * 100;
            progressFill.style.width = `${progress}%`;
        }

        if (!extractionCancelled && allVerses.length > 0) {
            // Convert to CSV format for full book
            const headers = ['translationid', 'bookid', 'chapternumber', 'versenumber', 'versetext', 'versetextsearchable', 'hasfootnotes', 'wordcount'];
            let csv = headers.join(',') + '\n';
            
            allVerses.forEach(verse => {
                const verseText = verse.verseText.replace(/"/g, '""');
                const searchableText = createTsVector(verse.verseText); // Create tsvector format
                const wordCount = verse.verseText.split(/\s+/).length;
                
                const row = [
                    translationsMap[bookInfo.translationAbbr] || 1, // Use correct translation IDs (1-8)
                    bookInfo.bookId,
                    verse.chapter,
                    verse.verseNumber,
                    `"${verseText}"`,
                    `"${searchableText}"`,
                    verse.hasFootnotes ? 't' : 'f',
                    wordCount
                ];
                
                csv += row.join(',') + '\n';
            });
            
            const blob = new Blob([csv], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `verses_${bookName.replace(/\s+/g, '')}_${bookInfo.translationAbbr}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            statusEl.textContent = `Full book extraction complete! (${successfulChapters}/${totalChapters} chapters, ${allVerses.length} verses)`;
        }
        
        stopKeepAlive(); // Stop keep-alive mechanism
        progressContainer.style.display = 'none';
        cancelButton.style.display = 'none';
        extractionTabId = null;
    });

    // Navigation buttons
    prevChapterButton.addEventListener('click', async () => {
        const bookInfo = await parseCurrentURL();
        if (!bookInfo || bookInfo.chapter <= 1) return;
        
        await navigateToChapter(bookInfo.chapter - 1);
        setTimeout(checkChapterBoundaries, 1000); // Check boundaries after navigation
    });

    nextChapterButton.addEventListener('click', async () => {
        const bookInfo = await parseCurrentURL();
        if (!bookInfo) return;
        
        const maxChapter = bookChapterCounts[bookInfo.bookAbbr];
        if (bookInfo.chapter >= maxChapter) return;
        
        await navigateToChapter(bookInfo.chapter + 1);
        setTimeout(checkChapterBoundaries, 1000); // Check boundaries after navigation
    });

    chapter1Button.addEventListener('click', async () => {
        await navigateToChapter(1);
        setTimeout(checkChapterBoundaries, 1000); // Check boundaries after navigation
    });

    cancelButton.addEventListener('click', () => {
        extractionCancelled = true;
        stopKeepAlive();
        statusEl.textContent = 'Cancelling...';
        progressText.textContent = 'Cancelling...';
        setTimeout(() => {
            progressContainer.style.display = 'none';
            cancelButton.style.display = 'none';
            extractionTabId = null;
        }, 1000);
    });

    // Check boundaries on popup open
    setTimeout(checkChapterBoundaries, 500);
});