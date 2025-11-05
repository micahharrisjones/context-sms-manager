import AWS from "aws-sdk";

const s3 = new AWS.S3({
  region: process.env.AWS_REGION,
});

async function testUpload() {
  try {
    const result = await s3
      .upload({
        Bucket: process.env.S3_BUCKET!,
        Key: `test-${Date.now()}.txt`,
        Body: "Hello from Aside on Replit!",
      })
      .promise();

    console.log("✅ Uploaded successfully!");
    console.log("File location:", result.Location);
  } catch (err) {
    console.error("❌ Upload failed:", err);
  }
}

testUpload();
