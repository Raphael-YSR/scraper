-- Database Maintenance Commands for Bible Verses Project

-- 1. UPDATE WORD COUNT FOR EXISTING VERSES (if you want to calculate it from existing data)
UPDATE verses 
SET wordcount = array_length(string_to_array(trim(versetext), ' '), 1)
WHERE wordcount IS NULL OR wordcount = 0;

-- 2. UPDATE SEARCHABLE TEXT FOR EXISTING VERSES (if you want to populate it)
UPDATE verses 
SET versetextsearchable = to_tsvector('english', versetext)
WHERE versetextsearchable IS NULL;

-- 3. DROP WORD COUNT COLUMN (if you don't want to track word count)
ALTER TABLE verses DROP COLUMN IF EXISTS wordcount;

-- 4. MAKE WORD COUNT NULLABLE (if you want to keep the column but allow nulls)
ALTER TABLE verses ALTER COLUMN wordcount DROP NOT NULL;

-- 5. ADD INDEXES FOR BETTER PERFORMANCE (if not already present)
CREATE INDEX IF NOT EXISTS idx_verses_word_count ON verses(wordcount);
CREATE INDEX IF NOT EXISTS idx_verses_created_at ON verses(createdat);

-- 6. CLEAN UP DUPLICATE VERSES (if any exist)
-- This will keep the verse with the latest createdat for each unique combination
DELETE FROM verses a USING verses b 
WHERE a.verseid < b.verseid 
AND a.translationid = b.translationid 
AND a.bookid = b.bookid 
AND a.chapternumber = b.chapternumber 
AND a.versenumber = b.versenumber;

-- 7. UPDATE TIMESTAMPS FOR EXISTING RECORDS (if needed)
UPDATE verses 
SET updatedat = CURRENT_TIMESTAMP 
WHERE updatedat IS NULL;

-- 8. VIEW STATISTICS
SELECT 
    t.name as translation,
    b.name as book,
    COUNT(*) as verse_count,
    AVG(wordcount) as avg_word_count,
    MIN(createdat) as first_added,
    MAX(createdat) as last_added
FROM verses v
JOIN translations t ON v.translationid = t.translationid
JOIN books b ON v.bookid = b.bookid
GROUP BY t.name, b.name
ORDER BY t.name, b.bookid;