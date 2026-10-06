import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { s3Service } from '../s3-service';
import { storage } from '../storage';
import { createTestApp } from './test-app';

describe('Shared board messages API', () => {
  const userId = 123;
  let app: Express;

  beforeAll(async () => {
    app = await createTestApp({ authenticatedUserId: userId });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a signed media URL instead of the raw S3 key', async () => {
    const rawS3Key = 'messages/42/image.jpg';
    const signedMediaUrl =
      'https://media.example.test/messages/42/image.jpg?X-Amz-Signature=test-signature';
    const imageMessage = {
      id: 42,
      userId,
      content: 'Image',
      mediaUrl: rawS3Key,
      mediaType: 'image',
    };

    const getSharedMessages = vi
      .spyOn(storage, 'getSharedMessages')
      .mockResolvedValue([imageMessage] as any);
    const signMessages = vi
      .spyOn(s3Service, 'generateSignedUrlsForMessages')
      .mockResolvedValue([{ ...imageMessage, mediaUrl: signedMediaUrl }]);

    const response = await request(app).get(
      '/api/shared-boards/Family%20Photos/messages',
    );

    expect(response.status).toBe(200);
    expect(getSharedMessages).toHaveBeenCalledWith(userId, 'Family Photos');
    expect(signMessages).toHaveBeenCalledWith([imageMessage]);
    expect(response.body[0].mediaUrl).toBe(signedMediaUrl);
    expect(response.body[0].mediaUrl).not.toBe(rawS3Key);
  });
});