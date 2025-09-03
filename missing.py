import os
import csv

def parse_consecutive(vstr):
    vstr = vstr.strip()  # Remove leading/trailing whitespace
    # Handle hyphenated ranges (e.g., "14-15")
    if '-' in vstr:
        try:
            parts = vstr.split('-')
            if len(parts) == 2:
                start, end = parts[0].strip(), parts[1].strip()
                if start.isdigit() and end.isdigit():
                    start, end = int(start), int(end)
                    if end > start:
                        return list(range(start, end + 1))
        except (ValueError, AttributeError):
            return None
    # Handle concatenated numbers (e.g., "1415" for 14-15)
    if vstr.isdigit() and len(vstr) > 1:
        try:
            for i in range(1, len(vstr)):
                first = vstr[:i]
                second = vstr[i:]
                if not first.startswith('0') and not second.startswith('0'):
                    num1, num2 = int(first), int(second)
                    if num2 == num1 + 1:  # Check if consecutive
                        return [num1, num2]
        except (ValueError, AttributeError):
            return None
    return None

# Directory path
dir_path = r'D:\Christ\Scripture'

# Counter for combined verses found
combined_count = 0

# List to store results for final output
results = []

# Iterate through all files in the directory
for filename in os.listdir(dir_path):
    if filename.endswith('.csv') and filename.startswith('verses_'):
        filepath = os.path.join(dir_path, filename)
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                reader = csv.reader(f)
                header = next(reader, None)  # Skip header
                if not header:
                    continue
                rows = [row for row in reader if row and len(row) > 4]
                if not rows:
                    continue
                
                # Collect all verse numbers in the file
                all_vnums_str = {row[3].strip() for row in rows}
                
                # Check for combined verses
                combined = []
                for row in rows:
                    vstr = row[3].strip()
                    segments = parse_consecutive(vstr)
                    if segments and len(segments) >= 2:
                        # Verify if individual verses are not listed separately
                        is_combined = True
                        for seg in segments:
                            if str(seg) in all_vnums_str:
                                is_combined = False
                                break
                        if is_combined:
                            versetext = row[4]
                            combined.append((vstr, segments, versetext))
                
                if combined:
                    results.append((filename, combined))
                    combined_count += len(combined)
        
        except Exception as e:
            results.append((filename, [(None, None, f'Error processing {filename}: {str(e)}')]))

# Print only if combined verses are found
if combined_count > 0:
    for filename, combined in results:
        print(f'\nProcessing file: {filename}')
        print(f'  Found {len(combined)} combined verse(s):')
        for vstr, segs, text in combined:
            print(f'    Combined verses {"-".join(map(str, segs))} (rendered as {vstr}): {text}')
    print(f'\nTotal combined verses found across all files: {combined_count}')