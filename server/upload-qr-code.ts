import { readFileSync } from 'fs';
import { join } from 'path';
import { s3Service } from './s3-service';

const QR_CODE_S3_KEY = 'assets/aside-qr-code.png';

async function uploadQRCode() {
  try {
    console.log('📤 Uploading QR code to S3...');
    
    const qrPath = join(process.cwd(), 'attached_assets/aside-qr_code_1762821708367.png');
    const qrBuffer = readFileSync(qrPath);
    
    console.log(`QR code file read: ${qrBuffer.length} bytes`);
    
    await s3Service.uploadStaticAsset(qrBuffer, QR_CODE_S3_KEY, 'image/png');
    
    console.log(`✅ QR code uploaded successfully to S3 key: ${QR_CODE_S3_KEY}`);
    console.log('This is a permanent asset and will not expire.');
    
    const testUrl = await s3Service.getPublicSignedUrl(QR_CODE_S3_KEY, 3600);
    console.log(`Test URL (1 hour expiry): ${testUrl}`);
    
  } catch (error) {
    console.error('❌ Failed to upload QR code:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

uploadQRCode();
