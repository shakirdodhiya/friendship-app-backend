import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { badRequest } from '../../common/errors';
import { AppConfig } from '../../config/app-config.service';

/** Detects the image type from its first bytes rather than trusting the client's Content-Type. */
function sniffImage(buffer: Buffer): 'jpg' | 'png' | 'webp' | undefined {
  if (buffer.length < 12) return undefined;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return undefined;
}

/**
 * Stores uploads on local disk and serves them from `/uploads`.
 * Swap this class for an S3/GCS implementation in production — callers only use `saveImage` and `remove`.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  readonly root: string;

  constructor(private readonly config: AppConfig) {
    this.root = resolve(config.get('UPLOAD_DIR'));
  }

  async saveImage(file: Express.Multer.File | undefined, folder: string): Promise<string> {
    if (!file) throw badRequest('An image file is required in the "file" field');
    const ext = sniffImage(file.buffer);
    if (!ext) throw badRequest('Only JPEG, PNG and WebP images are accepted');

    const key = `${folder}/${randomUUID()}.${ext}`;
    await mkdir(join(this.root, folder), { recursive: true });
    await writeFile(join(this.root, key), file.buffer);
    return `${this.config.get('PUBLIC_BASE_URL')}/uploads/${key}`;
  }

  /** Best effort: a missing file is not an error. */
  async remove(url: string): Promise<void> {
    const prefix = `${this.config.get('PUBLIC_BASE_URL')}/uploads/`;
    if (!url.startsWith(prefix)) return;
    const path = resolve(this.root, url.slice(prefix.length));
    if (!path.startsWith(this.root)) return;
    await unlink(path).catch((error) => this.logger.debug(`Could not delete ${path}: ${error}`));
  }
}
