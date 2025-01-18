import { S3 } from "aws-sdk";
import { getCachedParameter } from "./ssmConfig";

const s3 = new S3();

export const uploadFile = async (
  key: string,
  body: Buffer,
  contentType: string
) => {
  const bucket = await getCachedParameter("/myapp/s3/bucket-name");
  const kmsKeyId = await getCachedParameter("/myapp/s3/kms-key-id"); // Add this

  const result = await s3
    .upload({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      ServerSideEncryption: "aws:kms", // Use KMS encryption
      SSEKMSKeyId: kmsKeyId, // Specify the KMS key ID
    })
    .promise();

  return result.Location;
};
