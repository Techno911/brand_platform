import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, CreateBucketCommand, HeadBucketCommand, PutObjectLockConfigurationCommand } from '@aws-sdk/client-s3';

/**
 * INSIGHTS §5 delta-6: immutable bucket with object-lock compliance mode (7 years).
 * Used for Approval snapshots and finalized export artifacts.
 */
@Injectable()
export class S3ImmutableService implements OnModuleInit {
  private readonly logger = new Logger('S3ImmutableService');
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    this.client = new S3Client({
      endpoint: this.config.get<string>('s3.endpoint'),
      region: 'us-east-1',
      forcePathStyle: true,
      credentials: {
        accessKeyId: this.config.get<string>('s3.accessKey') ?? '',
        secretAccessKey: this.config.get<string>('s3.secretKey') ?? '',
      },
    });
    this.bucket = this.config.get<string>('s3.immutableBucket') ?? 'bp-immutable';
  }

  async onModuleInit() {
    await this.ensureBucket();
  }

  private async ensureBucket() {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return;
    } catch {
      /* not found → create */
    }
    try {
      await this.client.send(
        new CreateBucketCommand({
          Bucket: this.bucket,
          ObjectLockEnabledForBucket: true,
        }),
      );
      await this.client.send(
        new PutObjectLockConfigurationCommand({
          Bucket: this.bucket,
          ObjectLockConfiguration: {
            ObjectLockEnabled: 'Enabled',
            Rule: {
              DefaultRetention: {
                Mode: 'COMPLIANCE',
                Years: 7,
              },
            },
          },
        }),
      );
      this.logger.log(`Created immutable bucket ${this.bucket} with 7-year COMPLIANCE lock`);
    } catch (err: any) {
      this.logger.warn(`bucket init non-fatal error: ${err?.message}`);
    }
  }

  async putJson(key: string, body: any, metadata?: Record<string, string>): Promise<string> {
    const content = JSON.stringify(body, null, 2);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: content,
        ContentType: 'application/json; charset=utf-8',
        Metadata: metadata,
      }),
    );
    return `s3://${this.bucket}/${key}`;
  }

  async putBytes(key: string, body: Buffer, contentType: string, metadata?: Record<string, string>): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        Metadata: metadata,
      }),
    );
    return `s3://${this.bucket}/${key}`;
  }
}
