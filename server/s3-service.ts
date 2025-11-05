import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import sharp from "sharp";
import { log } from "./vite";

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

const BUCKET_NAME = process.env.S3_BUCKET || "";
const MAX_IMAGE_WIDTH = 1200;
const IMAGE_QUALITY = 85;
const SIGNED_URL_EXPIRY = 900; // 15 minutes in seconds

export interface UploadImageOptions {
  buffer: Buffer;
  userId: number;
  messageId: number;
  originalFilename?: string;
}

export interface UploadImageResult {
  key: string;
  bucket: string;
  size: number;
}

async function testConnection(): Promise<boolean> {
  try {
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      log("[S3] Missing AWS credentials in environment");
      return false;
    }

    if (!BUCKET_NAME) {
      log("[S3] Missing S3_BUCKET in environment");
      return false;
    }

    // Test by attempting to get bucket location (minimal operation)
    const testKey = "test-connection.txt";
    const testContent = "Aside S3 connection test";
    
    const putCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: testKey,
      Body: Buffer.from(testContent),
      ContentType: "text/plain",
    });

    await s3Client.send(putCommand);
    log(`[S3] Connection test successful - bucket: ${BUCKET_NAME}`);
    return true;
  } catch (error) {
    log(`[S3] Connection test failed: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

async function optimizeImage(buffer: Buffer): Promise<Buffer> {
  try {
    const image = sharp(buffer);
    const metadata = await image.metadata();
    
    log(`[S3] Optimizing image - original size: ${buffer.length} bytes, format: ${metadata.format}, dimensions: ${metadata.width}x${metadata.height}`);

    // Resize if image is wider than MAX_IMAGE_WIDTH
    let pipeline = image;
    if (metadata.width && metadata.width > MAX_IMAGE_WIDTH) {
      pipeline = pipeline.resize(MAX_IMAGE_WIDTH, null, {
        fit: "inside",
        withoutEnlargement: true,
      });
    }

    // Convert to JPEG with quality optimization
    const optimizedBuffer = await pipeline
      .jpeg({
        quality: IMAGE_QUALITY,
        progressive: true,
        mozjpeg: true,
      })
      .toBuffer();

    const compressionRatio = ((1 - optimizedBuffer.length / buffer.length) * 100).toFixed(1);
    log(`[S3] Image optimized - new size: ${optimizedBuffer.length} bytes (${compressionRatio}% reduction)`);

    return optimizedBuffer;
  } catch (error) {
    log(`[S3] Image optimization failed, using original: ${error instanceof Error ? error.message : String(error)}`);
    return buffer;
  }
}

async function uploadImage(options: UploadImageOptions): Promise<UploadImageResult> {
  try {
    const { buffer, userId, messageId, originalFilename } = options;

    // Optimize image (always converts to JPEG)
    const optimizedBuffer = await optimizeImage(buffer);

    // Generate S3 key: userId/messageId_timestamp.jpg
    // Always use .jpg extension since optimizeImage() converts all formats to JPEG
    const timestamp = Date.now();
    const key = `${userId}/${messageId}_${timestamp}.jpg`;

    const putCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: optimizedBuffer,
      ContentType: "image/jpeg",
      // Private bucket - no public ACL
    });

    await s3Client.send(putCommand);
    
    log(`[S3] Image uploaded successfully - key: ${key}, size: ${optimizedBuffer.length} bytes`);

    return {
      key,
      bucket: BUCKET_NAME,
      size: optimizedBuffer.length,
    };
  } catch (error) {
    log(`[S3] Image upload failed: ${error instanceof Error ? error.message : String(error)}`);
    throw new Error(`Failed to upload image to S3: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

async function getSignedImageUrl(key: string): Promise<string> {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    const signedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: SIGNED_URL_EXPIRY,
    });

    return signedUrl;
  } catch (error) {
    log(`[S3] Failed to generate signed URL for key ${key}: ${error instanceof Error ? error.message : String(error)}`);
    throw new Error(`Failed to generate signed URL: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

async function generateSignedUrlsForMessages(messages: Array<{ mediaUrl?: string | null; [key: string]: any }>): Promise<Array<any>> {
  return Promise.all(
    messages.map(async (message) => {
      if (message.mediaUrl) {
        try {
          const signedUrl = await getSignedImageUrl(message.mediaUrl);
          return {
            ...message,
            mediaUrl: signedUrl,
          };
        } catch (error) {
          log(`[S3] Failed to generate signed URL for message ${message.id}: ${error instanceof Error ? error.message : String(error)}`);
          return message;
        }
      }
      return message;
    })
  );
}

export const s3Service = {
  testConnection,
  uploadImage,
  getSignedImageUrl,
  generateSignedUrlsForMessages,
};
