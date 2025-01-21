import { KMSClient, EncryptCommand, DecryptCommand } from "@aws-sdk/client-kms";

const kmsClient = new KMSClient({
  region: process.env.AWS_REGION || "us-east-1",
});

export const encryptPassword = async (
  password: string,
  kmsKeyId: string
): Promise<string> => {
  const command = new EncryptCommand({
    KeyId: kmsKeyId,
    Plaintext: Buffer.from(password),
  });

  const response = await kmsClient.send(command);
  if (!response.CiphertextBlob) {
    throw new Error("Failed to encrypt password");
  }

  return Buffer.from(response.CiphertextBlob!).toString("base64");
};

export const decryptPassword = async (
  encryptedPassword: string,
  kmsKeyId: string
): Promise<string> => {
  const command = new DecryptCommand({
    KeyId: kmsKeyId,
    CiphertextBlob: Buffer.from(encryptedPassword, "base64"),
  });

  const response = await kmsClient.send(command);
  if (!response.Plaintext) {
    throw new Error("Failed to decrypt password");
  }

  return new TextDecoder("utf-8").decode(response.Plaintext);
};
