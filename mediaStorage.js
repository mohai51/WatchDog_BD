/**
 * WatchDog BD — Secure Media Storage & Processing Subsystem
 *
 * Capabilities:
 * 1. Server-side magic-byte signature validation (JPG, JPEG, PNG, WebP only)
 * 2. Rejection of fake MIME types, oversized images (> 5MB), and unsupported media (video, audio, exe)
 * 3. EXIF and GPS metadata stripping without native C++ compilation dependencies
 * 4. Pluggable Persistent Object Storage (Cloudflare R2 / AWS S3 / S3-Compatible with Local Disk Fallback)
 * 5. Private media access control (pending reports are restricted to admins; approved reports are public)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

// Allowed image MIME types and extensions
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/**
 * Detect real MIME type from binary magic bytes (file signature)
 */
function detectMagicMime(buffer) {
  if (!buffer || buffer.length < 8) return null;

  // JPEG / JPG: Starts with FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return 'image/jpeg';
  }

  // PNG: Starts with 89 50 4E 47 0D 0A 1A 0A (\x89PNG\r\n\x1a\n)
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4E &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0D &&
    buffer[5] === 0x0A &&
    buffer[6] === 0x1A &&
    buffer[7] === 0x0A
  ) {
    return 'image/png';
  }

  // WebP: RIFF [4 bytes len] WEBP
  if (buffer.length >= 12) {
    const riff = buffer.subarray(0, 4).toString('latin1');
    const webp = buffer.subarray(8, 12).toString('latin1');
    if (riff === 'RIFF' && webp === 'WEBP') {
      return 'image/webp';
    }
  }

  // Detect and reject common unsupported media formats explicitly
  if (buffer.subarray(0, 4).toString('latin1') === 'GIF8') {
    return 'image/gif'; // Rejected
  }
  if (buffer.length >= 8 && buffer.subarray(4, 8).toString('latin1') === 'ftyp') {
    return 'video/mp4'; // Rejected
  }
  if (buffer.subarray(0, 4).equals(Buffer.from([0x1A, 0x45, 0xDF, 0xA3]))) {
    return 'video/webm'; // Rejected
  }
  if (buffer.subarray(0, 4).toString('latin1') === '%PDF') {
    return 'application/pdf'; // Rejected
  }
  if (buffer[0] === 0x4D && buffer[1] === 0x5A) {
    return 'application/x-msdownload'; // Rejected EXE
  }

  return null;
}

/**
 * Strip EXIF & GPS metadata from JPEG buffer
 */
function stripJpegMetadata(buf) {
  if (buf.length < 4 || buf[0] !== 0xFF || buf[1] !== 0xD8) {
    throw new Error('Invalid JPEG structure');
  }

  const chunks = [buf.subarray(0, 2)]; // Keep SOI: FF D8
  let offset = 2;

  while (offset < buf.length) {
    if (buf[offset] !== 0xFF) {
      // Reached entropy-coded scan data or corrupted segment
      chunks.push(buf.subarray(offset));
      break;
    }

    const marker = buf[offset + 1];

    // SOS (Start of Scan: 0xFF, 0xDA) or EOI (0xFF, 0xD9) -> remainder is image data
    if (marker === 0xDA || marker === 0xD9) {
      chunks.push(buf.subarray(offset));
      break;
    }

    // Standalone markers with no length payload: RST0..RST7 (0xD0..0xD7), SOI (0xD8)
    if (marker >= 0xD0 && marker <= 0xD7) {
      chunks.push(buf.subarray(offset, offset + 2));
      offset += 2;
      continue;
    }

    if (offset + 4 > buf.length) break;
    const len = buf.readUInt16BE(offset + 2);
    if (offset + 2 + len > buf.length) break;

    // Strip EXIF / XMP / Camera APP markers (0xE1 through 0xEF) and Comments (0xFE)
    // 0xE0 is standard JFIF marker which is safe to retain
    const isExifOrMeta = (marker >= 0xE1 && marker <= 0xEF) || marker === 0xFE;

    if (!isExifOrMeta) {
      chunks.push(buf.subarray(offset, offset + 2 + len));
    }

    offset += 2 + len;
  }

  return Buffer.concat(chunks);
}

/**
 * Strip metadata chunks (eXIf, tEXt, zTXt, iTXt, pHYs, tIME) from PNG buffer
 */
