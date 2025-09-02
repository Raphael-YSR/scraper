document.addEventListener('DOMContentLoaded', () => {
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

  // Translation navigation buttons
  const navKJV = document.getElementById('navKJV');
  const navNIV = document.getElementById('navNIV');
  const navNKJV = document.getElementById('navNKJV');
  const navAMP = document.getElementById('navAMP');
  const navAMPC = document.getElementById('navAMPC');
  const navTPT = document.getElementById('navTPT');
  const navESV = document.getElementById('navESV');
  const navNLT = document.getElementById('navNLT');

  // Global variable to track extraction cancellation
  let extractionCancelled = false;

  // Hardcoded data for books and chapter counts (consistent with frontend)
  const bookAbbreviationToIdMap = {
    "GEN": 1, "EXO": 2, "LEV": 3, "NUM": 4, "DEU": 5, "JOS": 6, "JDG": 7, "RUT": 8,
    "1SA": 9, "2SA": 10, "1KI": 11, "2KI": 12, "1CH": 13, "2CH": 14, "EZR": 15, "NEH": 16,
    "EST": 17, "JOB": 18, "PSA": 19, "PRO": 20, "ECC": 21, "SNG": 22, "ISA": 23, "JER": 24,
    "LAM": 25, "EZK": 26, "DAN": 27, "HOS": 28, "JOL": 29, "AMO": 30, "OBA": 31, "JON": 32,
    "MIC": 33, "NAM": 34, "HAB": 35, "ZEP": 36, "HAG": 37, "ZEC": 38, "MAL": 39,
    "MAT": 40, "MRK": 41, "LUK": 42, "JHN": 43, "ACT": 44, "ROM": 45, "1CO": 46, "2CO": 47,
    "GAL": 48, "EPH": 49, "PHP": 50, "COL": 51, "1TH": 52, "2TH": 53, "1TI": 54, "2TI": 55,
    "TIT": 56, "PHM": 57, "HEB": 58, "JAS": 59, "1PE": 60, "2PE": 61, "1JN": 62, "2JN": 63,
    "3JN": 64, "JUD": 65, "REV": 66
  };

  // Hardcoded chapter counts for each book
  const bookChapterCounts = {
    "GEN": 50, "EXO": 40, "LEV": 27, "NUM": 36, "DEU": 34, "JOS": 24, "JDG": 21, "RUT": 4,
    "1SA": 31, "2SA": 24, "1KI": 22, "2KI": 25, "1CH": 29, "2CH": 36, "EZR": 10, "NEH": 13,
    "EST": 10, "JOB": 42, "PSA": 150, "PRO": 31, "ECC": 12, "SNG": 8, "ISA": 66, "JER": 52,
    "LAM": 5, "EZK": 48, "DAN": 12, "HOS": 14, "JOL": 3, "AMO": 9, "OBA": 1, "JON": 4,
    "MIC": 7, "NAM": 3, "HAB": 3, "ZEP": 3, "HAG": 2, "ZEC": 14, "MAL": 4,
    "MAT": 28, "MRK": 16, "LUK": 24, "JHN": 21, "ACT": 28, "ROM": 16, "1CO": 16, "2CO": 13,
    "GAL": 6, "EPH": 6, "PHP": 4, "COL": 4, "1TH": 5, "2TH": 3, "1TI": 6, "2TI": 4,
    "TIT": 3, "PHM": 1, "HEB": 13, "JAS": 5, "1PE": 5, "2PE": 3, "1JN": 5, "2JN": 1,
    "3JN": 1, "JUD": 1, "REV": 22
  };

  // Common English stop words (for simplified tsvector generation)
  const stopWords = new Set([
    "a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "if", "in", "into", "is", "it",
    "no", "not", "of", "on", "or", "such", "that", "the", "their", "then", "there", "these",
    "they", "this", "to", "was", "will", "with", "from", "up", "down", "out", "about", "he", "she",
    "him", "her", "his", "hers", "we", "us", "our", "ours", "you", "your", "yours", "they", "them",
    "their", "theirs", "what", "which", "who", "whom", "whose", "where", "when", "why", "how",
    "all", "any", "both", "each", "few", "more", "most", "other", "some", "such", "no", "nor", "too",
    "very", "can", "will", "just", "don't", "should", "now", "here", "there", "has", "have", "had",
    "do", "does", "did", "am", "are", "is", "was", "were", "been", "being", "may", "might", "must",
    "ought", "shall", "should", "would", "could"
  ]);

  /**
   * Waits for a specified amount of time
   * @param {number} ms Milliseconds to wait
   */
  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Waits for the page to load and verses to be available
   * @param {number} tabId The tab ID to check
   * @param {number} maxAttempts Maximum number of attempts
   */
  async function waitForPageLoad(tabId, maxAttempts = 10) {
    for (let i = 0; i < maxAttempts; i++) {
      if (extractionCancelled) throw new Error('Extraction cancelled');
      
      try {
        const response = await chrome.tabs.sendMessage(tabId, { action: "checkPageLoaded" });
        if (response && response.loaded) {
          return true;
        }
      } catch (error) {
        // Page might not be ready for content script injection yet
      }
      await delay(1000); // Wait 1 second between checks
    }
    throw new Error('Page load timeout');
  }

  /**
   * Extracts verses from a single chapter
   * @param {number} tabId The tab ID
   */
  async function extractSingleChapter(tabId) {
    const response = await chrome.tabs.sendMessage(tabId, { action: "extractVerses" });
    return response.verses || [];
  }

  /**
   * Updates the progress display
   * @param {number} current Current chapter number
   * @param {number} total Total chapters
   * @param {string} bookName Book name
   */
  function updateProgress(current, total, bookName) {
    const percentage = (current / total) * 100;
    progressText.textContent = `Extracting ${bookName} ${current}/${total}...`;
    progressFill.style.width = `${percentage}%`;
  }

  /**
   * Shows/hides the progress container and buttons
   * @param {boolean} show Whether to show progress
   */
  function toggleProgressDisplay(show) {
    if (show) {
      progressContainer.style.display = 'block';
      extractButton.style.display = 'none';
      extractFullBookButton.style.display = 'none';
      prevChapterButton.style.display = 'none';
      nextChapterButton.style.display = 'none';
      chapter1Button.style.display = 'none';
    } else {
      progressContainer.style.display = 'none';
      extractButton.style.display = 'block';
      extractFullBookButton.style.display = 'block';
      prevChapterButton.style.display = 'block';
      nextChapterButton.style.display = 'block';
      chapter1Button.style.display = 'block';
    }
  }

  /**
   * Generates a simplified PostgreSQL tsvector-like string from raw text.
   */
  function generateTsVectorString(text) {
    const cleanedText = text.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    const words = cleanedText.split(/\s+/).filter(word => word.length > 0);

    const tsvectorParts = [];
    let originalWordIndex = 0;

    const noStemWords = new Set([
      'hundred', 'thousand', 'blessed', 'wicked', 'sacred', 'naked', 'beloved', 
      'learned', 'kindred', 'aged', 'red', 'dead', 'bread', 'head', 'read',
      'seed', 'feed', 'need', 'deed', 'creed', 'breed', 'freed', 'greed',
      'entered', 'centered', 'altered', 'scattered', 'gathered', 'covered',
      'delivered', 'remembered', 'numbered', 'ordered', 'answered', 'offered',
      'suffered', 'wondered', 'considered', 'murdered', 'conquered', 'rendered'
    ]);

    words.forEach(word => {
      originalWordIndex++;

      let stemmedWord = word;
      
      if (stemmedWord.length > 3 && !noStemWords.has(stemmedWord)) {
        if (stemmedWord.endsWith('ing')) {
          let root = stemmedWord.slice(0, -3);
          if (root.length >= 2) {
            stemmedWord = root;
          }
        }
        else if (stemmedWord.endsWith('ies')) {
          stemmedWord = stemmedWord.slice(0, -3) + 'y';
        }
        else if (stemmedWord.endsWith('ied')) {
          let root = stemmedWord.slice(0, -3);
          if (root.endsWith('r') || root.endsWith('l')) {
            stemmedWord = root + 'y';
          } else {
            stemmedWord = root + 'e';
          }
        }
        else if (stemmedWord.endsWith('ed')) {
          let root = stemmedWord.slice(0, -2);
          if (root.length >= 2) {
            if (root.length >= 3 && root[root.length-1] === root[root.length-2] && 
                root.match(/[bcdfghjklmnpqrstvwxz]$/)) {
              stemmedWord = root.slice(0, -1);
            }
            else if (root.endsWith('r')) {
              stemmedWord = root;
            }
            else if (root.match(/[bcdfghjklmnpqrstvwxz]e$/)) {
              stemmedWord = root;
            }
            else if (root.endsWith('y')) {
              stemmedWord = root;
            }
            else if (root.match(/[aeiou]$/)) {
              stemmedWord = root;
            }
            else {
              stemmedWord = root;
            }
          }
        }
        else if (stemmedWord.endsWith('es')) {
          let root = stemmedWord.slice(0, -2);
          if (root.endsWith('ch') || root.endsWith('sh') || root.endsWith('x') || root.endsWith('s')) {
            stemmedWord = root;
          } else {
            stemmedWord = root + 'e';
          }
        }
        else if (stemmedWord.endsWith('s') && stemmedWord.length > 4) {
          let root = stemmedWord.slice(0, -1);
          if (!root.match(/[aeiou]s$/) && !['wa', 'hi', 'ye', 'thi'].includes(root)) {
            stemmedWord = root;
          }
        }
      }

      if (!stopWords.has(stemmedWord)) {
        tsvectorParts.push(`'${stemmedWord}':${originalWordIndex}`);
      }
    });

    return tsvectorParts.join(' ');
  }

  /**
   * Main function to extract all verses from the current book
   */
  async function extractFullBook() {
    extractionCancelled = false;
    toggleProgressDisplay(true);
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.url || !tab.url.includes("bible.com")) {
        showStatus("Not a bible.com URL", true);
        return;
      }

      const match = tab.url.match(/bible\/(\d+)\/([A-Z0-9]+)\.(\d+)\.([A-Z]+)/);
      if (!match) {
        showStatus("Invalid Bible URL format", true);
        return;
      }

      const [_, translationCode, bookCode, currentChapter, version] = match;
      const totalChapters = bookChapterCounts[bookCode];

      if (!totalChapters) {
        showStatus(`Unknown book: ${bookCode}`, true);
        return;
      }

      // Load required data
      const [booksRes, allBooksRes, translationsRes] = await Promise.all([
        fetch(chrome.runtime.getURL("books.json")),
        fetch(chrome.runtime.getURL("all_books.json")),
        fetch(chrome.runtime.getURL("translations.json"))
      ]);

      const booksFullNames = await booksRes.json();
      const allBooks = await allBooksRes.json();
      const internalTranslationsMap = await translationsRes.json();

      const bookName = booksFullNames[bookCode];
      const translationIdForCsv = internalTranslationsMap[version];
      const bookData = allBooks.find(book => book.name === bookName);

      if (!bookName || typeof translationIdForCsv === 'undefined' || !bookData) {
        showStatus("Missing book or translation data", true);
        return;
      }

      // Start extraction from chapter 1
      await navigateToChapter(1);
      await delay(2000);

      const allVerses = [];
      const failedChapters = [];

      // Extract each chapter
      for (let chapter = 1; chapter <= totalChapters; chapter++) {
        if (extractionCancelled) {
          showStatus("Extraction cancelled", true);
          return;
        }

        updateProgress(chapter, totalChapters, bookName);

        try {
          // Wait for page to load
          await waitForPageLoad(tab.id);

          // Extract verses from current chapter
          const verses = await extractSingleChapter(tab.id);

          if (verses && verses.length > 0) {
            // Add chapter context and process verses
            verses.forEach(verse => {
              const normalizedText = verse.verseText.trim().replace(/\s+/g, ' ');
              const cleanedVerseText = normalizedText
                .replace(/"/g, '"')
                .replace(/"/g, '"')
                .replace(/'/g, "'")
                .replace(/'/g, "'");
              const escapedText = cleanedVerseText.replace(/"/g, '""');
              const wordCount = normalizedText.split(/\s+/).filter(word => word.length > 0).length;
              const searchableText = generateTsVectorString(normalizedText);

              allVerses.push({
                translationId: translationIdForCsv,
                bookId: bookData.bookid,
                chapterNumber: chapter,
                verseNumber: verse.verseNumber,
                verseText: escapedText,
                searchableText: searchableText,
                wordCount: wordCount
              });
            });
          } else {
            failedChapters.push(chapter);
          }

          // Navigate to next chapter (except for the last one)
          if (chapter < totalChapters) {
            await navigateToChapter(chapter + 1);
            await delay(2500);
          }

        } catch (error) {
          console.error(`Error extracting chapter ${chapter}:`, error);
          failedChapters.push(chapter);
          
          // Try to continue with next chapter
          if (chapter < totalChapters) {
            try {
              await navigateToChapter(chapter + 1);
              await delay(2500);
            } catch (navError) {
              console.error(`Failed to navigate to chapter ${chapter + 1}`);
            }
          }
        }
      }

      if (allVerses.length > 0) {
        // Generate CSV
        let csvContent = `translationid,bookid,chapternumber,versenumber,versetext,versetextsearchable,hasfootnotes,wordcount\n`;
        
        allVerses.forEach(verse => {
          csvContent += `${verse.translationId},${verse.bookId},${verse.chapterNumber},${verse.verseNumber},"${verse.verseText}","${verse.searchableText}",f,${verse.wordCount}\n`;
        });

        // Download CSV
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);

        chrome.downloads.download({
          url,
          filename: `verses_${bookName.replace(/\s+/g, '_')}_${version}_complete.csv`,
        });

        const successMsg = `✅ Extracted ${allVerses.length} verses from ${bookName}`;
        const failMsg = failedChapters.length > 0 ? ` (Failed: chapters ${failedChapters.join(', ')})` : '';
        showStatus(successMsg + failMsg);
      } else {
        showStatus("❌ No verses extracted", true);
      }

    } catch (error) {
      showStatus(`❌ Extraction failed: ${error.message}`, true);
      console.error('Full book extraction error:', error);
    } finally {
      toggleProgressDisplay(false);
    }
  }

  /**
   * Displays a status message in the popup.
   */
  function showStatus(message, isError = false) {
    statusEl.textContent = message;
    statusEl.style.color = isError ? '#ff6b6b' : '#00ff7f';
    statusEl.classList.add('show');
    setTimeout(() => statusEl.classList.remove('show'), 3000);
  }

  /**
   * Navigates the active tab to a new chapter URL on bible.com.
   */
  async function navigateToChapter(newChapter) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.url || !tab.url.includes("bible.com")) {
        showStatus("Not a bible.com URL", true);
        return;
      }

      const match = tab.url.match(/bible\/(\d+)\/([A-Z0-9]+)\.(\d+)\.([A-Z]+)/);
      if (!match) {
        showStatus("Invalid Bible URL format", true);
        return;
      }

      const [_, translationId, bookAbbreviation, currentChapter, versionAbbreviation] = match;
      const totalChapters = bookChapterCounts[bookAbbreviation];

      if (typeof totalChapters === 'undefined') {
        showStatus(`Chapter count for '${bookAbbreviation}' not found.`, true);
        return;
      }

      if (newChapter < 1) {
        showStatus("Already at the first chapter.", false);
        return;
      }
      if (newChapter > totalChapters) {
        showStatus("Already at the last chapter.", false);
        return;
      }

      const newUrl = `https://www.bible.com/bible/${translationId}/${bookAbbreviation}.${newChapter}.${versionAbbreviation}`;
      await chrome.tabs.update(tab.id, { url: newUrl });
      showStatus(`Navigating to chapter ${newChapter}...`);
    } catch (error) {
      showStatus("Navigation failed.", true);
      console.error('Navigation error:', error);
    }
  }

  /**
   * Navigates the active tab to a new translation URL on bible.com.
   */
  async function navigateToTranslation(newTranslationId, newTranslationAbbr) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.url || !tab.url.includes("bible.com")) {
        showStatus("Not a bible.com URL", true);
        return;
      }

      const match = tab.url.match(/bible\/(\d+)\/([A-Z0-9]+)\.(\d+)\.([A-Z]+)/);
      if (!match) {
        showStatus("Invalid Bible URL format", true);
        return;
      }

      const [_, currentTranslationId, bookAbbreviation, currentChapter, currentVersionAbbreviation] = match;

      const newUrl = `https://www.bible.com/bible/${newTranslationId}/${bookAbbreviation}.${currentChapter}.${newTranslationAbbr}`;
      await chrome.tabs.update(tab.id, { url: newUrl });
      showStatus(`Switching to ${newTranslationAbbr}...`);
    } catch (error) {
      showStatus("Translation switch failed.", true);
      console.error('Translation navigation error:', error);
    }
  }

  // --- Event Listeners ---

  // Event listener for the "Extract Full Book" button
  extractFullBookButton.addEventListener('click', extractFullBook);

  // Event listener for the cancel button
  cancelButton.addEventListener('click', () => {
    extractionCancelled = true;
    toggleProgressDisplay(false);
    showStatus("Extraction cancelled", false);
  });

  // Event listener for the main "Extract Verses" button
  extractButton.addEventListener('click', async () => {
    extractButton.disabled = true;
    extractButton.textContent = 'PROCESSING...';
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.url || !tab.url.includes("bible.com")) {
        showStatus("❌ Not a bible.com URL", true);
        return;
      }

      const match = tab.url.match(/bible\/(\d+)\/([A-Z0-9]+)\.(\d+)\.([A-Z]+)/);
      if (!match) {
        showStatus("❌ Invalid Bible URL format", true);
        return;
      }

      const [_, translationCode, bookCode, chapter, version] = match;

      const booksJsonRes = await fetch(chrome.runtime.getURL("books.json"));
      const booksFullNames = await booksJsonRes.json();

      const allBooksRes = await fetch(chrome.runtime.getURL("all_books.json"));
      const allBooks = await allBooksRes.json();

      const translationsRes = await fetch(chrome.runtime.getURL("translations.json"));
      const internalTranslationsMap = await translationsRes.json();

      const bookName = booksFullNames[bookCode];
      const translationIdForCsv = internalTranslationsMap[version];

      if (!bookName) {
        showStatus(`❌ Unknown book abbreviation: ${bookCode}`, true);
        return;
      }
      if (typeof translationIdForCsv === 'undefined') {
        showStatus(`❌ Unknown translation abbreviation for CSV: ${version}`, true);
        return;
      }

      const bookData = allBooks.find(book => book.name === bookName);

      if (!bookData) {
        showStatus(`❌ Book data not found for: ${bookName}`, true);
        return;
      }

      const response = await chrome.tabs.sendMessage(tab.id, { action: "extractVerses" });
      const extractedVerses = response.verses;

      let csvContent = `translationid,bookid,chapternumber,versenumber,versetext,versetextsearchable,hasfootnotes,wordcount\n`;

      if (extractedVerses && extractedVerses.length > 0) {
        extractedVerses.forEach(verse => {
          const normalizedText = verse.verseText.trim().replace(/\s+/g, ' ');

          let cleanedVerseText = normalizedText
            .replace(/"/g, '"')
            .replace(/"/g, '"')
            .replace(/'/g, "'")
            .replace(/'/g, "'");

          const escapedText = cleanedVerseText.replace(/"/g, '""');
          const wordCount = normalizedText.split(/\s+/).filter(word => word.length > 0).length;
          const searchableText = generateTsVectorString(normalizedText);

          csvContent += `${translationIdForCsv},${bookData.bookid},${chapter},${verse.verseNumber},"${escapedText}","${searchableText}",f,${wordCount}\n`;
        });

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);

        chrome.downloads.download({
          url,
          filename: `verses_${bookName.replace(/\s+/g, '_')}${chapter}_${version}.csv`,
        });

        showStatus(`✅ ${extractedVerses.length} verses extracted`);
      } else {
        showStatus("❌ No verses found", true);
      }
    } catch (error) {
      showStatus("❌ Extraction failed", true);
      console.error('Error:', error);
    } finally {
      extractButton.disabled = false;
      extractButton.textContent = 'EXTRACT';
    }
  });

  // Event listener for "Previous Chapter" button
  prevChapterButton.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.url || !tab.url.includes("bible.com")) {
      showStatus("Not a bible.com URL", true);
      return;
    }
    const match = tab.url.match(/bible\/(\d+)\/([A-Z0-9]+)\.(\d+)\.([A-Z]+)/);
    if (!match) {
      showStatus("Invalid Bible URL format", true);
      return;
    }
    const [_, , , currentChapter] = match;
    navigateToChapter(parseInt(currentChapter) - 1);
  });

  // Event listener for "Next Chapter" button
  nextChapterButton.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab.url || !tab.url.includes("bible.com")) {
      showStatus("Not a bible.com URL", true);
      return;
    }
    const match = tab.url.match(/bible\/(\d+)\/([A-Z]+)\.(\d+)\.([A-Z]+)/);
    if (!match) {
      showStatus("Invalid Bible URL format", true);
      return;
    }
    const [_, , , currentChapter] = match;
    navigateToChapter(parseInt(currentChapter) + 1);
  });

  // Event listener for "Chapter 1" button
  chapter1Button.addEventListener('click', () => {
    navigateToChapter(1);
  });

  // Event listeners for translation buttons
  let browserTranslationsMap;
  fetch(chrome.runtime.getURL("browserversion.json"))
    .then(response => response.json())
    .then(data => {
      browserTranslationsMap = data;

      navKJV.addEventListener('click', () => navigateToTranslation(browserTranslationsMap["KJV"], "KJV"));
      navNIV.addEventListener('click', () => navigateToTranslation(browserTranslationsMap["NIV"], "NIV"));
      navNKJV.addEventListener('click', () => navigateToTranslation(browserTranslationsMap["NKJV"], "NKJV"));
      navAMP.addEventListener('click', () => navigateToTranslation(browserTranslationsMap["AMP"], "AMP"));
      navAMPC.addEventListener('click', () => navigateToTranslation(browserTranslationsMap["AMPC"], "AMPC"));
      navTPT.addEventListener('click', () => navigateToTranslation(browserTranslationsMap["TPT"], "TPT"));
      navESV.addEventListener('click', () => navigateToTranslation(browserTranslationsMap["ESV"], "ESV"));
      navNLT.addEventListener('click', () => navigateToTranslation(browserTranslationsMap["NLT"], "NLT"));
    })
    .catch(error => {
      console.error('Error loading browserversion.json:', error);
      showStatus("Error loading translation navigation data.", true);
    });
});