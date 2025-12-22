// backend/src/services/cvParserService.ts
import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import path from "path";
import { getFilePath, getFileMetadata } from "./fileUploadService";

// CV Parser service URL (Docker internal network)
const CV_PARSER_URL = process.env.CV_PARSER_URL || "http://localhost:8000";

export interface CVParseResult {
  success: boolean;
  source: string;
  filename?: string;
  data: {
    name: string | null;
    email: string | null;
    phone: string | null;
    skills: string[];
    experience_years: number | null;
    education: string[];
    raw_text?: string;
  };
  error?: string;
}

/**
 * Parse a CV file by its upload ID
 * Calls the cv-parser microservice directly
 */
export async function parseCV(fileId: string): Promise<CVParseResult> {
  // Check if cv-parser is healthy
  const isHealthy = await isCVParserHealthy();
  if (!isHealthy) {
    console.warn(`[CVParserService] CV parser service is not healthy at ${CV_PARSER_URL}`);
    return {
      success: false,
      source: "file",
      data: {
        name: null,
        email: null,
        phone: null,
        skills: [],
        experience_years: null,
        education: [],
      },
      error: `CV parser service unavailable at ${CV_PARSER_URL}. Make sure the service is running.`,
    };
  }

  // Get file path and metadata
  const filePath = getFilePath(fileId);
  const metadata = getFileMetadata(fileId);

  if (!filePath || !metadata) {
    return {
      success: false,
      source: "file",
      data: {
        name: null,
        email: null,
        phone: null,
        skills: [],
        experience_years: null,
        education: [],
      },
      error: `File not found: ${fileId}`,
    };
  }

  try {
    // Create form data with file stream (axios + form-data handles this properly)
    const form = new FormData();
    form.append("file", fs.createReadStream(filePath), {
      filename: metadata.originalName,
      contentType: metadata.mimeType,
    });

    // Call cv-parser service using axios
    console.log(`[CVParserService] Calling cv-parser at ${CV_PARSER_URL}/parse`);
    console.log(`[CVParserService] File: ${metadata.originalName} (${metadata.size} bytes, type: ${metadata.mimeType})`);

    const response = await axios.post(`${CV_PARSER_URL}/parse`, form, {
      headers: form.getHeaders(),
    });

    console.log(`[CVParserService] Response status: ${response.status}`);

    if (response.status !== 200) {
      console.error(`[CVParserService] cv-parser error: ${response.status} - ${JSON.stringify(response.data)}`);
      return {
        success: false,
        source: "file",
        filename: metadata.originalName,
        data: {
          name: null,
          email: null,
          phone: null,
          skills: [],
          experience_years: null,
          education: [],
        },
        error: `CV parser error: ${response.status} - ${JSON.stringify(response.data)}`,
      };
    }

    const result = response.data;
    console.log("[CVParserService] Parse result:", JSON.stringify(result).slice(0, 500));

    return {
      success: true,
      source: "file",
      filename: metadata.originalName,
      data: result.data || result,
    };
  } catch (err) {
    console.error("[CVParserService] Error calling cv-parser:", err);
    return {
      success: false,
      source: "file",
      filename: metadata.originalName,
      data: {
        name: null,
        email: null,
        phone: null,
        skills: [],
        experience_years: null,
        education: [],
      },
      error: err instanceof Error ? err.message : "Failed to parse CV",
    };
  }
}

/**
 * Check if cv-parser service is healthy
 */
export async function isCVParserHealthy(): Promise<boolean> {
  try {
    const response = await axios.get(`${CV_PARSER_URL}/health`);
    return response.status === 200;
  } catch {
    return false;
  }
}
