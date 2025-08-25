document.addEventListener('DOMContentLoaded', () => {
  const statusEl = document.getElementById('status');
  const extractButton = document.getElementById('extract');
  const prevChapterButton = document.getElementById('prevChapter');
  const nextChapterButton = document.getElementById('nextChapter');
  const chapter1Button = document.getElementById('chapter1');

  // Translation navigation buttons
  const navKJV = document.getElementById('navKJV');
  const navNIV = document.getElementById('navNIV');
  const navNKJV = document.getElementById('navNKJV');
  const navAMP = document.getElementById('navAMP');
  const navAMPC = document.getElementById('navAMPC');
  const navTPT = document.getElementById('navTPT');
  const navESV = document.getElementById('navESV');
  const navNLT = document.getElementById('navNLT'); // Added NLT button reference


  // Hardcoded data for books and chapter counts (consistent with frontend)
  // This map will be used to navigate chapters and identify book IDs.
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
    // This list can be expanded for more comprehensive stop word removal.
  ]);

  /**
   * Generates a simplified PostgreSQL tsvector-like string from raw text.
   * This function attempts to mimic tokenization, lowercasing, punctuation removal,
   * stop word removal, and positional information as seen in PostgreSQL's tsvector.
   * A highly simplified stemming is applied for common endings.
   *
   * @param {string} text The raw verse text.
   * @returns {string} The formatted tsvector-like string.
   */
  function generateTsVectorString(text) {
    // 1. Lowercase and remove punctuation (keep apostrophes for contractions if necessary, but generally removed for tsvector)
    // Remove all characters that are not letters, numbers, or spaces.
    const cleanedText = text.toLowerCase().replace(/[^a-z0-9\s]/g, '');

    // 2. Split into words and track original positions
    // filter(word => word.length > 0) removes empty strings from multiple spaces
    const words = cleanedText.split(/\s+/).filter(word => word.length > 0);

    const tsvectorParts = [];
    let originalWordIndex = 0; // 1-based index for original word position

    // Words that should not be stemmed (common exceptions)
    const noStemWords = new Set([
      'hundred', 'thousand', 'blessed', 'wicked', 'sacred', 'naked', 'beloved', 
      'learned', 'kindred', 'aged', 'red', 'dead', 'bread', 'head', 'read',
      'seed', 'feed', 'need', 'deed', 'creed', 'breed', 'freed', 'greed', 'replied'
    ]);

    words.forEach(word => {
      originalWordIndex++; // Increment for each word in the original text

      let stemmedWord = word;
      
      // Only apply stemming if word is not in the no-stem list and is long enough
      if (stemmedWord.length > 3 && !noStemWords.has(stemmedWord)) {
        // Improved stemming rules with better logic
        if (stemmedWord.endsWith('ing')) {
          // Handle -ing endings: running -> run, walking -> walk, being -> be
          let root = stemmedWord.slice(0, -3);
          if (root.length >= 2) {
            stemmedWord = root;
          }
        }
        else if (stemmedWord.endsWith('ies')) {
          // Handle -ies endings: stories -> story, flies -> fly
          stemmedWord = stemmedWord.slice(0, -3) + 'y';
        }
        else if (stemmedWord.endsWith('ied')) {
          // Handle -ied endings: tried -> try, died -> die  
          let root = stemmedWord.slice(0, -3);
          if (root.endsWith('r') || root.endsWith('l')) {
            stemmedWord = root + 'y'; // tried -> try, replied -> reply
          } else {
            stemmedWord = root + 'e'; // died -> die
          }
        }
        else if (stemmedWord.endsWith('ed')) {
          // Handle -ed endings more carefully
          let root = stemmedWord.slice(0, -2);
          if (root.length >= 2) {
            // For words ending in consonant + 'ed', try adding 'e'
            if (!root.match(/[aeiou]$/)) {
              // lived -> live, moved -> move, etc.
              if (root.match(/[^aeiou][aeiou][^aeiou]$/)) {
                // Don't double the consonant for these
                stemmedWord = root + 'e';
              } else {
                stemmedWord = root;
              }
            } else {
              stemmedWord = root;
            }
          }
        }
        else if (stemmedWord.endsWith('es')) {
          // Handle -es endings: churches -> church, boxes -> box
          let root = stemmedWord.slice(0, -2);
          if (root.endsWith('ch') || root.endsWith('sh') || root.endsWith('x') || root.endsWith('s')) {
            stemmedWord = root;
          } else {
            // For words like "comes" -> "come"
            stemmedWord = root + 'e';
          }
        }
        else if (stemmedWord.endsWith('s') && stemmedWord.length > 4) {
          // Handle simple plural -s endings: books -> book, cats -> cat
          // But avoid stemming words like "was", "his", "yes", etc.
          let root = stemmedWord.slice(0, -1);
          if (!root.match(/[aeiou]s$/) && !['wa', 'hi', 'ye', 'thi'].includes(root)) {
            stemmedWord = root;
          }
        }
      }

      // Check if the stemmed word is a stop word
      if (!stopWords.has(stemmedWord)) {
        // Add to tsvector parts, ensuring word is quoted and position is included
        tsvectorParts.push(`'${stemmedWord}':${originalWordIndex}`);
      }
    });

    return tsvectorParts.join(' ');
  }


  /**
   * Displays a status message in the popup.
   * @param {string} message The message to display.
   * @param {boolean} isError True if the message is an error, false otherwise.
   */
  function showStatus(message, isError = false) {
    statusEl.textContent = message;
    statusEl.style.color = isError ? '#ff6b6b' : '#00ff7f';
    statusEl.classList.add('show');
    // Hide status message after 3 seconds
    setTimeout(() => statusEl.classList.remove('show'), 3000);
  }

  /**
   * Navigates the active tab to a new chapter URL on bible.com.
   * @param {number} newChapter The chapter number to navigate to.
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

      // Prevent navigation beyond valid chapter range
      if (newChapter < 1) {
        showStatus("Already at the first chapter.", false);
        return;
      }
      if (newChapter > totalChapters) {
        showStatus("Already at the last chapter.", false);
        return;
      }

      // Construct the new URL and update the tab
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
   * @param {number} newTranslationId The translation ID to navigate to (from browserversion.json).
   * @param {string} newTranslationAbbr The translation abbreviation (e.g., "KJV", "NIV").
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

      // Construct the new URL with the desired translation ID and abbreviation
      const newUrl = `https://www.bible.com/bible/${newTranslationId}/${bookAbbreviation}.${currentChapter}.${newTranslationAbbr}`;
      await chrome.tabs.update(tab.id, { url: newUrl });
      showStatus(`Switching to ${newTranslationAbbr}...`);
    } catch (error) {
      showStatus("Translation switch failed.", true);
      console.error('Translation navigation error:', error);
    }
  }


  // --- Event Listeners ---

  // Event listener for the main "Extract Verses" button
  extractButton.addEventListener('click', async () => {
    extractButton.disabled = true; // Disable button during processing
    extractButton.textContent = 'PROCESSING...';
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab.url || !tab.url.includes("bible.com")) {
        showStatus("❌ Not a bible.com URL", true);
        return;
      }

      // Extract details from the current URL
      const match = tab.url.match(/bible\/(\d+)\/([A-Z0-9]+)\.(\d+)\.([A-Z]+)/);
      if (!match) {
        showStatus("❌ Invalid Bible URL format", true);
        return;
      }

      // Destructure matched URL components
      const [_, translationCode, bookCode, chapter, version] = match;

      // Load book full names and IDs from local JSON files
      const booksJsonRes = await fetch(chrome.runtime.getURL("books.json")); // Abbreviation to full name map
      const booksFullNames = await booksJsonRes.json();

      const allBooksRes = await fetch(chrome.runtime.getURL("all_books.json")); // Array of {bookid, name}
      const allBooks = await allBooksRes.json();

      // Load internal translation mappings (abbreviation to ID for CSV export)
      const translationsRes = await fetch(chrome.runtime.getURL("translations.json"));
      const internalTranslationsMap = await translationsRes.json();

      const bookName = booksFullNames[bookCode]; // e.g., "Genesis" from "GEN"
      // Use internal translation ID for CSV export purposes
      const translationIdForCsv = internalTranslationsMap[version];

      // Validate loaded data
      if (!bookName) {
        showStatus(`❌ Unknown book abbreviation: ${bookCode}`, true);
        return;
      }
      if (typeof translationIdForCsv === 'undefined') {
        showStatus(`❌ Unknown translation abbreviation for CSV: ${version}`, true);
        return;
      }

      // Find the bookid from allBooks using the full book name
      const bookData = allBooks.find(book => book.name === bookName);

      if (!bookData) {
        showStatus(`❌ Book data not found for: ${bookName}`, true);
        return;
      }

      // Send message to content script to extract verses from the current page
      const response = await chrome.tabs.sendMessage(tab.id, { action: "extractVerses" });
      const extractedVerses = response.verses;

      // Define the CSV header matching your PostgreSQL `verses` table structure (excluding auto-generated columns)
      // The 'md.md' sample indicates these columns for COPY.
      let csvContent = `translationid,bookid,chapternumber,versenumber,versetext,versetextsearchable,hasfootnotes,wordcount\n`;

      if (extractedVerses && extractedVerses.length > 0) {
        extractedVerses.forEach(verse => {
          // Normalize whitespace: replace multiple spaces with single space and trim
          const normalizedText = verse.verseText.trim().replace(/\s+/g, ' ');

          // Step 1: Replace smart quotes with standard double quotes for consistency
          let cleanedVerseText = normalizedText
            .replace(/"/g, '"')
            .replace(/"/g, '"')
            .replace(/'/g, "'")
            .replace(/'/g, "'");

          // Step 2: Escape any standard double quotes within the text by doubling them for CSV
          // This is crucial for CSV compliance when text contains commas or quotes.
          const escapedText = cleanedVerseText.replace(/"/g, '""');

          // Calculate word count based on the normalized text
          const wordCount = normalizedText.split(/\s+/).filter(word => word.length > 0).length;

          // Generate the searchable text in tsvector-like format
          const searchableText = generateTsVectorString(normalizedText);

          // Append verse data to CSV content
          // 'f' is used for false in PostgreSQL boolean type for CSV import.
          csvContent += `${translationIdForCsv},${bookData.bookid},${chapter},${verse.verseNumber},"${escapedText}","${searchableText}",f,${wordCount}\n`;
        });

        // Create a Blob from the CSV content and initiate download
        // IMPORTANT: Explicitly set charset to 'utf-8' to prevent encoding issues
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
      extractButton.disabled = false; // Re-enable button
      extractButton.textContent = 'EXTRACT'; // Reset button text
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
    const [_, , , currentChapter] = match; // Extract current chapter
    navigateToChapter(parseInt(currentChapter) - 1); // Navigate to previous chapter
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
    const [_, , , currentChapter] = match; // Extract current chapter
    navigateToChapter(parseInt(currentChapter) + 1); // Navigate to next chapter
  });

  // Event listener for "Chapter 1" button
  chapter1Button.addEventListener('click', () => {
    navigateToChapter(1); // Navigate directly to chapter 1
  });

  // Event listeners for translation buttons
  // Fetch browser-specific translation map for navigation
  let browserTranslationsMap;
  fetch(chrome.runtime.getURL("browserversion.json"))
    .then(response => response.json())
    .then(data => {
      browserTranslationsMap = data;

      // KJV button
      navKJV.addEventListener('click', () => navigateToTranslation(browserTranslationsMap["KJV"], "KJV"));
      // NIV button
      navNIV.addEventListener('click', () => navigateToTranslation(browserTranslationsMap["NIV"], "NIV"));
      // NKJV button
      navNKJV.addEventListener('click', () => navigateToTranslation(browserTranslationsMap["NKJV"], "NKJV"));
      // AMP button
      navAMP.addEventListener('click', () => navigateToTranslation(browserTranslationsMap["AMP"], "AMP"));
      // AMPC button
      navAMPC.addEventListener('click', () => navigateToTranslation(browserTranslationsMap["AMPC"], "AMPC"));
      // TPT button
      navTPT.addEventListener('click', () => navigateToTranslation(browserTranslationsMap["TPT"], "TPT"));
      // ESV button
      navESV.addEventListener('click', () => navigateToTranslation(browserTranslationsMap["ESV"], "ESV"));
      // NLT button - Added event listener for NLT
      navNLT.addEventListener('click', () => navigateToTranslation(browserTranslationsMap["NLT"], "NLT"));
    })
    .catch(error => {
      console.error('Error loading browserversion.json:', error);
      showStatus("Error loading translation navigation data.", true);
    });
});