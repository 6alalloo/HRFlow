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


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract text from PDF file."""
    try:
        pdf_file = io.BytesIO(file_bytes)
        reader = PdfReader(pdf_file)
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"
        return text
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
        return text
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse DOCX: {str(e)}")


def extract_email(text: str) -> Optional[str]:
    """Extract email address from text."""
    email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
    match = re.search(email_pattern, text)
    return match.group(0) if match else None


def extract_phone(text: str) -> Optional[str]:
    """Extract phone number from text."""
    # Matches various phone formats: +1-234-567-8900, (234) 567-8900, 234.567.8900, etc.
    phone_patterns = [
        r'\+?\d{1,3}[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}',
        r'\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}',
        r'\d{3}[-.\s]?\d{3}[-.\s]?\d{4}'
    ]
    for pattern in phone_patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(0)
    return None


def extract_name(text: str) -> Optional[str]:
    """Extract name from text (assumes name is in first few lines)."""
    lines = [line.strip() for line in text.split('\n') if line.strip()]
    if not lines:
        return None

    # Look for name in first 3 lines, skip common headers
    skip_keywords = ['curriculum', 'vitae', 'resume', 'cv']
    for line in lines[:3]:
        lower_line = line.lower()
        if any(keyword in lower_line for keyword in skip_keywords):
            continue
        # Check if line looks like a name (2-4 words, capitalized, no special chars)
        words = line.split()
        if 2 <= len(words) <= 4 and all(word[0].isupper() for word in words if word):
            return line

    return lines[0] if lines else None


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
    """Extract education information from text."""
    degrees = []
    degree_keywords = [
        'bachelor', 'master', 'phd', 'doctorate', 'diploma', 'certificate',
        'b.s.', 'b.a.', 'm.s.', 'm.a.', 'mba', 'ph.d.'
    ]

    lines = text.split('\n')
    for line in lines:
        line_lower = line.lower()
        if any(keyword in line_lower for keyword in degree_keywords):
            degrees.append(line.strip())

    return degrees[:3]  # Return up to 3 degrees


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
