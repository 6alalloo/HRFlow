"""
HRFlow CV Parser Service
FastAPI service for parsing CVs from PDF and DOCX files.
Uses regex-based extraction for common fields.
"""

from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, Dict, Any, List
import re
import io
from pypdf import PdfReader
from docx import Document
import uvicorn

app = FastAPI(
    title="HRFlow CV Parser",
    description="Simple OCR-based CV parser for extracting candidate information",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def normalize_text(text: str) -> str:
    """
    Normalize text from PDFs/DOCX that extract each word on a separate line.
    Joins all words together, then creates logical lines at section breaks.
    """
    # 1. Brutal whitespace cleanup: Replace ALL whitespace sequences with a single space
    # This handles \n, \r, \t, \f, etc.
    normalized = re.sub(r'\s+', ' ', text).strip()
    
    parts = normalized.split('|')
    full_text = ' | '.join(parts) # Simple join for now
    
    # We DO want to try to insert newlines for sections to help the fallback logic if needed
    # (Though we mostly rely on the normalized single-line string for regexes now)
    return full_text


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract text from PDF file."""
    try:
        pdf_file = io.BytesIO(file_bytes)
        reader = PdfReader(pdf_file)
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"
        # Normalize the text to handle word-per-line PDFs
        return normalize_text(text)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse PDF: {str(e)}")


def extract_text_from_docx(file_bytes: bytes) -> str:
    """Extract text from DOCX file."""
    try:
        docx_file = io.BytesIO(file_bytes)
        doc = Document(docx_file)
        text = ""
        for paragraph in doc.paragraphs:
            text += paragraph.text + "\n"
        
        # Apply normalization to DOCX as well to ensure consistent extraction
        return normalize_text(text)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse DOCX: {str(e)}")


def extract_email(text: str) -> Optional[str]:
    """Extract email from text."""
    # Improved pattern that handles more cases but avoids false positives
    email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
    match = re.search(email_pattern, text)
    return match.group(0) if match else None


def extract_phone(text: str) -> Optional[str]:
    """Extract phone number from text."""
    # Matches various phone formats including International/Bahraini
    phone_patterns = [
        r'\+\d{1,4}\s?\d{6,10}',  # International: +973 33430100
        r'\+\d{1,4}[-.\s]?\d{3,4}[-.\s]?\d{3,4}[-.\s]?\d{3,4}', # Int w/ separators
        r'\+?\d{1,3}[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}', # US/Generic
        r'\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}', # Local US
        r'\b\d{8}\b', # Simple 8 digit
    ]
    for pattern in phone_patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(0)
    return None


def extract_name(text: str) -> Optional[str]:
    """Extract name from text (assumes name is in first few lines)."""
    # Debug: Print start of text
    first_chunk = text.split('\n')[0].strip()
    print(f"[DEBUG] Name Text Start: {first_chunk[:100]}")
    
    skip_keywords = ['curriculum', 'vitae', 'resume', 'cv', 'contact', 'profile', 'about', 'summary']
    job_title_keywords = [
        'analyst', 'developer', 'engineer', 'manager', 'director', 'consultant', 
        'specialist', 'senior', 'junior', 'lead', 'architect', 'admin', 'officer', 'data',
        'product' # Added product
    ]
    
    # Clean up first chunk
    if any(k == first_chunk.lower() for k in skip_keywords):
        # If first line is "RESUME", try second line
        lines = text.split('\n')
        if len(lines) > 1:
            first_chunk = lines[1].strip()

    words = first_chunk.split()
    possible_name = []
    
    for word in words:
        # Stop at job titles, email, phone chars, or separators
        if any(title in word.lower() for title in job_title_keywords):
            print(f"[DEBUG] Stop at keyword: {word}")
            break
        if '@' in word or re.search(r'\d', word) or '|' in word:
            print(f"[DEBUG] Stop at invalid: {word}")
            break
        
        # Allow capitalized words
        if word[0].isupper() or (possible_name and word.lower() in ['bin', 'al', 'de', 'van', 'von']):
            possible_name.append(word)
        # If we hit a lowercase word that isn't a connector, and we already have a name, stop
        elif possible_name:
            print(f"[DEBUG] Stop at lower: {word}")
            break
    
    if 2 <= len(possible_name) <= 5:
        return ' '.join(possible_name)
        
    # 2. Fallback strategy: If normalization somehow failed and we have broken lines
    # e.g. "Talal\nAlhawaj" -> text still has newlines in it?
    # If text has many newlines at start, try to join them
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    
    # Try merging first few capitalized lines
    merged_name = []
    for line in lines[:4]:
        if not line: continue
        # If line is single word and capitalized
        if ' ' not in line and line[0].isupper() and not any(k in line.lower() for k in skip_keywords):
             merged_name.append(line)
        else:
            break
            
    if 2 <= len(merged_name) <= 4:
        return ' '.join(merged_name)

    # 3. Last resort: Return first reasonable line
    if lines:
        first_line = lines[0]
        if 3 < len(first_line) < 30 and not any(k in first_line.lower() for k in skip_keywords):
            return first_line

    return None


def extract_skills(text: str) -> List[str]:
    """Extract skills from text."""
    # Common skill keywords
    skill_keywords = [
        'python', 'java', 'javascript', 'typescript', 'react', 'node.js', 'nodejs',
        'angular', 'vue', 'sql', 'postgresql', 'mysql', 'mongodb', 'docker',
        'kubernetes', 'aws', 'azure', 'gcp', 'git', 'agile', 'scrum',
        'html', 'css', 'rest', 'api', 'microservices', 'ci/cd', 'devops',
        'machine learning', 'data analysis', 'excel', 'powerpoint', 'communication',
        'leadership', 'project management', 'teamwork', 'problem solving'
    ]

    text_lower = text.lower()
    found_skills = []

    for skill in skill_keywords:
        # Use word boundary to avoid partial matches
        pattern = r'\b' + re.escape(skill.lower()) + r'\b'
        if re.search(pattern, text_lower):
            found_skills.append(skill.title())

    return list(set(found_skills))  # Remove duplicates


def extract_experience_years(text: str) -> Optional[int]:
    """Extract years of experience from text."""
    # Look for patterns like "5 years experience", "5+ years", "5-7 years"
    patterns = [
        r'(\d+)\+?\s*years?\s*(?:of)?\s*experience',
        r'experience\s*[:.]?\s*(\d+)\+?\s*years?',
        r'(\d+)-\d+\s*years?\s*(?:of)?\s*experience'
    ]

    for pattern in patterns:
        match = re.search(pattern, text.lower())
        if match:
            return int(match.group(1))

    return None


def extract_education(text: str) -> List[str]:
    """Extract education information from text - finds full degree descriptions."""
    text_lower = text.lower()
    
    # More robust patterns to capture the full line including "Bachelor of X in Y"
    degree_patterns = [
        # Pattern 1: Bachelor's Degree in X, University of Y
        # Handles smart quotes (’) and straight quotes (')
        # Allows commas in the middle (for "Database Systems, Bahrain Polytechnic")
        # Added 'polytechnic' to institution list
        r"(?:(?:bachelor|master|doctor)(?:['’]?s?)?|b\.?s\.?|m\.?s\.?|b\.?a\.?|m\.?a\.?|mba|ph\.?d\.?)\s+(?:degree\s+)?(?:of|in)?\s+[\w\s&,-]+(?:university|college|institute|school|polytechnic)[\w\s,-]*",
        
        # Pattern 2: Bachelor's Degree in X (without explicit university keyword)
        r"(?:bachelor|master|doctor)(?:['’]?s?)?\s+(?:degree\s+)?(?:of|in)\s+[\w\s&,-]+",
        
        # Pattern 3: B.S. in X
        r"(?:b\.?s\.?|m\.?s\.?|b\.?a\.?|m\.?a\.?)\s+in\s+[\w\s&,-]+",
    ]
    
    degrees = []
    
    # 1. Try regex patterns on the whole text
    for pattern in degree_patterns:
        matches = re.finditer(pattern, text_lower, re.IGNORECASE)
        for match in matches:
            # Get original text case if possible, but we are searching lower
            # We'll just capitalize the match result
            match_text = text[match.start():match.end()].strip()
            
            # Filter out false positives that are too long or too short
            if 10 < len(match_text) < 100:
                 # Clean up newlines in the match
                clean_match = re.sub(r'\s+', ' ', match_text)
                degrees.append(clean_match)
    
    # 2. Fallback: Line-based search (especially after normalization provided structure)
    if not degrees:
        lines = text.split('\n')
        degree_keywords = ['bachelor', 'master', 'phd', 'doctorate', 'bsc', 'msc', 'mba', 'degree in']
        
        for line in lines:
            line_clean = line.strip()
            line_lower = line_clean.lower()
            
            if len(line_clean) < 10 or len(line_clean) > 150:
                continue
                
            if any(k in line_lower for k in degree_keywords):
                # Avoid headers like "Education" alone
                if line_lower in ['education', 'education history', 'academic background']:
                    continue
                degrees.append(line_clean)
    
    # Remove duplicates with fuzzy matching
    # if one string is contained in another, keep the longer one
    # if they are very similar, keep one
    
    unique_degrees = []
    # Sort by length descending to prioritize longer descriptions
    degrees.sort(key=len, reverse=True)
    
    for d in degrees:
        is_duplicate = False
        d_lower = d.lower()
        
        for unique in unique_degrees:
            unique_lower = unique.lower()
            
            # Check for substring match
            if d_lower in unique_lower:
                is_duplicate = True
                break
            
            # Check for high similarity (if one is just slightly different)
            # Simple Jaccard similarity on words
            d_words = set(d_lower.split())
            u_words = set(unique_lower.split())
            intersection = d_words.intersection(u_words)
            if not d_words or not u_words: continue
            
            similarity = len(intersection) / len(u_words)
            if similarity > 0.6: # If 60% of words in the new entry are already in an existing entry
                 is_duplicate = True
                 break

        if not is_duplicate:
            unique_degrees.append(d)
    
    return unique_degrees[:3]


def parse_cv_text(text: str) -> Dict[str, Any]:
    """Parse CV text and extract structured information."""
    return {
        "name": extract_name(text),
        "email": extract_email(text),
        "phone": extract_phone(text),
        "skills": extract_skills(text),
        "experience_years": extract_experience_years(text),
        "education": extract_education(text),
        "raw_text": text[:500]  # First 500 chars for debugging
    }


@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "service": "HRFlow CV Parser",
        "status": "running",
        "version": "1.0.0"
    }


@app.post("/parse")
async def parse_cv(
    file: Optional[UploadFile] = File(None),
    url: Optional[str] = Form(None)
):
    """
    Parse a CV from uploaded file or URL.

    Supports PDF and DOCX files.
    Extracts: name, email, phone, skills, experience, education.
    """
    if not file and not url:
        raise HTTPException(
            status_code=400,
            detail="Either 'file' or 'url' must be provided"
        )

    # Handle file upload
    if file:
        filename = file.filename.lower() if file.filename else ""

        # Validate file type
        if not (filename.endswith('.pdf') or filename.endswith('.docx')):
            raise HTTPException(
                status_code=400,
                detail="Only PDF and DOCX files are supported"
            )

        # Read file content
        content = await file.read()

        # Extract text based on file type
        if filename.endswith('.pdf'):
            text = extract_text_from_pdf(content)
        else:  # .docx
            text = extract_text_from_docx(content)

        # Parse extracted text
        parsed_data = parse_cv_text(text)
        
        # Debug: Print parsed data
        print(f"\n{'='*50}")
        print(f"[CV Parser] Parsed CV: {file.filename}")
        print(f"  Name: {parsed_data.get('name')}")
        print(f"  Email: {parsed_data.get('email')}")
        print(f"  Phone: {parsed_data.get('phone')}")
        print(f"  Skills: {len(parsed_data.get('skills', []))} found")
        print(f"  Education: {parsed_data.get('education')}")
        print(f"{'='*50}\n")

        return {
            "success": True,
            "source": "file",
            "filename": file.filename,
            "data": parsed_data
        }

    # Handle URL (placeholder for now - would need requests library)
    if url:
        raise HTTPException(
            status_code=501,
            detail="URL parsing not yet implemented. Please upload file directly."
        )


@app.get("/health")
async def health_check():
    """Health check endpoint for Docker/k8s."""
    return {"status": "healthy"}


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
