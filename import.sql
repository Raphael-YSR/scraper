COPY verses (translationid, bookid, chapternumber, versenumber, versetext, versetextsearchable, hasfootnotes, wordcount) 
FROM 'D:\Trading Journal\Analysis\A+ BACKTESTING\verses_Genesis_Ch2_AMPC.csv' 
WITH (FORMAT CSV, HEADER true);


-- MISSING CHAPTERS REPORT
SELECT 
    b.bookid,
    b.name AS book_name,
    g.missing_chapter
FROM 
    public.books b
CROSS JOIN LATERAL generate_series(1, b.chapters) g(missing_chapter)
LEFT JOIN public.verses v 
    ON v.bookid = b.bookid 
   AND v.chapternumber = g.missing_chapter
WHERE v.verseid IS NULL
ORDER BY b.bookid, g.missing_chapter;

-- BOOKS WITH NO VERSES
SELECT 
    b.bookid,
    b.name AS book_name,
    v.chapternumber,
    COUNT(v.verseid) AS verse_count
FROM 
    public.books b
LEFT JOIN public.verses v
    ON b.bookid = v.bookid
GROUP BY b.bookid, b.name, v.chapternumber
HAVING COUNT(v.verseid) = 0
ORDER BY b.bookid, v.chapternumber;


-- UNIQUIE CHAPTERS PER BOOK
SELECT 
    b.bookid,
    b.name AS book_name,
    v.chapternumber
FROM 
    public.verses v
JOIN 
    public.books b 
    ON v.bookid = b.bookid
GROUP BY 
    b.bookid, b.name, v.chapternumber
ORDER BY 
    b.bookid, v.chapternumber;