function stripPngMetadata(buf) {
  const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  if (buf.length < 8 || !buf.subarray(0, 8).equals(PNG_HEADER)) {
    throw new Error('Invalid PNG structure');
  }

  const chunks = [PNG_HEADER];
  let offset = 8;
  const STRIP_TYPES = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt', 'pHYs', 'tIME']);

  while (offset < buf.length) {
    if (offset + 8 > buf.length) break;
    const length = buf.readUInt32BE(offset);
    const type = buf.subarray(offset + 4, offset + 8).toString('latin1');
    const totalChunkLength = 12 + length; // 4 len + 4 type + data + 4 crc

    if (offset + totalChunkLength > buf.length) break;

    if (!STRIP_TYPES.has(type)) {
      chunks.push(buf.subarray(offset, offset + totalChunkLength));
    }

    offset += totalChunkLength;
    if (type === 'IEND') break;
  }

  return Buffer.concat(chunks);
}

/**
 * Strip EXIF and XMP chunks from WebP RIFF buffer
 */
function stripWebpMetadata(buf) {
  if (buf.length < 12) throw new Error('Invalid WebP structure');
  const riff = buf.subarray(0, 4).toString('latin1');
  const webp = buf.subarray(8, 12).toString('latin1');
  if (riff !== 'RIFF' || webp !== 'WEBP') throw new Error('Invalid WebP structure');

  let offset = 12;
  const chunks = [];
  let strippedAny = false;

  while (offset < buf.length) {
    if (offset + 8 > buf.length) break;
    const fourCC = buf.subarray(offset, offset + 4).toString('latin1');
    const chunkSize = buf.readUInt32LE(offset + 4);
    const paddedSize = chunkSize + (chunkSize % 2);
    const totalChunk = 8 + paddedSize;

    if (offset + 8 + chunkSize > buf.length) break;

    if (fourCC === 'EXIF' || fourCC === 'XMP ') {
      strippedAny = true;
    } else {
      chunks.push(buf.subarray(offset, Math.min(offset + totalChunk, buf.length)));
    }

    offset += totalChunk;
  }

  if (!strippedAny) return buf;

  const body = Buffer.concat(chunks);
  const header = Buffer.alloc(12);
  header.write('RIFF', 0, 4, 'latin1');
  header.writeUInt32LE(4 + body.length, 4);
  header.write('WEBP', 8, 4, 'latin1');
  return Buffer.concat([header, body]);
}

/**
 * Validate image buffer, enforce size & MIME constraints, and strip EXIF
 */
function validateAndSanitizeImage(buffer, originalFilename = 'image.jpg') {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('No image file content provided.');
  }

  if (buffer.length > MAX_IMAGE_BYTES) {
    const sizeMb = (buffer.length / (1024 * 1024)).toFixed(2);
    throw new Error(`ছবি ফাইলের আকার ৫ মেগাবাইটের বেশি হতে পারবে না (ফাইলের সাইজ: ${sizeMb} MB)। (Image exceeds maximum allowed size of 5 MB).`);
  }

  const detectedMime = detectMagicMime(buffer);
  if (!detectedMime || !ALLOWED_MIME_TYPES.has(detectedMime)) {
    if (detectedMime && (detectedMime.startsWith('video/') || detectedMime.startsWith('audio/'))) {
      throw new Error('ভিডিও বা অডিও আপলোড অনুমোদিত নয়। শুধুমাত্র JPG, PNG অথবা WebP ছবি গ্রহণযোগ্য। (Video and audio uploads are not permitted. Only JPG, PNG, and WebP are allowed).');
    }
    throw new Error('অননুমোদিত ফাইল ফরম্যাট। শুধুমাত্র JPG, JPEG, PNG এবং WebP ছবি আপলোড করা যাবে। (Invalid file format. Only JPG, JPEG, PNG, and WebP images are allowed).');
  }

  let sanitizedBuffer = buffer;
  try {
    if (detectedMime === 'image/jpeg') {
      sanitizedBuffer = stripJpegMetadata(buffer);
    } else if (detectedMime === 'image/png') {
      sanitizedBuffer = stripPngMetadata(buffer);
    } else if (detectedMime === 'image/webp') {
      sanitizedBuffer = stripWebpMetadata(buffer);
    }
  } catch (err) {
    // If metadata parser encounters malformed structure, reject image for security
    throw new Error(`ছবি প্রক্রিয়াকরণে ত্রুটি: ফাইলটি ত্রুটিপূর্ণ বা ক্ষতিগ্রস্ত। (Malformed or corrupted image binary).`);
  }

  const extensionMap = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp'
  };

  const ext = extensionMap[detectedMime] || 'jpg';
  const cleanBaseName = path.basename(originalFilename || 'upload')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 50);

  return {
    valid: true,
    mimeType: detectedMime,
    extension: ext,
    sanitizedBuffer,
    sizeBytes: sanitizedBuffer.length,
    originalName: cleanBaseName
  };
}

