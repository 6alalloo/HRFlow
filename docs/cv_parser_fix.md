# CV Parser Fix Plan

## Current Architecture

```
┌─────────────────┐     ┌───────────────────┐     ┌──────────────────┐
│   cv-parser/    │────►│  cvParserService  │────►│ executionService │
│   main.py       │     │  .ts              │     │ .ts              │
│   (FastAPI)     │     │  (Backend)        │     │ (Stores output)  │
└─────────────────┘     └───────────────────┘     └──────────────────┘
        │                                                   │
        │  http://localhost:8000/parse                      ▼
        │                                         ┌──────────────────┐
        ▼                                         │ executionDetail  │
   PDF → pypdf                                    │ Page.tsx         │
   DOCX → python-docx                             │ (Frontend)       │
                                                  └──────────────────┘
```

---

## Root Cause: PDF Text Extraction Format

The `pypdf` library extracts **each word on a separate line** for certain PDFs:

**Expected:**

```
Talal Alhawaj
Data Analyst | Backend Developer
+973 33430100 | Talal.hawaj@gmail.com
```

**Actual from pypdf:**

```
Talal

Alhawaj

Data

Analyst

|

...
```

---

## Issues Identified

### 1. Name Extraction - Only Gets First Name

**File:** `cv-parser/main.py` → `extract_name()`

**Problem:** After normalization splits on `|`, first line is `"Talal Alhawaj Data Analyst"` but:

- Contains job title keywords ("Analyst") → gets skipped
- Falls back to first line but may return partial

**Current raw_text shows:**

```json
"name": "Talal"   // Missing "Alhawaj"
```

### 2. Phone Not Extracted

**File:** `cv-parser/main.py` → `extract_phone()`

**Problem:** Phone pattern `+973 33430100` doesn't match existing regex patterns:

```python
phone_patterns = [
    r'\+?\d{1,3}[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}',  # US format
    ...
]
```

Bahraini phone format is `+973 XXXXXXXX` (8 digits, not 10).

### 3. Education Returns Word Fragments

**File:** `cv-parser/main.py` → `extract_education()`

**Problem:** Even with normalization, education patterns don't match CV format.
If CV has `"Bachelor's Degree in Computer Science"` split across formatting, regex fails.

**Current output:**

```json
"education": ["Bachelor's", "Degree", "Bachelor's"]
```

---

## Fix Plan

### Fix 1: Improve Name Extraction

```python
def extract_name(text: str) -> Optional[str]:
    """Extract name - look for 2-3 capitalized words at start, before job titles."""
    lines = [line.strip() for line in text.split('\n') if line.strip()]

    for line in lines[:5]:
        # Remove job title portion after name
        # "Talal Alhawaj Data Analyst" → extract "Talal Alhawaj"
        words = line.split()
        name_words = []

        for word in words:
            word_lower = word.lower()
            # Stop at job title keywords
            if word_lower in ['data', 'analyst', 'developer', 'engineer', ...]:
                break
            if word[0].isupper():  # Names are capitalized
                name_words.append(word)

        if 2 <= len(name_words) <= 4:
            return ' '.join(name_words)

    return None
```

### Fix 2: Add International Phone Patterns

```python
def extract_phone(text: str) -> Optional[str]:
    phone_patterns = [
        # International formats
        r'\+\d{1,4}\s?\d{6,10}',           # +973 33430100
        r'\+\d{1,4}[-.\s]?\d{3,4}[-.\s]?\d{3,4}[-.\s]?\d{3,4}',
        # US formats
        r'\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}',
        # Generic
        r'\d{8,12}',  # 8-12 digit numbers
    ]
    ...
```

### Fix 3: Improve Education Pattern Matching

```python
def extract_education(text: str) -> List[str]:
    # First, look for complete education entries
    # Join all text and search for patterns
    full_text = ' '.join(text.split())  # Single string

    patterns = [
        r"bachelor'?s?\s+(?:of\s+)?(?:\w+\s+)*(?:in\s+)?[\w\s]+(?:university|college)?",
        r"master'?s?\s+(?:of\s+)?(?:\w+\s+)*(?:in\s+)?[\w\s]+",
        r"b\.?s\.?\s+in\s+[\w\s]+",
        r"m\.?s\.?\s+in\s+[\w\s]+",
    ]
    ...
```

### Fix 4: Better Text Normalization

```python
def normalize_text(text: str) -> str:
    """Normalize PDF word-per-line text into readable format."""
    # Join all text first
    normalized = ' '.join(text.split())

    # Find natural section breaks
    sections = []

    # Split at pipe separators (contact info)
    pipe_parts = normalized.split('|')

    # Also split at section headers
    section_headers = ['profile', 'experience', 'education', 'skills', 'projects']

    for part in pipe_parts:
        part = part.strip()
        if part:
            # Check if this contains a section header
            for header in section_headers:
                if header in part.lower():
                    # Split before the header
                    idx = part.lower().find(header)
                    if idx > 0:
                        sections.append(part[:idx].strip())
                    sections.append(part[idx:].strip())
                    break
            else:
                sections.append(part)

    return '\n'.join(sections)
```

---

## Testing the Fix

1. **Restart cv-parser service:**

   ```bash
   cd cv-parser
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

2. **Re-run workflow** with CV Parser step

3. **Check terminal logs** for:
   ```
   ==================================================
   [CV Parser] Parsed CV: filename.pdf
     Name: Talal Alhawaj          ✓
     Email: Talal.hawaj@gmail.com ✓
     Phone: +973 33430100         ✓
     Skills: 11 found             ✓
     Education: ['Bachelor of...'] ✓
   ==================================================
   ```

---

## Files to Modify

| File                                   | Changes                                                                            |
| -------------------------------------- | ---------------------------------------------------------------------------------- |
| `cv-parser/main.py`                    | Fix `extract_name()`, `extract_phone()`, `extract_education()`, `normalize_text()` |
| `frontend/.../executionDetailPage.tsx` | Display already handles data correctly                                             |
| `backend/.../cvParserService.ts`       | No changes needed                                                                  |
| `backend/.../executionService.ts`      | No changes needed                                                                  |

---

## Priority Order

1. **Fix phone extraction** (add `+XXX XXXXXXXX` pattern) - Quick win
2. **Fix name extraction** (stop at job title keywords) - Critical
3. **Fix education** (improve regex patterns) - Important
4. **Improve normalization** (add section detection) - Enhancement
