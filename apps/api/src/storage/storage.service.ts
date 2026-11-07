import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { mkdir, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { env } from '../config/env';

/** S3/R2 when S3_BUCKET is set, otherwise local disk (development) */
@Injectable()
export class StorageService {
  private s3?: S3Client;

  private client() {
    this.s3 ??= new S3Client({
      region: process.env.S3_REGION ?? 'auto', endpoint: process.env.S3_ENDPOINT || undefined,
      credentials: process.env.S3_ACCESS_KEY_ID ? { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! } : undefined,
    });
    return this.s3;
  }

  async put(buffer: Buffer, key: string, contentType: string): Promise<string> {
    if (process.env.S3_BUCKET) {
      await this.client().send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key, Body: buffer, ContentType: contentType }));
      return `${(process.env.S3_PUBLIC_URL ?? '').replace(/\/$/, '')}/${key}`;
    }
    const path = join(process.cwd(), 'uploads', key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, buffer);
    return `${env.apiPublicUrl.replace(/\/api$/, '')}/files/${key}`;
  }
}