/**
 * Persistent Object Storage Service
 * Supports:
 * 1. S3 / Cloudflare R2 / S3-compatible Object Storage (when configured)
 * 2. Persistent Local Storage in data/media (development & testing fallback)
 */
class ObjectStorageService {
  constructor(options = {}) {
    this.mediaDir = options.mediaDir || path.join(__dirname, 'data', 'media');
    this.bucket = (process.env.S3_BUCKET || '').trim();
    this.endpoint = (process.env.S3_ENDPOINT || '').trim();
    this.region = (process.env.S3_REGION || 'auto').trim();
    this.accessKey = (process.env.S3_ACCESS_KEY_ID || '').trim();
    this.secretKey = (process.env.S3_SECRET_ACCESS_KEY || '').trim();
    this.publicDomain = (process.env.S3_PUBLIC_DOMAIN || '').trim();
    this.isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';

    // Ensure local directory exists in dev/test
    if (!this.bucket && !this.isProd) {
      try {
        fs.mkdirSync(this.mediaDir, { recursive: true });
      } catch {}
    }
  }

  isObjectStorageConfigured() {
    return Boolean(this.bucket && this.accessKey && this.secretKey);
  }

  /**
   * Save media file to persistent storage
   */
  async saveMedia(buffer, mimeType, extension, originalFilename) {
    const mediaId = 'm_' + crypto.randomBytes(16).toString('hex');
    const storageKey = `media/${mediaId}.${extension}`;

    if (this.isObjectStorageConfigured()) {
      // In production with S3/R2 configured
      await this._putS3Object(storageKey, buffer, mimeType);
      return {
        media_id: mediaId,
        storage_key: storageKey,
        storage_provider: 's3',
        filename: originalFilename,
        mime_type: mimeType,
        size_bytes: buffer.length,
        status: 'pending',
        uploaded_at: new Date().toISOString()
      };
    }

    if (this.isProd) {
      // Requirement: "If an object storage provider is not configured, implement the integration with environment variables and documentation. Do not invent credentials or pretend uploads are functional."
      throw new Error(
        'OBJECT_STORAGE_UNCONFIGURED: Persistent object storage (S3/Cloudflare R2) is required in production. Please configure S3_BUCKET, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY.'
      );
    }

    // Dev/Test mode: Local persistent disk storage
    try {
      fs.mkdirSync(this.mediaDir, { recursive: true });
    } catch {}

    const localFilePath = path.join(this.mediaDir, `${mediaId}.${extension}`);
    fs.writeFileSync(localFilePath, buffer);

    return {
      media_id: mediaId,
      storage_key: storageKey,
      storage_provider: 'local',
      filename: originalFilename,
      mime_type: mimeType,
      size_bytes: buffer.length,
      status: 'pending',
      uploaded_at: new Date().toISOString()
    };
  }

  /**
   * Fetch media buffer from storage
   */
  async getMedia(storageKey) {
    if (this.isObjectStorageConfigured()) {
      return await this._getS3Object(storageKey);
    }

    // Local disk retrieval
    const filename = path.basename(storageKey);
    const localFilePath = path.join(this.mediaDir, filename);
    if (!fs.existsSync(localFilePath)) {
      return null;
    }
    return fs.readFileSync(localFilePath);
  }

