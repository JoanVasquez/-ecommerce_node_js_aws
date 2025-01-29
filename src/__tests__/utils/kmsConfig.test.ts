import { EncryptCommand, DecryptCommand } from "@aws-sdk/client-kms";
import { encryptPassword, decryptPassword } from "../../utils/kmsConfig"; // Adjust the path as needed

// Mock the KMSClient's send method
jest.mock("@aws-sdk/client-kms", () => {
  const mockSend = jest.fn(); // Define mockSend inside the mock block
  const actualModule = jest.requireActual("@aws-sdk/client-kms");
  return {
    ...actualModule,
    KMSClient: jest.fn(() => ({
      send: mockSend,
    })),
    __mockedSend: mockSend, // Export mockSend for use in tests
  };
});

// Import the mocked send function
const { __mockedSend: mockSend } = jest.requireMock("@aws-sdk/client-kms");

describe("KMS Encryption and Decryption", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const password = "MySecretPassword123!";
  const kmsKeyId = "mock-kms-key-id";
  const encryptedPasswordBase64 = "mockEncryptedBase64=";
  const encryptedBlob = Buffer.from(encryptedPasswordBase64, "base64");
  const decryptedPassword = "MyDecryptedPassword";

  it("should encrypt a password using KMS", async () => {
    // Mock the EncryptCommand response
    mockSend.mockResolvedValueOnce({
      CiphertextBlob: encryptedBlob,
    });

    const result = await encryptPassword(password, kmsKeyId);

    expect(mockSend).toHaveBeenCalledWith(expect.any(EncryptCommand));
    expect(mockSend.mock.calls[0][0].input).toEqual({
      KeyId: kmsKeyId,
      Plaintext: Buffer.from(password),
    });
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(result).toBe(encryptedPasswordBase64);
  });

  it("should throw an error if encryption fails", async () => {
    // Mock a failed response
    mockSend.mockResolvedValueOnce({});

    await expect(encryptPassword(password, kmsKeyId)).rejects.toThrow(
      "Failed to encrypt password"
    );

    expect(mockSend).toHaveBeenCalledWith(expect.any(EncryptCommand));
    expect(mockSend.mock.calls[0][0].input).toEqual({
      KeyId: kmsKeyId,
      Plaintext: Buffer.from(password),
    });
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it("should decrypt an encrypted password using KMS", async () => {
    // Mock the DecryptCommand response
    mockSend.mockResolvedValueOnce({
      Plaintext: Buffer.from(decryptedPassword, "utf-8"),
    });

    const result = await decryptPassword(encryptedPasswordBase64, kmsKeyId);

    expect(mockSend).toHaveBeenCalledWith(expect.any(DecryptCommand));
    expect(mockSend.mock.calls[0][0].input).toEqual({
      KeyId: kmsKeyId,
      CiphertextBlob: encryptedBlob,
    });
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(result).toBe(decryptedPassword);
  });

  it("should throw an error if decryption fails", async () => {
    // Mock a failed response
    mockSend.mockResolvedValueOnce({});

    await expect(
      decryptPassword(encryptedPasswordBase64, kmsKeyId)
    ).rejects.toThrow("Failed to decrypt password");

    expect(mockSend).toHaveBeenCalledWith(expect.any(DecryptCommand));
    expect(mockSend.mock.calls[0][0].input).toEqual({
      KeyId: kmsKeyId,
      CiphertextBlob: encryptedBlob,
    });
    expect(mockSend).toHaveBeenCalledTimes(1);
  });
});