  /**
   * Permanently delete media file when report is purged
   */
  async deleteMedia(storageKey) {
    if (!storageKey) return false;

    if (this.isObjectStorageConfigured()) {
      try {
        await this._deleteS3Object(storageKey);
        return true;
      } catch (err) {
        console.error('[STORAGE DELETE ERROR]', err.message);
        return false;
      }
    }

    const filename = path.basename(storageKey);
    const localFilePath = path.join(this.mediaDir, filename);
    if (fs.existsSync(localFilePath)) {
      try {
        fs.unlinkSync(localFilePath);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  // --- Lightweight AWS SigV4 implementation for standard S3 / Cloudflare R2 ---
  async _putS3Object(key, buffer, contentType) {
    const url = this._getS3Url(key);
    const headers = this._signS3Request('PUT', url, buffer, contentType);
    const res = await fetch(url, {
      method: 'PUT',
      headers,
      body: buffer
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`S3 PutObject failed: HTTP ${res.status} ${errText}`);
    }
  }

  async _getS3Object(key) {
    const url = this._getS3Url(key);
    const headers = this._signS3Request('GET', url, null);
    const res = await fetch(url, {
      method: 'GET',
      headers
    });
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`S3 GetObject failed: HTTP ${res.status}`);
    }
    const arrayBuf = await res.arrayBuffer();
    return Buffer.from(arrayBuf);
  }

  async _deleteS3Object(key) {
    const url = this._getS3Url(key);
    const headers = this._signS3Request('DELETE', url, null);
    const res = await fetch(url, {
      method: 'DELETE',
      headers
    });
    return res.ok;
  }

  _getS3Url(key) {
    const cleanKey = key.startsWith('/') ? key.slice(1) : key;
    if (this.endpoint) {
      const base = this.endpoint.replace(/\/+$/, '');
      return `${base}/${this.bucket}/${cleanKey}`;
    }
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${cleanKey}`;
  }

  _signS3Request(method, urlStr, bodyBuffer, contentType) {
    const parsedUrl = new URL(urlStr);
    const host = parsedUrl.host;
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);

    const contentHash = bodyBuffer
      ? crypto.createHash('sha256').update(bodyBuffer).digest('hex')
      : 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

    const headers = {
      'host': host,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': contentHash
    };

    if (contentType) {
      headers['content-type'] = contentType;
    }

    const canonicalUri = parsedUrl.pathname;
    const canonicalQueryString = '';
    const signedHeadersList = Object.keys(headers).sort();
    const signedHeaders = signedHeadersList.join(';');
    const canonicalHeaders = signedHeadersList
      .map(h => `${h}:${headers[h].trim()}\n`)
      .join('');

    const canonicalRequest = [
      method,
      canonicalUri,
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders,
      contentHash
    ].join('\n');

    const service = 's3';
    const credentialScope = `${dateStamp}/${this.region}/${service}/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      crypto.createHash('sha256').update(canonicalRequest).digest('hex')
    ].join('\n');

    const kDate = crypto.createHmac('sha256', 'AWS4' + this.secretKey).update(dateStamp).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(this.region).digest();
    const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

    headers['authorization'] = `AWS4-HMAC-SHA256 Credential=${this.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return headers;
  }
}

/**
 * Robust pure Node.js multipart/form-data buffer parser
 */
function parseMultipartBuffer(buffer, boundary) {
  const fields = {};
  let file = null;

  const boundaryBuffer = Buffer.from('--' + boundary);
  let start = buffer.indexOf(boundaryBuffer);

  while (start !== -1) {
    start += boundaryBuffer.length;
    if (buffer.subarray(start, start + 2).toString('latin1') === '--') {
      break; // End boundary
    }
    if (buffer[start] === 0x0D && buffer[start + 1] === 0x0A) {
      start += 2;
    }

    const nextBoundary = buffer.indexOf(boundaryBuffer, start);
    if (nextBoundary === -1) break;

    const partBuffer = buffer.subarray(start, nextBoundary - 2); // minus trailing \r\n
    const headerEnd = partBuffer.indexOf(Buffer.from('\r\n\r\n'));
    if (headerEnd !== -1) {
      const headerText = partBuffer.subarray(0, headerEnd).toString('utf8');
      const dataBuffer = partBuffer.subarray(headerEnd + 4);

      const nameMatch = headerText.match(/name="([^"]+)"/);
      const filenameMatch = headerText.match(/filename="([^"]+)"/);
      const typeMatch = headerText.match(/Content-Type:\s*([^\r\n]+)/i);

      if (nameMatch) {
        const fieldName = nameMatch[1];
        if (filenameMatch && filenameMatch[1]) {
          file = {
            fieldName,
            filename: filenameMatch[1],
            mimeType: typeMatch ? typeMatch[1].trim() : 'application/octet-stream',
            buffer: dataBuffer
          };
        } else {
          fields[fieldName] = dataBuffer.toString('utf8').trim();
        }
      }
    }

    start = nextBoundary;
  }

  return { fields, file };
}

const storageService = new ObjectStorageService();

module.exports = {
  MAX_IMAGE_BYTES,
  ALLOWED_MIME_TYPES,
  detectMagicMime,
  stripJpegMetadata,
  stripPngMetadata,
  stripWebpMetadata,
  validateAndSanitizeImage,
  parseMultipartBuffer,
  ObjectStorageService,
  storageService
};
